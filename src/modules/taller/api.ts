import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Cliente, type ContadoresPendientes, type ReparacionResumen, type Tecnico } from '@/shared/api/client'
import { useIntervaloRefresco } from '@/shared/api/refresco'
import { useSession } from '@/shared/session/SessionProvider'
import { esAdmin, esSuperTecnico } from '@/shared/session/storage'

export type TipoLista = 'REPARACION' | 'GLASS' | 'PULIDO'

export const claveHistorial = (tipo: TipoLista) => ['historial', tipo] as const
/** Prefijo, no la clave real: useAsignaciones le añade el sufijo `tecnico ?? 'propio'`. invalidateQueries
 *  matchea por prefijo (sirve para invalidar), pero getQueryData/setQueryData (match exacto) no encontrarían
 *  nada con esta clave sola. */
export const claveAsignaciones = (tipo: TipoLista) => ['asignaciones', tipo] as const
/** Prefijo, no la clave real: useContadoresPendientes le añade el sufijo `tecnico ?? 'propio'`. invalidateQueries
 *  matchea por prefijo (sirve para invalidar), pero getQueryData/setQueryData (match exacto) no encontrarían
 *  nada con esta clave sola. */
export const CLAVE_CONTADORES = ['pendientes', 'contadores'] as const
export const CLAVE_TECNICOS = ['tecnicos'] as const
// CLAVE_TECNICOS_ACTIVOS extiende CLAVE_TECNICOS (['tecnicos', 'activos']): invalidar CLAVE_TECNICOS también
// invalida CLAVE_TECNICOS_ACTIVOS, por el mismo matcheo por prefijo de invalidateQueries.
export const CLAVE_TECNICOS_ACTIVOS = ['tecnicos', 'activos'] as const
export const CLAVE_CLIENTES_ACTIVOS = ['clientes', 'activos'] as const

async function pedirHistorial(tipo: TipoLista): Promise<ReparacionResumen[]> {
  switch (tipo) {
    case 'REPARACION': return (await api.GET('/api/reparaciones/historial')).data ?? []
    case 'GLASS': return (await api.GET('/api/glass/historial')).data ?? []
    case 'PULIDO': return (await api.GET('/api/pulidos/historial')).data ?? []
  }
}

async function pedirAsignaciones(tipo: TipoLista, tecnico: number | undefined): Promise<ReparacionResumen[]> {
  const params = { query: { tecnico } }
  switch (tipo) {
    case 'REPARACION': return (await api.GET('/api/reparaciones/asignaciones', { params })).data ?? []
    case 'GLASS': return (await api.GET('/api/glass/asignaciones', { params })).data ?? []
    case 'PULIDO': return (await api.GET('/api/pulidos/asignaciones', { params })).data ?? []
  }
}

/** El supertécnico pide sus propios pendientes con ?tecnico=; al técnico el servidor ya se lo fuerza (FiltroTecnico). */
function useTecnicoPropio(): number | undefined {
  const { sesion } = useSession()
  return esSuperTecnico(sesion) && sesion?.idTec != null ? sesion.idTec : undefined
}

/** Historial (R/G/P). El ADMIN no sondea, como en el JavaFX. */
export function useHistorial(tipo: TipoLista) {
  const { sesion } = useSession()
  const intervalo = useIntervaloRefresco(!esAdmin(sesion))
  return useQuery({ queryKey: claveHistorial(tipo), queryFn: () => pedirHistorial(tipo), refetchInterval: intervalo })
}

/** Pendientes (A/AG/AP) del técnico de la sesión. */
export function useAsignaciones(tipo: TipoLista) {
  const tecnico = useTecnicoPropio()
  const intervalo = useIntervaloRefresco()
  return useQuery({ queryKey: [...claveAsignaciones(tipo), tecnico ?? 'propio'], queryFn: () => pedirAsignaciones(tipo, tecnico), refetchInterval: intervalo })
}

