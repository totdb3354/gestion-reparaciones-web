import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient, type UseQueryResult } from '@tanstack/react-query'
import {
  api, type CambioImei, type Candidato, type FilaVista, type FuenteVista, type ListaFilas, type ListaImportaciones, type MovilComprobado, type MovilStock, type PeticionDeshacerHecho,
  type PeticionDescarte, type PeticionDeshacerDescarte, type PeticionExcel, type PeticionHecho, type PeticionIgnorado, type TarjetasPorPasar,
} from '@/shared/api/client'
import { CLAVE_RASTRO_MOVIL, CLAVE_STOCK_TELEFONOS, CLAVE_TARJETAS_NSYS, MAX_IMEIS } from '@/shared/api/nsys'
import { ApiError, StaleDataError } from '@/shared/api/errors'
import { useIntervaloRefresco } from '@/shared/api/refresco'
import { guardarEn, nombreDeDescarga, type TipoFichero } from '@/shared/lib/descargas'
import { hoyMadrid } from '@/shared/lib/fechas'
import { leerSesion } from '@/shared/session/storage'

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

/** GET /api/stock-telefonos/por-pasar/tarjetas (spec 0.9.22 §3): las cinco tarjetas, para la pestaña y su número. Sondea como
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

/** Pedidos como la hoja (Teléfonos › Pedidos): todas las filas viven bajo esta clave. */
export const CLAVE_FILAS = ['telefonos', 'pedidos', 'filas'] as const
export const CLAVE_FUENTES_PEDIDOS = ['telefonos', 'pedidos', 'fuentes'] as const

/** GET /api/pedidos/filas: las filas del intervalo de fechas, filtradas por `buscar` (el servidor dice si hay más). Sondea como
 *  las demás vistas; al cambiar el intervalo o la búsqueda deja la lista anterior hasta que llega la nueva (`isPlaceholderData`,
 *  que la página enseña como «Buscando…»). Solo la primera carga usa la capa de carga global: las siguientes no, porque la capa
 *  se traga las teclas que el usuario sigue escribiendo en el buscador. */
export function useFilas(p: { desde: string; hasta: string; buscar?: string }): UseQueryResult<ListaFilas> {
  const intervalo = useIntervaloRefresco(true)
  const qc = useQueryClient()
  // Ya hubo una carga con datos (de cualquier búsqueda o periodo): las siguientes no encienden la capa.
  const yaCargo = qc.getQueryCache().findAll({ queryKey: [...CLAVE_FILAS, 'lista'] }).some((q) => q.state.data !== undefined)
  // Una búsqueda vacía o en blanco no se manda: el servidor la tomaría por una búsqueda.
  const query = { desde: p.desde, hasta: p.hasta, buscar: p.buscar?.trim() ? p.buscar : undefined }
  return useQuery({
    queryKey: [...CLAVE_FILAS, 'lista', query],
    queryFn: async ({ signal }) => (await api.GET('/api/pedidos/filas', { params: { query }, signal })).data ?? { filas: [], hayMas: false },
    refetchInterval: intervalo,
    placeholderData: keepPreviousData,
    meta: yaCargo ? { sinCapa: true } : undefined,
  })
}

/** GET /api/pedidos/filas/{id}/recomendados: los IMEI que el servidor propone para una fila; sin fila no pregunta. `gcTime: 0`:
 *  al reabrir una fila se piden de nuevo (los de antes pueden estar ya en otra fila). */
export function useRecomendados(idFila: number | null, activo = true): UseQueryResult<Candidato[]> {
  return useQuery({
    queryKey: [...CLAVE_FILAS, 'recomendados', idFila],
    enabled: idFila != null && activo,
    queryFn: async ({ signal }) => (await api.GET('/api/pedidos/filas/{id}/recomendados', { params: { path: { id: idFila as number } }, signal })).data ?? [],
    gcTime: 0,
    meta: { sinCapa: true },
  })
}

/** GET /api/pedidos/filas/{id}/cambios: quién ha puesto, cambiado o quitado el IMEI de una fila, del más reciente al más antiguo (vacía
 *  en el histórico). Sin `idFila` no pregunta (el panel cerrado, o una fila del histórico). Cuelga de `CLAVE_FILAS`: `usePonerImei`
 *  invalida ese prefijo al terminar, así que tras guardar un IMEI en la fila se vuelve a pedir. Un fallo se enseña en el panel,
 *  no en el diálogo global. */
