import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import {
  api, type AgotarRequest, type AsignacionActiva, type EditarReparacionRequest, type GuardarFilaRequest, type InsertarCompletaRequest,
} from '@/shared/api/client'
import { MSG_NO_ENCONTRADO, NoEncontradoError, PermisoError } from '@/shared/api/errors'
import { CLAVE_CONTADORES, claveAsignaciones, claveHistorial } from '../api'
import type { DatosEditar, DatosNuevo } from './estado'

export const claveCargaNuevo = (idAsignacion: string) => ['formulario', 'nuevo', idAsignacion] as const
export const claveCargaEditar = (idRep: string) => ['formulario', 'editar', idRep] as const
/** Raíz de las consultas de la campana. Se define aquí para no importar de notificaciones/; notificaciones/api.ts la reexporta. */
export const CLAVE_NOTIF = ['notificaciones'] as const

export type CargaNuevo = { datos: DatosNuevo; asignacionesActivas: AsignacionActiva[]; borradorJson: string | null }

async function pedirAgrupados() {
  return (await api.GET('/api/componentes/agrupados')).data ?? {}
}

/** Carga del flujo nuevo y Glass. 1) La asignación, para conocer el IMEI (vale igual con F5 o acceso directo por URL; su
 *  404 llega como NoEncontradoError). 2) En paralelo: componentes, solicitudes e incidencia (un fallo rechaza la carga y la
 *  vista lo muestra) y, en silencio, asignaciones activas del IMEI (→ []), modelo del teléfono (→ null) y borrador (→ null),
 *  SALVO un 403 del borrador, que se propaga: significa que la asignación no es del técnico de la sesión. */
export async function cargarNuevo(idAsignacion: string): Promise<CargaNuevo> {
  const asignacion = (await api.GET('/api/reparaciones/asignaciones/{idRep}', { params: { path: { idRep: idAsignacion } } })).data
  if (!asignacion) throw new NoEncontradoError(404, MSG_NO_ENCONTRADO)
  const imei = asignacion.imei
  const glass = idAsignacion.startsWith('AG')
  const [agrupados, solicitudes, incidencia, asignacionesActivas, modeloTelefono, borradorJson] = await Promise.all([
    pedirAgrupados(),
    api.GET('/api/reparaciones/asignaciones/{idAsignacion}/solicitudes', { params: { path: { idAsignacion } } }).then((r) => r.data ?? []),
    api
      .GET('/api/reparaciones/imei/{imei}/incidencia-activa', { params: { path: { imei }, query: { tipo: glass ? 'G' : 'R' } } })
      .then((r) => r.data?.value ?? null),
    api
      .GET('/api/reparaciones/imei/{imei}/asignaciones-activas', { params: { path: { imei } } })
      .then((r) => r.data ?? [])
      .catch((): AsignacionActiva[] => []),
    api
      .GET('/api/telefonos/{imei}/modelo', { params: { path: { imei } } })
      .then((r) => r.data?.value || null)
      .catch(() => null),
    api
      .GET('/api/reparaciones/{idRep}/borrador', { params: { path: { idRep: idAsignacion } } })
      .then((r) => r.data?.contenido ?? null)
      .catch((e: unknown) => {
        if (e instanceof PermisoError) throw e
        return null
      }),
  ])
  return {
    datos: { modo: glass ? 'glass' : 'nuevo', idAsignacion, imei, agrupados, solicitudes, incidencia, modeloTelefono },
    asignacionesActivas,
    borradorJson,
  }
}

/** Carga del modo edición: el detalle y, después, en paralelo, componentes, piezas ya reparadas en el IMEI (sin contar la
 *  editada) y, en silencio (→ []), las acciones "otro" de otras reparaciones del IMEI en la misma categoría. */
export async function cargarEditar(idRep: string): Promise<DatosEditar> {
  const detalle = (await api.GET('/api/reparaciones/{idRep}/detalle-edicion', { params: { path: { idRep } } })).data
  if (!detalle) throw new NoEncontradoError(404, MSG_NO_ENCONTRADO)
  const imei = detalle.imei
  const categoria = idRep.startsWith('G') ? 'G' : 'R'
  const [agrupados, yaReparados, accionesYaReparadas] = await Promise.all([
    pedirAgrupados(),
    api.GET('/api/reparaciones/imei/{imei}/ya-reparados', { params: { path: { imei }, query: { excluir: idRep } } }).then((r) => r.data ?? []),
    api
      .GET('/api/reparaciones/imei/{imei}/acciones', { params: { path: { imei }, query: { categoria, excluir: idRep } } })
      .then((r) => r.data ?? [])
      .catch((): string[] => []),
  ])
  return { modo: 'editar', idRep, detalle, agrupados, yaReparados, accionesYaReparadas }
}

// Una carga por apertura del formulario: no se comparte ni se reutiliza (gcTime 0 + staleTime 0: reabrir vuelve a pedirlo
// todo, incluso si el recolector de basura de TanStack —un timeout(0)— aún no ha corrido cuando se remonta en el mismo
// tick), no se refresca sola mientras está abierto (refetchOnWindowFocus/Reconnect/Interval en false; nada dispara un
// refetch salvo un remontaje) y no avisa por la vía global: la vista muestra el mensaje y vuelve a la lista.
const OPCIONES_CARGA = { gcTime: 0, staleTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false, refetchInterval: false, meta: { silenciarError: true } } as const

