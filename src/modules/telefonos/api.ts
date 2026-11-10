import { keepPreviousData, useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import {
  api, type FuentePedidosVista, type ListaImportaciones, type MovilComprobado, type MovilStock, type PeticionDeshacerHecho,
  type PedidoVista, type PeticionDescarte, type PeticionDeshacerDescarte, type PeticionExcel, type PeticionHecho,
  type PeticionIgnorado, type TarjetasPorPasar,
} from '@/shared/api/client'
import { CLAVE_RASTRO_MOVIL, CLAVE_STOCK_TELEFONOS, CLAVE_TARJETAS_NSYS, MAX_IMEIS } from '@/shared/api/nsys'
import { useIntervaloRefresco } from '@/shared/api/refresco'
import { guardarEn, nombreDeDescarga, type TipoFichero } from '@/shared/lib/descargas'
import { hoyMadrid } from '@/shared/lib/fechas'

export const CLAVE_IMPORTACIONES_NSYS = ['telefonos', 'importaciones'] as const
/** 0.9.23: el estado de NSYS y el tope de IMEIs viven en `shared` (también los usa el modal de asignación del taller); se
 *  reexportan para el resto del módulo. */
export { CLAVE_ESTADO_NSYS, MAX_IMEIS, useEstadoNsys } from '@/shared/api/nsys'

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

/** PUT /api/stock-telefonos/por-pasar/ignorado (0.9.27 §4.3): «ignorar» de una fila ámbar, sin motivo. */
export function useIgnorarVuelta() {
  const recargar = useRecargarTarjetas(false)
  return useMutation({
    mutationFn: (cuerpo: PeticionIgnorado) => api.PUT('/api/stock-telefonos/por-pasar/ignorado', { body: cuerpo }),
    onSettled: recargar,
  })
}

/** DELETE /api/stock-telefonos/por-pasar/ignorado: «deshacer» desde «Ver ignorados». */
export function useDeshacerIgnorado() {
  const recargar = useRecargarTarjetas(false)
  return useMutation({
    mutationFn: (cuerpo: PeticionIgnorado) => api.DELETE('/api/stock-telefonos/por-pasar/ignorado', { body: cuerpo }),
    onSettled: recargar,
  })
}

export type Plantilla = 'color' | 'altas'
export type Descarga = { nombre: string; filas: number }

export const TIPO_XLSX: TipoFichero = { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: '.xlsx' }

/** El nombre que pone el servidor a una plantilla (`NSYS_color_2026-11-03.xlsx`, fecha de Madrid): el que propone «Guardar como». */
export const nombrePlantilla = (cual: Plantilla, ahora: Date = new Date()): string => `NSYS_${cual}_${hoyMadrid(ahora)}.xlsx`

/** GET …/por-pasar/plantilla-color o …/plantilla-altas (spec 0.9.22 §4): el Excel lo hace el servidor; aquí se guarda en
 *  `destino`, el fichero que se eligió en «Guardar como» antes de llamar (0.9.22.1, elegirDestino), o sin él con el nombre que
 *  manda (Content-Disposition) en la carpeta de descargas. Devuelve con qué nombre se guardó y cuántos móviles lleva (cabecera
 *  X-Filas). Un error sale en el diálogo de siempre. */
export function useDescargarPlantilla() {
  return useMutation({
    mutationFn: async ({ cual, destino }: { cual: Plantilla; destino: FileSystemFileHandle | null }): Promise<Descarga> => {
      const { data, response } = cual === 'color'
        ? await api.GET('/api/stock-telefonos/por-pasar/plantilla-color', { parseAs: 'blob' })
        : await api.GET('/api/stock-telefonos/por-pasar/plantilla-altas', { parseAs: 'blob' })
      const nombre = nombreDeDescarga(response.headers.get('Content-Disposition')) ?? nombrePlantilla(cual)
      const guardado = data ? await guardarEn(destino, { blob: data, nombre }) : nombre
      return { nombre: guardado, filas: Number(response.headers.get('X-Filas') ?? '0') }
    },
  })
}

/** POST /api/stock-telefonos/que-revisar/excel (spec 0.9.25 «Qué revisar» §10.3): el servidor convierte la hoja en un xlsx para
 *  imprimir; aquí se guarda en `destino`, el fichero elegido en «Guardar como» antes de llamar (elegirDestino), o sin él con
 *  `nombre` en la carpeta de descargas. Devuelve con qué nombre se guardó. Un error sale en el diálogo de siempre. */
export function useDescargarExcel() {
  return useMutation({
    mutationFn: async ({ hoja, nombre, destino }: { hoja: PeticionExcel; nombre: string; destino: FileSystemFileHandle | null }): Promise<string> => {
      const { data } = await api.POST('/api/stock-telefonos/que-revisar/excel', { body: hoja, parseAs: 'blob' })
      return data ? guardarEn(destino, { blob: data, nombre }) : nombre
    },
  })
}

export const CLAVE_PEDIDOS = ['telefonos', 'pedidos'] as const
export const CLAVE_FUENTES_PEDIDOS = ['telefonos', 'pedidos', 'fuentes'] as const

/** GET /api/pedidos (spec pieza 2 §8): los pedidos abiertos con el estado de cada unidad. Sondea como las demás vistas.
 *  `viejos`: también los del Simulador fuera de la ventana. */
export function usePedidos(viejos: boolean): UseQueryResult<PedidoVista[]> {
  const intervalo = useIntervaloRefresco(true)
  return useQuery({
    queryKey: [...CLAVE_PEDIDOS, { viejos }],
    queryFn: async () => (await api.GET('/api/pedidos', { params: { query: { viejos } } })).data ?? [],
    refetchInterval: intervalo,
    // El interruptor «viejos» cambia la clave: sin esto la lista se queda en blanco hasta que llega la nueva.
    placeholderData: keepPreviousData,
  })
}

/** GET /api/pedidos/fuentes: las tres fuentes para la píldora. */
export function useFuentesPedidos(): UseQueryResult<FuentePedidosVista[]> {
  const intervalo = useIntervaloRefresco(true)
  return useQuery({
    queryKey: CLAVE_FUENTES_PEDIDOS,
    queryFn: async () => (await api.GET('/api/pedidos/fuentes')).data ?? [],
    refetchInterval: intervalo,
    meta: { sinCapa: true },
  })
}