export function useCambiosImei(idFila: number | null): UseQueryResult<CambioImei[]> {
  return useQuery({
    queryKey: [...CLAVE_FILAS, 'cambios', idFila],
    enabled: idFila != null,
    queryFn: async ({ signal }) => (await api.GET('/api/pedidos/filas/{id}/cambios', { params: { path: { id: idFila as number } }, signal })).data ?? [],
    meta: { sinCapa: true, silenciarError: true },
  })
}

/** GET /api/pedidos/filas/{id}/etiqueta: el PDF de la etiqueta de la fila, como Blob (sale con el token de la sesión como cualquier
 *  llamada). Solo vive mientras el diálogo de previsualización está abierto (`gcTime` y `staleTime` a 0: no se guarda en la
 *  caché más allá de eso) y un fallo se enseña dentro del diálogo, no en el global. El cliente descarta el cuerpo de los errores,
 *  así que el texto sale del estado: 404 (sin etiqueta o fila que no existe) y 502 (ShippyPro no la dio); el resto lo dice el diálogo con su texto genérico. */
export function useEtiquetaPdf(idFila: number): UseQueryResult<Blob> {
  return useQuery({
    queryKey: [...CLAVE_FILAS, 'etiqueta', idFila],
    queryFn: async ({ signal }) => {
      try {
        const { data } = await api.GET('/api/pedidos/filas/{id}/etiqueta', { params: { path: { id: idFila } }, parseAs: 'blob', signal })
        if (!data) throw new Error('El servidor no devolvió la etiqueta')
        return data as Blob
      } catch (e) {
        const estado = e instanceof ApiError ? e.status : 0
        if (estado === 404) throw new Error(MSG_ETIQUETA_SIN, { cause: e })
        if (estado === 502) throw new Error(MSG_ETIQUETA_SHIPPYPRO, { cause: e })
        throw e
      }
    },
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
    meta: { sinCapa: true, silenciarError: true },
  })
}

export const MSG_ETIQUETA_SIN = 'Este pedido no tiene etiqueta generada'
export const MSG_ETIQUETA_SHIPPYPRO = 'No se pudo obtener la etiqueta de ShippyPro. Inténtalo de nuevo.'