export function useContadoresPendientes() {
  const tecnico = useTecnicoPropio()
  const intervalo = useIntervaloRefresco()
  return useQuery({
    queryKey: [...CLAVE_CONTADORES, tecnico ?? 'propio'],
    queryFn: async (): Promise<ContadoresPendientes> =>
      (await api.GET('/api/reparaciones/pendientes/contadores', { params: { query: { tecnico } } })).data ?? { reparaciones: 0, glass: 0, pulidos: 0 },
    refetchInterval: intervalo,
  })
}

export function useTecnicos(soloActivos = false) {
  return useQuery({
    queryKey: soloActivos ? CLAVE_TECNICOS_ACTIVOS : CLAVE_TECNICOS,
    queryFn: async (): Promise<Tecnico[]> => (soloActivos ? (await api.GET('/api/tecnicos/activos')).data : (await api.GET('/api/tecnicos')).data) ?? [],
  })
}

export function useClientesActivos() {
  return useQuery({ queryKey: CLAVE_CLIENTES_ACTIVOS, queryFn: async (): Promise<Cliente[]> => (await api.GET('/api/clientes/activos')).data ?? [] })
}

export async function referenciadora(idRep: string): Promise<string | null> {
  const { data } = await api.GET('/api/reparaciones/{idRep}/referenciadora', { params: { path: { idRep } } })
  return data?.value ?? null
}

function useInvalidar(...claves: readonly (readonly unknown[])[]) {
  const qc = useQueryClient()
  return () => Promise.all(claves.map((queryKey) => qc.invalidateQueries({ queryKey })))
}

const PENDIENTES_REP = [claveAsignaciones('REPARACION'), CLAVE_CONTADORES] as const
const PENDIENTES_AMBAS = [claveAsignaciones('REPARACION'), claveAsignaciones('GLASS'), CLAVE_CONTADORES] as const
const PENDIENTES_PUL = [claveAsignaciones('PULIDO'), CLAVE_CONTADORES] as const
const HISTORIALES = [claveHistorial('REPARACION'), claveHistorial('GLASS'), claveHistorial('PULIDO')] as const

export function usePorCerrar() {
  const recargar = useInvalidar(...PENDIENTES_REP)
  return useMutation({
    mutationFn: ({ idRep, porCerrar }: { idRep: string; porCerrar: boolean }) =>
      api.PATCH('/api/reparaciones/asignaciones/{idRep}/por-cerrar', { params: { path: { idRep } }, body: { porCerrar } }),
    onSettled: recargar,
  })
}
export function useEntregaGlass() {
  const recargar = useInvalidar(...PENDIENTES_AMBAS)
  return useMutation({
    mutationFn: ({ idRep, entregado }: { idRep: string; entregado: boolean }) =>
      api.PATCH('/api/reparaciones/asignaciones/{idRep}/entrega-glass', { params: { path: { idRep } }, body: { entregado } }),
    onSettled: recargar,
  })
}
export function useMarcarLlegada() {
  const recargar = useInvalidar(...PENDIENTES_AMBAS)
  return useMutation({
    mutationFn: (idRep: string) => api.PATCH('/api/reparaciones/asignaciones/{idRep}/llegada', { params: { path: { idRep } } }),
    onSettled: recargar,
  })
}
export function useDeshacerLlegada() {
  const recargar = useInvalidar(...PENDIENTES_AMBAS)
  return useMutation({
    mutationFn: (idRep: string) => api.DELETE('/api/reparaciones/asignaciones/{idRep}/llegada', { params: { path: { idRep } } }),
    onSettled: recargar,
  })
}
export function useBorrarAsignacion() {
  const recargar = useInvalidar(...PENDIENTES_AMBAS)
  return useMutation({
    mutationFn: (idAsig: string) => api.DELETE('/api/reparaciones/asignaciones/{idAsig}', { params: { path: { idAsig } } }),
    onSettled: recargar,
  })
}
/** Borra también el estado de incidencia del historial (no solo Pendientes): borrarIncidenciaPorImei en el
 *  servidor resetea ES_INCIDENCIA/INCIDENCIA en Reparacion_componente de las filas R%/G% (las de historial,
 *  ver ReparacionDAO.HISTORIAL_SELECT/GLASS_HISTORIAL_SELECT), que es justo lo que expone esIncidencia/
 *  esResuelto en /api/{reparaciones,glass}/historial. Por eso invalida HISTORIALES, como useCancelarIncidencia. */
