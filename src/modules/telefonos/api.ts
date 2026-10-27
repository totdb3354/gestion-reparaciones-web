import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import {
  api, type EstadoNsys, type ListaImportaciones, type MovilComprobado, type MovilStock, type PeticionDeshacerHecho,
  type PeticionDescarte, type PeticionDeshacerDescarte, type PeticionHecho, type TarjetasPorPasar,
} from '@/shared/api/client'
import { CLAVE_RASTRO_MOVIL, CLAVE_STOCK_TELEFONOS, CLAVE_TARJETAS_NSYS } from '@/shared/api/nsys'
import { useIntervaloRefresco } from '@/shared/api/refresco'
import { descargarBlob, nombreDeDescarga } from '@/shared/lib/descargas'

export const CLAVE_ESTADO_NSYS = ['telefonos', 'estado'] as const
export const CLAVE_IMPORTACIONES_NSYS = ['telefonos', 'importaciones'] as const
/** Como mucho los IMEIs que se comprueban de una vez (spec 0.9.18 §4.9; el servidor da 400 por encima). */
export const MAX_IMEIS = 500

/** GET /api/stock-telefonos: los móviles que están en la empresa, con sus trabajos abiertos (0.9.18) y lo que vale del taller
 *  (0.9.21). Los filtros se aplican en la pantalla (spec §8). Sondea como las demás vistas: la importación trae datos nuevos
 *  cada 5 min. */
export function useStockTelefonos(): UseQueryResult<MovilStock[]> {
  const intervalo = useIntervaloRefresco(true)
  return useQuery({
    queryKey: CLAVE_STOCK_TELEFONOS,
    queryFn: async () => (await api.GET('/api/stock-telefonos')).data ?? [],
    refetchInterval: intervalo,
  })
}

/** GET /api/stock-telefonos/estado: hora de la última exportación de NSYS y nivel del aviso. Sin capa de carga ni diálogo
 *  de error: lo enseñan la píldora de la cabecera («no se pudo comprobar») y, desde la 0.9.18, el indicador de la barra
 *  superior en todas las vistas. `activo`: el indicador solo pregunta para SUPERTECNICO y ADMIN (al TECNICO le daría 403). */
export function useEstadoNsys(activo = true): UseQueryResult<EstadoNsys | null> {
  const intervalo = useIntervaloRefresco(activo)
  return useQuery({
    queryKey: CLAVE_ESTADO_NSYS,
    enabled: activo,
    queryFn: async () => (await api.GET('/api/stock-telefonos/estado')).data ?? null,
    refetchInterval: intervalo,
    meta: { sinCapa: true, silenciarError: true },
  })
}

/** GET /api/stock-telefonos/importaciones (spec 0.9.18 §4.11): las 20 últimas del Items actual y el progreso del histórico.
 *  Lo monta el popover de la píldora solo mientras está abierto: pide al abrirse (`refetchOnMount: 'always'`) y no vuelve a
 *  pedir mientras sigue abierto (sin sondeo ni recarga por foco); `gcTime: 0` olvida la respuesta al cerrarlo. */
export function useImportacionesNsys(): UseQueryResult<ListaImportaciones | null> {
  return useQuery({
    queryKey: CLAVE_IMPORTACIONES_NSYS,
    queryFn: async () => (await api.GET('/api/stock-telefonos/importaciones', { params: { query: { limite: 20 } } })).data ?? null,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    meta: { sinCapa: true, silenciarError: true },
  })
}

/** POST /api/stock-telefonos/comprobar (spec 0.9.18 §4.9): una entrada por IMEI pedido. Es una lectura, así que va como
 *  consulta (sin Idempotency-Key ni invalidaciones): sale sola al cambiar la lista y no pregunta sin IMEIs ni con más de
 *  {@link MAX_IMEIS}. El diálogo enseña «Comprobando…» en vez de la capa de carga. */
export function useComprobarImeis(imeis: string[]): UseQueryResult<MovilComprobado[]> {
  return useQuery({
    queryKey: ['telefonos', 'comprobar', imeis],
    enabled: imeis.length > 0 && imeis.length <= MAX_IMEIS,
    queryFn: async () => (await api.POST('/api/stock-telefonos/comprobar', { body: { imeis } })).data ?? [],
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    meta: { sinCapa: true },
  })
}

