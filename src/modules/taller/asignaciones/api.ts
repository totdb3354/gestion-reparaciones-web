import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type CargaTecnicosRespuesta, type ReparacionResumen } from '@/shared/api/client'
import { useIntervaloRefresco } from '@/shared/api/refresco'
import { ordenarPendientes } from '../lib/filtros'
import { tipoDe } from './filtros'

export const CLAVE_ASIGNACIONES_TODAS = ['asignaciones', 'todas'] as const
export const CLAVE_CARGA_TECNICOS = ['carga-tecnicos'] as const

/** Las tres categorías, SIN ?tecnico=: la vista del supertécnico es la lista completa. */
async function pedirTodas(): Promise<ReparacionResumen[]> {
  const [rep, glass, pul] = await Promise.all([
    api.GET('/api/reparaciones/asignaciones'),
    api.GET('/api/glass/asignaciones'),
    api.GET('/api/pulidos/asignaciones'),
  ])
  return ordenarPendientes([...(rep.data ?? []), ...(glass.data ?? []), ...(pul.data ?? [])])
}

/**
 * Lista unificada de las tres categorías, ya en orden de prioridad (urgentes → con cliente → resto).
 * `activo = false` congela el sondeo mientras hay un menú, un desplegable o un diálogo abiertos (spec 3a,
 * D4): si no, la recarga mueve la fila bajo el cursor y la acción se pierde.
 */
export function useAsignacionesTodas({ activo = true }: { activo?: boolean } = {}) {
  const intervalo = useIntervaloRefresco(activo)
  return useQuery({ queryKey: CLAVE_ASIGNACIONES_TODAS, queryFn: pedirTodas, refetchInterval: intervalo })
}

/** Solo se pide con la ventana de carga abierta: no tiene sentido sondearla de fondo. */
export function useCargaTecnicos(habilitada: boolean) {
  return useQuery({
    queryKey: CLAVE_CARGA_TECNICOS,
    queryFn: async (): Promise<CargaTecnicosRespuesta> =>
      (await api.GET('/api/reparaciones/carga-tecnicos')).data ?? { pedidos: [], total: [] },
    enabled: habilitada,
  })
}

/** Para `onSettled`: lanza la recarga de la lista y de la carga, y no la espera. TanStack aguarda la promesa que
 *  devuelve onSettled antes de llamar a los callbacks de cada `mutate`, así que esperarla retrasaría el aviso del
 *  409 hasta después de recargar las tres listas (mismo motivo que useRecargarSinEsperar en taller/api.ts). */
function useRecargar() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: CLAVE_ASIGNACIONES_TODAS })
    void qc.invalidateQueries({ queryKey: CLAVE_CARGA_TECNICOS })
  }
}

/**
 * Reasignar el técnico y editar el comentario son el MISMO endpoint, y el pulido tiene el suyo propio con otro
 * nombre para el comentario. Por eso las dos mutaciones pasan por aquí: la que cambia el técnico manda el
 * comentario actual sin tocarlo, y la que cambia el comentario manda el técnico actual (calco de
 * PendientesSuperTecnicoController, reasignar y guardar comentario).
 *
 * `updatedAt` es el bloqueo optimista de la fila (no el del teléfono, que es `telefonoUpdatedAt`): un 409
 * significa que otro usuario la cambió mientras tanto. UPDATED_AT es NOT NULL en Reparacion, así que el
 * `| null` del contrato no se da en una fila real; si llegara, el servidor responde y la vista avisa, que es
 * mejor que inventar una fecha que pisaría el cambio ajeno.
 */
function guardarAsignacion(fila: ReparacionResumen, idTec: number, comentario: string) {
  const updatedAt = fila.updatedAt ?? ''
  if (tipoDe(fila.idRep) === 'PULIDO') {
    return api.PATCH('/api/pulidos/asignaciones/{idAP}', {
      params: { path: { idAP: fila.idRep } },
      body: { idTec, comentario, updatedAt },
    })
  }
  return api.PATCH('/api/reparaciones/asignaciones/{idRep}', {
    params: { path: { idRep: fila.idRep } },
    body: { idTec, comentarioAsignacion: comentario, updatedAt },
  })
}

/** Reasignar a otro técnico. El comentario viaja tal cual está en la fila ('' si no hay, como el JavaFX). */
export function useReasignar() {
  const recargar = useRecargar()
  return useMutation({
    mutationFn: ({ fila, idTec }: { fila: ReparacionResumen; idTec: number }) =>
      guardarAsignacion(fila, idTec, fila.comentarioAsignacion ?? ''),
    onSettled: recargar,
  })
}

/** Editar el comentario de la asignación, sin cambiar de técnico. */
export function useEditarComentario() {
  const recargar = useRecargar()
  return useMutation({
    mutationFn: ({ fila, comentario }: { fila: ReparacionResumen; comentario: string }) =>
      guardarAsignacion(fila, fila.idTec, comentario),
    onSettled: recargar,
  })
}

/** Urgente y chasis solo existen en reparaciones (el pulido no los tiene, y chasis solo en las A…). */
export function useUrgente() {
  const recargar = useRecargar()
  return useMutation({
    mutationFn: ({ idRep, urgente }: { idRep: string; urgente: boolean }) =>
      api.PATCH('/api/reparaciones/asignaciones/{idRep}/urgente', { params: { path: { idRep } }, body: { urgente } }),
    onSettled: recargar,
  })
}

export function useChasis() {
  const recargar = useRecargar()
  return useMutation({
    mutationFn: ({ idRep, esChasis }: { idRep: string; esChasis: boolean }) =>
      api.PATCH('/api/reparaciones/asignaciones/{idRep}/chasis', { params: { path: { idRep } }, body: { esChasis } }),
    onSettled: recargar,
  })
}

/**
 * Borrar la asignación son tres endpoints distintos según la fila (calco de
 * PendientesSuperTecnicoController): el pulido tiene el suyo; una incidencia no se borra por id sino
 * desactivándola por IMEI (así deja de ser activa también en el historial); y el resto, A… y AG…, van por el
 * borrado de asignación de reparaciones. La vista no pide motivo, así que ninguna manda cuerpo.
 */
function borrarSegunTipo(fila: ReparacionResumen) {
  const tipo = tipoDe(fila.idRep)
  if (tipo === 'PULIDO') {
    return api.DELETE('/api/pulidos/asignaciones/{idAP}', { params: { path: { idAP: fila.idRep } } })
  }
  if (fila.esIncidencia) {
    return api.DELETE('/api/reparaciones/imei/{imei}/incidencia-activa', {
      params: { path: { imei: fila.imei }, query: { tipo: tipo === 'GLASS' ? 'G' : 'R' } },
    })
  }
  return api.DELETE('/api/reparaciones/asignaciones/{idAsig}', { params: { path: { idAsig: fila.idRep } } })
}

export function useBorrarAsignacion() {
  const recargar = useRecargar()
  return useMutation({
    mutationFn: ({ fila }: { fila: ReparacionResumen }) => borrarSegunTipo(fila),
    onSettled: recargar,
  })
}
