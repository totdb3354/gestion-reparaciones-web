import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type CargaTecnicosRespuesta, type ReparacionResumen } from '@/shared/api/client'
import { useIntervaloRefresco } from '@/shared/api/refresco'
import { CLAVE_TECNICOS } from '../api'
import { ordenarPendientes } from '../lib/filtros'
import { tipoDe } from './filtros'
import type { CambioGlass } from './tecnicosGlass'

export const CLAVE_ASIGNACIONES_TODAS = ['asignaciones', 'todas'] as const
export const CLAVE_CARGA_TECNICOS = ['carga-tecnicos'] as const

/** Las tres categorías, SIN ?tecnico=: la vista del supertécnico es la lista completa. Toda llamada que llega
 *  aquí es una respuesta real del servidor, así que de paso vacía `filasOptimistas`: lo que hubiera pintado por
 *  optimismo queda superado, confirmado o corregido por esta carga (ver el comentario de `filasOptimistas`). */
async function pedirTodas(): Promise<ReparacionResumen[]> {
  const [rep, glass, pul] = await Promise.all([
    api.GET('/api/reparaciones/asignaciones'),
    api.GET('/api/glass/asignaciones'),
    api.GET('/api/pulidos/asignaciones'),
  ])
  filasOptimistas.clear()
  return ordenarPendientes([...(rep.data ?? []), ...(glass.data ?? []), ...(pul.data ?? [])])
}

/**
 * Lista unificada de las tres categorías, ya en orden de prioridad (urgentes → con cliente → resto).
 * `activo = false` congela el sondeo mientras hay un menú, un desplegable o un diálogo abiertos (spec 3a,
 * D4): si no, la recarga mueve la fila bajo el cursor y la acción se pierde.
 *
 * `refetchOnWindowFocus` va atado al MISMO interruptor que el intervalo, y no basta con apagar el intervalo: el
 * QueryClient de la app trae `refetchOnWindowFocus: true` y `staleTime: 0` por defecto (política global, no se
 * toca), así que un alt-tab de ida y vuelta con un editor, la confirmación de borrado o una ventana abiertos
 * recargaría y reordenaría la tabla de fondo — justo el daño que D4 evita. Al cerrar lo que hubiera, el foco
 * vuelve a recargar como en el resto de la app.
 */
export function useAsignacionesTodas({ activo = true }: { activo?: boolean } = {}) {
  const intervalo = useIntervaloRefresco(activo)
  return useQuery({
    queryKey: CLAVE_ASIGNACIONES_TODAS,
    queryFn: pedirTodas,
    refetchInterval: intervalo,
    refetchOnWindowFocus: activo,
  })
}

/** Solo se pide con la ventana de carga abierta: no tiene sentido sondearla de fondo.
 *
 *  `silenciarError`: el aviso lo pone la ventana con su propio literal, en el hueco de la lista (spec §14, "la
 *  ventana se abre con un mensaje en vez de la lista, y la tabla no se ve afectada"). Sin esto, la política global
 *  del QueryClient apilaría además su diálogo encima de la ventana y el usuario vería dos avisos del mismo fallo. */