export function useBorrarIncidenciaActiva() {
  const recargar = useInvalidar(...HISTORIALES, ...PENDIENTES_AMBAS)
  return useMutation({
    mutationFn: ({ imei, tipo }: { imei: string; tipo: 'R' | 'G' }) =>
      api.DELETE('/api/reparaciones/imei/{imei}/incidencia-activa', { params: { path: { imei }, query: { tipo } } }),
    onSettled: recargar,
  })
}
export function useCompletarPulidos() {
  const recargar = useInvalidar(...PENDIENTES_PUL, claveHistorial('PULIDO'))
  return useMutation({
    mutationFn: (ids: string[]) => api.POST('/api/pulidos/asignaciones/completar-lote', { body: { ids } }),
    onSettled: recargar,
  })
}
export function useBorrarAsignacionPulido() {
  const recargar = useInvalidar(...PENDIENTES_PUL)
  return useMutation({
    mutationFn: (idAP: string) => api.DELETE('/api/pulidos/asignaciones/{idAP}', { params: { path: { idAP } } }),
    onSettled: recargar,
  })
}
export function useBorrarReparacion() {
  const recargar = useInvalidar(...HISTORIALES)
  return useMutation({
    mutationFn: ({ idRep, motivo }: { idRep: string; motivo: string }) =>
      api.DELETE('/api/reparaciones/{idRep}', { params: { path: { idRep } }, body: { motivo } }),
    onSettled: recargar,
  })
}
export function useBorrarPulido() {
  const recargar = useInvalidar(claveHistorial('PULIDO'))
  return useMutation({
    mutationFn: ({ idP, motivo }: { idP: string; motivo: string }) =>
      api.DELETE('/api/pulidos/historial/{idP}', { params: { path: { idP } }, body: { motivo } }),
    onSettled: recargar,
  })
}
/** La vista muestra "No se pudo guardar: <mensaje>" (calco del JavaFX), de ahí meta.silenciarError. */
export function useAnadirIncidencia() {
  const recargar = useInvalidar(...HISTORIALES, ...PENDIENTES_AMBAS)
  return useMutation({
    mutationFn: ({ idRep, comentario, imei, idTec }: { idRep: string; comentario: string; imei: string; idTec: number }) =>
      api.POST('/api/reparaciones/{idRep}/incidencia', { params: { path: { idRep } }, body: { comentario, imei, idTec } }),
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}
export function useCancelarIncidencia() {
  const recargar = useInvalidar(...HISTORIALES, ...PENDIENTES_AMBAS)
  return useMutation({
    mutationFn: (idRep: string) => api.DELETE('/api/reparacion-componentes/{idRep}/incidencia', { params: { path: { idRep } } }),
    onSettled: recargar,
  })
}
/** Observación y cliente del teléfono llevan bloqueo optimista: su 409 lo traduce la vista (meta.silenciarError).
 *  `updatedAt` es el `telefonoUpdatedAt` de la fila (no nullable en el contrato: el servidor exige la fila Telefono). */
export function useEditarObservacionTelefono() {
  const recargar = useInvalidar(...HISTORIALES)
  return useMutation({
    mutationFn: ({ imei, observacion, updatedAt }: { imei: string; observacion: string; updatedAt: string }) =>
      api.PATCH('/api/telefonos/{imei}/observacion', { params: { path: { imei } }, body: { observacion, updatedAt } }),
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}
export function useEditarClienteTelefono() {
  const recargar = useInvalidar(...HISTORIALES)
  return useMutation({
    mutationFn: ({ imei, idCli, updatedAt }: { imei: string; idCli: number | null; updatedAt: string }) =>
      api.PATCH('/api/telefonos/{imei}/cliente', { params: { path: { imei } }, body: { idCli, updatedAt } }),
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}
export function useEditarModeloTelefono() {
  const recargar = useInvalidar(...HISTORIALES)
  return useMutation({
    mutationFn: ({ imei, modelo }: { imei: string; modelo: string }) =>
      api.POST('/api/telefonos', { body: { imei, modelo, idCli: null, clienteExplicito: null } }),
    onSettled: recargar,
  })
}