/** Ahora, hora local, con el formato que da la API («2026-11-12T09:12:00»). */
function ahoraLocal(): string {
  const d = new Date()
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`
}

/** Lo que se espera tras el último guardado de un IMEI antes de recargar las filas: con muchas lecturas seguidas (y el periodo «Todo»,
 *  ~26.000 filas) se recarga UNA vez, no tras cada una. */
export const RECARGA_TRAS_GUARDAR_MS = 1500
const recargasPendientes = new WeakMap<QueryClient, ReturnType<typeof setTimeout>>()
/** Un temporizador por QueryClient, compartido entre guardados: cada guardado lo reinicia. */
function recargarFilasTrasEspera(qc: QueryClient) {
  const previo = recargasPendientes.get(qc)
  if (previo !== undefined) clearTimeout(previo)
  recargasPendientes.set(qc, setTimeout(() => {
    recargasPendientes.delete(qc)
    void qc.invalidateQueries({ queryKey: CLAVE_FILAS })
  }, RECARGA_TRAS_GUARDAR_MS))
}

/** Escribe la fila que devolvió el servidor en las listas de la caché (la celda y el panel la enseñan al momento) y, si `apunte`
 *  da un cambio (a partir de la fila tal como estaba en la caché), lo antepone a la lista de cambios de la fila, si el panel la tiene
 *  en la caché (si nunca se abrió, no hay nada que adelantar). Un sondeo que salió antes del guardado y aún no ha vuelto traería la fila
 *  con su valor viejo y la pisaría: se cancela antes (solo las listas que ya tienen datos; una primera carga no se toca). */
async function escribirFila(qc: QueryClient, fila: FilaVista, apunte: (previa: FilaVista | undefined) => CambioImei | null) {
  await qc.cancelQueries({ queryKey: [...CLAVE_FILAS, 'lista'], predicate: (q) => q.state.data !== undefined })
  let previa: FilaVista | undefined
  for (const [, l] of qc.getQueriesData<ListaFilas>({ queryKey: [...CLAVE_FILAS, 'lista'] })) {
    previa = l?.filas.find((f) => f.idFila === fila.idFila)
    if (previa) break
  }
  const nuevo = apunte(previa)
  if (nuevo) qc.setQueryData<CambioImei[]>([...CLAVE_FILAS, 'cambios', fila.idFila], (c) => (c ? [nuevo, ...c] : c))
  qc.setQueriesData<ListaFilas>({ queryKey: [...CLAVE_FILAS, 'lista'] },
    (l) => (l ? { ...l, filas: l.filas.map((f) => (f.idFila === fila.idFila ? fila : f)) } : l))
}

/** PUT /api/pedidos/filas/{id}/imei: pone (o quita, con null) el IMEI de una fila. `clave` va en la cabecera Idempotency-Key (la da
 *  el desplegable con crearClavesIdempotencia). `imeiAnterior` es el IMEI que la fila tenía en pantalla al abrir la celda (`''` si no
 *  tenía): el servidor responde 409 si otra persona lo cambió entre medias. Al responder, la fila devuelta se escribe en las listas de
 *  la caché para que la celda enseñe el IMEI al momento; las filas se recargan una sola vez, {@link RECARGA_TRAS_GUARDAR_MS} después
 *  del último guardado (el aviso de las demás filas depende de esta).
 *
 *  Un fallo no abre el diálogo global (ni el de conexión): lo enseña la pantalla de Pedidos sin modal, en la celda y en un aviso. */
export function usePonerImei() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ idFila, imei, imeiAnterior, clave }: { idFila: number; imei: string | null; imeiAnterior: string; clave: string }): Promise<FilaVista> => {
      const { data } = await api.PUT('/api/pedidos/filas/{id}/imei', {
        params: { path: { id: idFila }, header: { 'Idempotency-Key': clave } }, body: { imei, imeiAnterior },
      })
      if (!data) throw new Error('El servidor no devolvió la fila')
      return data
    },
    meta: { silenciarError: true, silenciarConexion: true },
    onSuccess: (fila) => escribirFila(qc, fila, (previa) => {
      // El panel de la fila enseña el cambio al momento. El IMEI que tenía la fila antes de esta escritura lo dice la lista en caché.
      if ((previa?.imei ?? null) === fila.imei) return null
      return { usuario: leerSesion()?.nombreUsuario ?? null, fecha: ahoraLocal(), imeiAnterior: previa?.imei ?? null, imeiNuevo: fila.imei, tipo: 'IMEI' }
    }),
    // Un 409 (otra persona cambió el IMEI) no se reintenta con el mismo `imeiAnterior`: se recargan las filas en el acto para ver
    // el IMEI que puso la otra persona (la espera de `onSettled` sería innecesaria).
    onError: (e) => { if (e instanceof StaleDataError) void qc.invalidateQueries({ queryKey: CLAVE_FILAS }) },
    onSettled: () => { recargarFilasTrasEspera(qc) },
  })
}

/** PUT /api/pedidos/filas/{id}/falta-enviar: pone (`falta: true`) o quita la marca «falta por enviar» de una fila de web con la etiqueta
 *  generada (un envío parcial: el pedido sale por partes). `clave` va en la cabecera Idempotency-Key. Como el guardado del IMEI, escribe
 *  la fila devuelta en las listas de la caché, adelanta el apunte en el historial del panel y recarga las filas una sola vez. Un 409
 *  (no se puede marcar, o es histórico) o un 404 salen por la vía normal de errores, con el mensaje del servidor. */
export function useFaltaEnviar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ idFila, falta, clave }: { idFila: number; falta: boolean; clave: string }): Promise<FilaVista> => {
      const { data } = await api.PUT('/api/pedidos/filas/{id}/falta-enviar', {
        params: { path: { id: idFila }, header: { 'Idempotency-Key': clave } }, body: { falta },
      })
      if (!data) throw new Error('El servidor no devolvió la fila')
      return data
    },
    onSuccess: (fila) => escribirFila(qc, fila, (previa) => {
      const antes = previa?.faltaEnviarEn != null
      const ahora = fila.faltaEnviarEn != null
      if (antes === ahora) return null
      return { usuario: leerSesion()?.nombreUsuario ?? null, fecha: ahoraLocal(), imeiAnterior: null, imeiNuevo: null, tipo: ahora ? 'FALTA_ENVIAR' : 'YA_ENVIADO' }
    }),
    onSettled: () => { recargarFilasTrasEspera(qc) },
  })
}

/** GET /api/pedidos/fuentes: de dónde vienen los pedidos y cuándo se leyó cada fuente por última vez (la píldora). */
export function useFuentesPedidos(): UseQueryResult<FuenteVista[]> {
  const intervalo = useIntervaloRefresco(true)
  return useQuery({
    queryKey: CLAVE_FUENTES_PEDIDOS,
    queryFn: async ({ signal }) => (await api.GET('/api/pedidos/fuentes', { signal })).data ?? [],
    refetchInterval: intervalo,
    meta: { sinCapa: true },
  })
}