export function useCargaNuevo(idAsignacion: string): UseQueryResult<CargaNuevo> {
  return useQuery({ queryKey: claveCargaNuevo(idAsignacion), queryFn: () => cargarNuevo(idAsignacion), ...OPCIONES_CARGA })
}

export function useCargaEditar(idRep: string): UseQueryResult<DatosEditar> {
  return useQuery({ queryKey: claveCargaEditar(idRep), queryFn: () => cargarEditar(idRep), ...OPCIONES_CARGA })
}

// ── Mutaciones ───────────────────────────────────────────────────────────────────────────────────────────────────────
// Todas con meta.silenciarError: la vista pone el literal de la ficha ("No se pudo guardar la fila: …", etc.). Un corte de
// conexión lo avisa igualmente el mecanismo global. NINGUNA invalida nada: mientras el formulario está abierto la lista de
// debajo no se toca; se recarga al cerrar (useRecargarAlCerrar).

/** "✓ Guardar fila" y "✓ Guardar" de una acción. Devuelve el idRep generado ('?' si el servidor no lo da). */
export function useGuardarFila(): UseMutationResult<string, unknown, { idAsignacion: string; cuerpo: GuardarFilaRequest }> {
  return useMutation<string, unknown, { idAsignacion: string; cuerpo: GuardarFilaRequest }>({
    mutationFn: async ({ idAsignacion, cuerpo }) => {
      const { data } = await api.POST('/api/reparaciones/{idAsignacion}/filas', { params: { path: { idAsignacion } }, body: cuerpo })
      return data?.value ?? '?'
    },
    meta: { silenciarError: true },
  })
}

export function useAgotarComponente(): UseMutationResult<void, unknown, { idAsignacion: string; cuerpo: AgotarRequest }> {
  return useMutation<void, unknown, { idAsignacion: string; cuerpo: AgotarRequest }>({
    mutationFn: async ({ idAsignacion, cuerpo }) => {
      await api.POST('/api/reparaciones/{idAsignacion}/agotar-componente', { params: { path: { idAsignacion } }, body: cuerpo })
    },
    meta: { silenciarError: true },
  })
}

export function useCompleta(): UseMutationResult<void, unknown, InsertarCompletaRequest> {
  return useMutation<void, unknown, InsertarCompletaRequest>({
    mutationFn: async (cuerpo) => {
      await api.POST('/api/reparaciones/completa', { body: cuerpo })
    },
    meta: { silenciarError: true },
  })
}

export function useEditarReparacion(): UseMutationResult<void, unknown, { idRep: string; cuerpo: EditarReparacionRequest }> {
  return useMutation<void, unknown, { idRep: string; cuerpo: EditarReparacionRequest }>({
    mutationFn: async ({ idRep, cuerpo }) => {
      await api.PUT('/api/reparaciones/{idRep}', { params: { path: { idRep } }, body: cuerpo })
    },
    meta: { silenciarError: true },
  })
}

// ── Borrador y verificación ──────────────────────────────────────────────────────────────────────────────────────────
// Funciones sueltas (no pasan por TanStack Query, así que no hay aviso global) que LANZAN: quien llama decide el silencio.
// En el contrato el parámetro de ruta se llama idRep, aunque el valor es el id de la asignación.

export async function guardarBorrador(idAsignacion: string, contenido: string): Promise<void> {
  await api.PUT('/api/reparaciones/{idRep}/borrador', { params: { path: { idRep: idAsignacion } }, body: { contenido } })
}

export async function borrarBorrador(idAsignacion: string): Promise<void> {
  await api.DELETE('/api/reparaciones/{idRep}/borrador', { params: { path: { idRep: idAsignacion } } })
}

/** Ids de las reparaciones que existen hoy para el IMEI: con ellos se detectan las filas guardadas que otro usuario borró. */
export async function idsReparacionesDelImei(imei: string): Promise<string[]> {
  const { data } = await api.GET('/api/reparaciones/imei/{imei}', { params: { path: { imei } } })
  return (data ?? []).map((r) => r.idRep)
}

// ── Recarga al cerrar ────────────────────────────────────────────────────────────────────────────────────────────────

const CLAVES_AL_CERRAR: readonly (readonly unknown[])[] = [
  claveAsignaciones('REPARACION'), claveAsignaciones('GLASS'), claveAsignaciones('PULIDO'), CLAVE_CONTADORES,
  claveHistorial('REPARACION'), claveHistorial('GLASS'), claveHistorial('PULIDO'), CLAVE_NOTIF,
]

/** Al cerrar el formulario, se haya guardado o no: recarga la lista de debajo (pendientes e historiales), los contadores de
 *  Pendientes y la campana. Lanza las recargas y no las espera: cerrar no debe quedarse colgado de la red. */
export function useRecargarAlCerrar(): () => void {
  const qc = useQueryClient()
  return useCallback(() => {
    for (const queryKey of CLAVES_AL_CERRAR) void qc.invalidateQueries({ queryKey })
  }, [qc])
}