export function useCargaTecnicos(habilitada: boolean) {
  return useQuery({
    queryKey: CLAVE_CARGA_TECNICOS,
    queryFn: async (): Promise<CargaTecnicosRespuesta> =>
      (await api.GET('/api/reparaciones/carga-tecnicos')).data ?? { pedidos: [], total: [] },
    enabled: habilitada,
    meta: { silenciarError: true },
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

/**
 * Filas con una reasignación pintada en la caché por optimismo pero aún SIN confirmar por una respuesta real del
 * servidor. Vive fuera de la caché de TanStack a propósito: la guarda del deshacer (`CeldaTecnicoConectada`,
 * `filaParaDeshacer`) necesita distinguir "el servidor ya dijo que sí" de "lo hemos pintado nosotros mismos, puede
 * que la escritura ni siquiera haya salido todavía", y la caché de la lista, una vez pintada, ya no lleva esa
 * distinción encima. Se vacía entera en cuanto aterriza una respuesta real de `pedirTodas` (éxito o no, da igual
 * qué mutación la disparó): una carga real de la lista es, por definición, la verdad del servidor para cada fila
 * que trae, así que cualquier optimismo pendiente queda superado, confirmado o corregido por ella.
 */
const filasOptimistas = new Map<string, number>()

/** `true` si esta fila tiene una reasignación pintada por optimismo que ninguna respuesta real ha confirmado
 *  todavía. Exportada solo para que la guarda del deshacer la consulte; nadie más debería necesitarla. */
export function tieneReasignacionOptimistaSinConfirmar(idRep: string): boolean {
  return filasOptimistas.has(idRep)
}

/** Reasignar a otro técnico. El comentario viaja tal cual está en la fila ('' si no hay, como el JavaFX).
 *
 * Pintado optimista (paridad con el ComboBox del JavaFX, D2, "reasigna al instante"): el combo de la celda va
 * controlado por `fila.idTec`, así que sin esto el usuario vería la celda volver al técnico anterior hasta que
 * aterrizase la recarga de `onSettled`. `onMutate` pinta el `idTec` nuevo en la caché de la lista y lo marca en
 * `filasOptimistas`; `onError` deshace las dos cosas. `onSettled` (la recarga) sigue siendo la fuente de verdad:
 * no se toca, y es ella —vía `pedirTodas`— la que vacía `filasOptimistas` al traer una respuesta real. */
export function useReasignar() {
  const recargar = useRecargar()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ fila, idTec }: { fila: ReparacionResumen; idTec: number }) =>
      guardarAsignacion(fila, idTec, fila.comentarioAsignacion ?? ''),
    onMutate: async ({ fila, idTec }) => {
      await qc.cancelQueries({ queryKey: CLAVE_ASIGNACIONES_TODAS })
      const previa = qc.getQueryData<ReparacionResumen[]>(CLAVE_ASIGNACIONES_TODAS)
      qc.setQueryData<ReparacionResumen[]>(CLAVE_ASIGNACIONES_TODAS, (actuales) =>
        actuales?.map((f) => (f.idRep === fila.idRep ? { ...f, idTec } : f)))
      filasOptimistas.set(fila.idRep, idTec)
      return { previa, idRep: fila.idRep }
    },
    onError: (_error, _variables, contexto) => {
      if (contexto?.previa) qc.setQueryData(CLAVE_ASIGNACIONES_TODAS, contexto.previa)
      if (contexto) filasOptimistas.delete(contexto.idRep)
    },
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

/**
 * Marcar o desmarcar a un técnico como "de glass" (a quién se le asigna la glass automáticamente). Una llamada
 * por técnico: el contrato no tiene un endpoint que acepte la lista entera, y el JavaFX también va de uno en uno.
 *
 * El cuerpo se llama `habilitado`, NO `esGlass`: `esGlass` es el campo del técnico que se lee y `habilitado` el
 * que se escribe (TecnicoGlassRequest del contrato). Son nombres distintos para el mismo dato, y confundirlos
 * manda un cuerpo que el servidor ignora en silencio.
 *
 * `silenciarError`: el diálogo pinta el fallo en su propio hueco y NO se cierra, para que el usuario reintente;
 * sin esto la política global del QueryClient apilaría además su diálogo encima y se verían dos avisos del mismo
 * fallo (mismo motivo que en `useCargaTecnicos`). El corte de conexión sí lo sigue avisando la política global.
 *
 * Recarga la lista de técnicos porque es la fuente de verdad de los checks: tras un fallo parcial (unas
 * peticiones bien y otras mal) es lo único que distingue lo que de verdad quedó guardado de lo que no.
 *
 * `onSettled` DEVUELVE la promesa de `invalidateQueries` (no `void`): TanStack no resuelve `mutateAsync` hasta
 * que la promesa de `onSettled` se cumple, así que devolverla es lo que hace que el refetch haya aterrizado
 * ANTES de que quien llamó a `mutateAsync` siga adelante. A diferencia de `useRecargar` (taller/asignaciones,
 * las mutaciones de la tabla), aquí sí interesa esperar: `TecnicosGlassDialog.aceptar` necesita que la caché de
 * `useTecnicos` esté ya al día en el momento en que descarta `marcados` tras un fallo parcial, o repintaría un
 * instante desde la caché vieja.
 */
export function useMarcarTecnicoGlass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ idTec, habilitado }: CambioGlass) =>
      api.PATCH('/api/tecnicos/{idTec}/glass', { params: { path: { idTec } }, body: { habilitado } }),
    meta: { silenciarError: true },
    // CLAVE_TECNICOS es prefijo de CLAVE_TECNICOS_ACTIVOS, así que invalidar aquí recarga las dos listas.
    onSettled: () => qc.invalidateQueries({ queryKey: CLAVE_TECNICOS }),
  })
}