/** GET /api/stock-telefonos/por-pasar/tarjetas (spec 0.9.22 §3): las cuatro tarjetas, para la pestaña y su número. Sondea como
 *  el stock: las filas se van solas con cada importación. */
export function usePorPasarTarjetas(): UseQueryResult<TarjetasPorPasar | null> {
  const intervalo = useIntervaloRefresco(true)
  return useQuery({
    queryKey: CLAVE_TARJETAS_NSYS,
    queryFn: async () => (await api.GET('/api/stock-telefonos/por-pasar/tarjetas')).data ?? null,
    refetchInterval: intervalo,
    meta: { sinCapa: true },
  })
}

/** Tras «Hecho», «deshacer» o «Revisado», bien o mal: las tarjetas y, con «Revisado», el rastro de los IMEIs (lo cuenta). */
function useRecargarTarjetas(conRastro: boolean): () => void {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: CLAVE_TARJETAS_NSYS })
    if (conRastro) void qc.invalidateQueries({ queryKey: CLAVE_RASTRO_MOVIL })
  }
}

/** PUT /api/stock-telefonos/por-pasar/hecho (spec 0.9.22 §3.6): «Hecho» de una fila o «Marcar todo» de una tarjeta. */
export function useMarcarHecho() {
  const recargar = useRecargarTarjetas(false)
  return useMutation({
    mutationFn: (cuerpo: PeticionHecho) => api.PUT('/api/stock-telefonos/por-pasar/hecho', { body: cuerpo }),
    onSettled: recargar,
  })
}

/** DELETE /api/stock-telefonos/por-pasar/hecho: «deshacer» de una marca. */
export function useDeshacerHecho() {
  const recargar = useRecargarTarjetas(false)
  return useMutation({
    mutationFn: (cuerpo: PeticionDeshacerHecho) => api.DELETE('/api/stock-telefonos/por-pasar/hecho', { body: cuerpo }),
    onSettled: recargar,
  })
}

/** POST /api/stock-telefonos/por-pasar/avisos/{idAviso}/revisado (spec 0.9.22 §3.5): el aviso estaba bien y sale de la lista. */
export function useRevisarAviso() {
  const recargar = useRecargarTarjetas(true)
  return useMutation({
    mutationFn: (idAviso: number) =>
      api.POST('/api/stock-telefonos/por-pasar/avisos/{idAviso}/revisado', { params: { path: { idAviso } } }),
    onSettled: recargar,
  })
}

/** PUT /api/stock-telefonos/por-pasar/descarte (spec 0.9.22 pieza 3 §4.3): «descartar» de «No está en NSYS», con motivo. */
export function useDescartarAlta() {
  const recargar = useRecargarTarjetas(false)
  return useMutation({
    mutationFn: (cuerpo: PeticionDescarte) => api.PUT('/api/stock-telefonos/por-pasar/descarte', { body: cuerpo }),
    onSettled: recargar,
  })
}

/** DELETE /api/stock-telefonos/por-pasar/descarte: «deshacer» desde «Ver descartados». */
export function useDeshacerDescarte() {
  const recargar = useRecargarTarjetas(false)
  return useMutation({
    mutationFn: (cuerpo: PeticionDeshacerDescarte) => api.DELETE('/api/stock-telefonos/por-pasar/descarte', { body: cuerpo }),
    onSettled: recargar,
  })
}

export type Plantilla = 'color' | 'altas'
export type Descarga = { nombre: string; filas: number }

/** GET …/por-pasar/plantilla-color o …/plantilla-altas (spec 0.9.22 §4): el Excel lo hace el servidor; aquí se guarda con el
 *  nombre que manda (Content-Disposition) y se devuelve cuántos móviles lleva (cabecera X-Filas). Un error sale en el diálogo de
 *  siempre. */
export function useDescargarPlantilla() {
  return useMutation({
    mutationFn: async (cual: Plantilla): Promise<Descarga> => {
      const { data, response } = cual === 'color'
        ? await api.GET('/api/stock-telefonos/por-pasar/plantilla-color', { parseAs: 'blob' })
        : await api.GET('/api/stock-telefonos/por-pasar/plantilla-altas', { parseAs: 'blob' })
      const nombre = nombreDeDescarga(response.headers.get('Content-Disposition')) ?? `NSYS_${cual}.xlsx`
      if (data) descargarBlob(data, nombre)
      return { nombre, filas: Number(response.headers.get('X-Filas') ?? '0') }
    },
  })
}
