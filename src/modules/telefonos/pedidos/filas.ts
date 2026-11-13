import type { FilaVista } from '@/shared/api/client'
import { hoyMadrid } from '@/shared/lib/fechas'

/** Las columnas de la tabla, con los nombres de la hoja (sin letras). */
export const COLUMNAS = ['Fecha', 'Plataforma', 'SKU', 'IMEI', 'Pedido', 'Enviado', 'Fecha compra'] as const

/** Lo que cada recomendado dice de sí mismo respecto al pedido (nivel 1 = el mejor). */
export const TEXTO_NIVEL: Record<1 | 2 | 3, string> = {
  1: 'igual que el pedido',
  2: 'en el taller, acabará igual',
  3: 'hay que transformarlo',
}

/** El motivo del aviso de una fila en palabras; con `skuMovil`, dice qué es el móvil. Sin motivo conocido, null. */
export function textoMotivo(f: FilaVista): string | null {
  const es = f.skuMovil ? `: es ${f.skuMovil}` : ''
  switch (f.motivo) {
    case 'NO_EN_NSYS': return 'no está en NSYS'
    case 'EN_OTRA_FILA': return 'ya está en otro pedido'
    case 'MODELO': return `otro modelo, capacidad o eSIM${es}`
    case 'COLOR_O_GRADO': return `otro color o grado${es}`
    case 'GRADO_NO_VENDIBLE': return 'ese grado no se vende'
    case 'SKU_DESCONOCIDO': return 'el maestro no conoce este SKU'
    case 'EN_TALLER': return 'en el taller'
    case 'MS': return 'es un Ms'
    case 'B_POR_A': return 'B por A'
    // Un motivo que la web aún no conoce: el color nunca es la única señal.
    default: return f.motivo ? 'revisar' : null
  }
}

/** El estado de una fila que calcula el servidor (el contrato lo tipa como texto). */
export type EstadoFila = 'PENDIENTE' | 'ENVIADA' | 'NO_PENDIENTE' | 'HISTORICO'

export function estadoDe(f: FilaVista): EstadoFila {
  switch (f.estado) {
    case 'ENVIADA':
    case 'NO_PENDIENTE':
    case 'HISTORICO': return f.estado
    // PENDIENTE y cualquier valor que la web aún no conozca: se trata como pendiente.
    default: return 'PENDIENTE'
  }
}

/** El estado que ve el usuario en la columna «Enviado»: el del servidor, con ENVIADA partida en «etiqueta generada» (la etiqueta
 *  existe pero no se ha impreso: el móvil sigue en el almacén) y «enviado» (la etiqueta se imprimió). */
export type EstadoPantalla = 'PENDIENTE' | 'FALTA_ENVIAR' | 'GENERADA' | 'ENVIADO' | 'NO_PENDIENTE' | 'HISTORICO'

/** El estado de pantalla de una fila (una comparación por fila; sin trabajo extra). Una enviada con la marca «falta por enviar» (un
 *  envío parcial de web) es `FALTA_ENVIAR`; con otro estado del servidor la marca se ignora (un pedido reabierto vuelve a pendiente). */
export function estadoPantalla(f: FilaVista): EstadoPantalla {
  const e = estadoDe(f)
  if (e !== 'ENVIADA') return e
  return f.faltaEnviarEn ? 'FALTA_ENVIAR' : f.impresaEn ? 'ENVIADO' : 'GENERADA'
}

/** Cuenta como pendiente: lo está en el servidor, o es un envío parcial al que aún le falta un móvil por salir. */
export function esPendiente(f: FilaVista): boolean {
  const e = estadoPantalla(f)
  return e === 'PENDIENTE' || e === 'FALTA_ENVIAR'
}

/** Las tiendas web (el plugin de la web sincroniza sus envíos): solo en ellas se puede marcar «falta por enviar». */
const CANALES_WEB = new Set(['DISTRIBUIDORES', 'PARTICULARES', 'BACKIPHONE'])
export const esCanalWeb = (f: FilaVista): boolean => f.canal != null && CANALES_WEB.has(f.canal)

/** El número de cada fila dentro de su pedido de varios móviles: «1/3», «2/3»… en el orden de la lista. Solo cuentan las filas con
 *  `canal` y `pedido` (el histórico no) y los pedidos de más de una fila; las demás no salen en el mapa. Una pasada por cambio de filas. */
export function numerosDePedido(filas: FilaVista[]): Map<number, string> {
  const grupos = new Map<string, number[]>()
  for (const f of filas) {
    if (estadoDe(f) === 'HISTORICO' || !f.canal || !f.pedido) continue
    const clave = `${f.canal}|${f.pedido}`
    const g = grupos.get(clave)
    if (g) g.push(f.idFila); else grupos.set(clave, [f.idFila])
  }
  const r = new Map<number, string>()
  for (const g of grupos.values()) {
    if (g.length > 1) g.forEach((id, i) => r.set(id, `${i + 1}/${g.length}`))
  }
  return r
}

/** El transportista como lo lee el usuario: sin el sufijo técnico de ShippyPro («UPSv2» → «UPS», «GLSSpain» → «GLS»). */
export const nombreTransportista = (t: string): string => t.replace(/(v2|Spain)$/, '')

/** El transportista y el seguimiento de una enviada, o lo que haya de los dos; sin nada, undefined. Con `separador` « · » es el
 *  título de la celda «Enviado»; con « », lo que se ve tras la fecha. */
export function detalleEnvio(f: FilaVista, separador = ' · '): string | undefined {
  const partes = [f.transportista ? nombreTransportista(f.transportista) : null, f.seguimiento].filter((x): x is string => !!x)
  return partes.length > 0 ? partes.join(separador) : undefined
}

/** El tono de toda la fila: gris solo en el histórico (lo único que no se puede editar). El resto de estados se lee en la etiqueta
 *  de la columna «Enviado», no en el color de la fila. */
export function tonoFila(f: FilaVista): 'gris' | null {
  return estadoDe(f) === 'HISTORICO' ? 'gris' : null
}

/** Las clases del fondo (y el texto) del tono de la fila. */
export const CLASE_TONO: Record<'gris', string> = {
  gris: 'bg-[#fafbfc] text-[#8b93a1]',
}

/** Cómo se pinta la celda del IMEI: vacía, o por el nivel que dice el servidor (solo lo manda en pendientes y no pendientes). */
export function claseCelda(f: FilaVista): 'vacia' | 'ok' | 'aviso' | 'mal' {
  if (!f.imei) return 'vacia'
  if (f.nivel === 'AVISO') return 'aviso'
  if (f.nivel === 'MAL') return 'mal'
  return 'ok'
}

/** Las filas cuyo IMEI no cuadra con el pedido (la celda en naranja). */
export const noCuadra = (f: FilaVista): boolean => f.nivel === 'MAL'

export type Recuento = { total: number; pendientes: number; sinImei: number; noCuadran: number }

/** Los contadores de la cabecera: todas las filas, las pendientes, las editables que aún no tienen IMEI (enviadas incluidas) y las
 *  que no cuadran. Una sola pasada. */
export function recuento(filas: FilaVista[]): Recuento {
  const r: Recuento = { total: filas.length, pendientes: 0, sinImei: 0, noCuadran: 0 }
  for (const f of filas) {
    if (esPendiente(f)) r.pendientes++
    if (f.editable && !f.imei) r.sinImei++
    if (noCuadra(f)) r.noCuadran++
  }
  return r
}

/** El día de hace `n` meses respecto de `hoy` (`YYYY-MM-DD`): el mismo día de ese mes, o el último si no existe (31 de marzo
 *  menos un mes → 28 o 29 de febrero). */
export function haceMeses(hoy: string, n: number): string {
  const [a, m, d] = hoy.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m - n, 0)).getUTCDate()
  return new Date(Date.UTC(a, m - 1 - n, Math.min(d, ultimo))).toISOString().slice(0, 10)
}

/** El primer día del periodo «el último mes» que acaba en `hoy` (`YYYY-MM-DD`). */
export const haceUnMes = (hoy: string): string => haceMeses(hoy, 1)

export type Periodo = 'mes' | 'tres-meses' | 'anio' | 'todo' | 'rango'

/** Las fechas (`YYYY-MM-DD`, día de Madrid) que pide cada periodo; «todo» empieza en 2000. Un `rango` sin las dos fechas (o al revés) no vale: el último mes. */
export function rangoDe(p: Periodo, hoy: Date, rango?: { desde: string; hasta: string }): { desde: string; hasta: string } {
  const hasta = hoyMadrid(hoy)
  switch (p) {
    case 'tres-meses': return { desde: haceMeses(hasta, 3), hasta }
    case 'anio': return { desde: `${hasta.slice(0, 4)}-01-01`, hasta }
    case 'todo': return { desde: '2000-01-01', hasta }
    case 'rango': return rangoValido(rango) ? rango : { desde: haceUnMes(hasta), hasta }
    default: return { desde: haceUnMes(hasta), hasta }
  }
}

export type FiltrosColumna = { plataformas: Set<string>; skus: Set<string>; soloSinImei: boolean; noCuadran: boolean; enviado: Set<string> }

export const SIN_FILTROS: FiltrosColumna = { plataformas: new Set(), skus: new Set(), soloSinImei: false, noCuadran: false, enviado: new Set() }

/** Los contadores pulsables de la cabecera y el filtro que cada uno aplica (sustituye a los filtros de columna). */
export type Contador = 'filas' | 'pendientes' | 'sinImei' | 'noCuadran'

export function filtrosDeContador(c: Contador): FiltrosColumna {
  switch (c) {
    case 'pendientes': return { ...SIN_FILTROS, enviado: new Set(['PENDIENTE']) }
    case 'sinImei': return { ...SIN_FILTROS, soloSinImei: true }
    case 'noCuadran': return { ...SIN_FILTROS, noCuadran: true }
    default: return { ...SIN_FILTROS }
  }
}

/** El contador que está aplicado: el que deja exactamente sus filtros y ninguno más; null si hay otra combinación. */
export function contadorAplicado(f: FiltrosColumna): Contador | null {
  const nada = f.plataformas.size === 0 && f.skus.size === 0
  if (!nada) return null
  const enviado = f.enviado.size === 1 && f.enviado.has('PENDIENTE')
  if (f.enviado.size === 0 && !f.soloSinImei && !f.noCuadran) return 'filas'
  if (enviado && !f.soloSinImei && !f.noCuadran) return 'pendientes'
  if (f.enviado.size === 0 && f.soloSinImei && !f.noCuadran) return 'sinImei'
  if (f.enviado.size === 0 && !f.soloSinImei && f.noCuadran) return 'noCuadran'
  return null
}

export const hayFiltros = (f: FiltrosColumna): boolean => contadorAplicado(f) !== 'filas'

/** Las tiendas del filtro de Plataforma (spec v2 §3.1), en este orden: el valor es el `canal` del ERP; `OTROS` son las filas del
 *  histórico sin canal (y cualquier canal que la web aún no conozca). */
export const TIENDAS: { valor: string; texto: string }[] = [
  { valor: 'AMAZON', texto: 'AMZ' },
  { valor: 'AMAZON_STOCKROOM', texto: 'FNSK' },
  { valor: 'DISTRIBUIDORES', texto: 'Fonestockroom' },
  { valor: 'PARTICULARES', texto: 'Fonestore' },
  { valor: 'BACKIPHONE', texto: 'BackiPhone' },
  { valor: 'OTROS', texto: 'Histórico (otros)' },
]
const VALORES_TIENDA = new Set(TIENDAS.map((t) => t.valor))

/** La tienda de una fila: su canal, o `OTROS`. */
export const tiendaDe = (f: FilaVista): string => (f.canal && VALORES_TIENDA.has(f.canal) ? f.canal : 'OTROS')

export const textoTienda = (valor: string): string => TIENDAS.find((t) => t.valor === valor)?.texto ?? valor

/** Las tiendas que tienen filas entre las recibidas, con su recuento (en una pasada). */
export function tiendasPresentes(filas: FilaVista[]): { valor: string; texto: string; n: number }[] {
  const n = new Map<string, number>()
  for (const f of filas) { const t = tiendaDe(f); n.set(t, (n.get(t) ?? 0) + 1) }
  return TIENDAS.filter((t) => n.has(t.valor)).map((t) => ({ ...t, n: n.get(t.valor) as number }))
}

/** Los valores distintos de una columna, ordenados. */
export function valores(filas: FilaVista[], columna: 'sku' | 'plataforma'): string[] {
  return [...new Set(filas.map((f) => f[columna]).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'es'))
}

/** Las opciones del filtro «Enviado»: una por estado de pantalla; el histórico no cuenta como enviado. */
export const OPCIONES_ENVIADO: { valor: EstadoPantalla; texto: string }[] = [
  { valor: 'PENDIENTE', texto: 'Pendientes' },
  { valor: 'FALTA_ENVIAR', texto: 'Falta por enviar' },
  { valor: 'GENERADA', texto: 'Etiqueta generada' },
  { valor: 'ENVIADO', texto: 'Enviados' },
  { valor: 'NO_PENDIENTE', texto: 'Ya no pendientes' },
  { valor: 'HISTORICO', texto: 'Histórico de la hoja' },
]

/** Cuántas filas hay de cada estado de pantalla entre las recibidas (una pasada). «Falta por enviar» cuenta aparte y también dentro de
 *  «Pendientes», porque ese filtro las deja ver. */
export function recuentoEstados(filas: FilaVista[]): Record<EstadoPantalla, number> {
  const r: Record<EstadoPantalla, number> = { PENDIENTE: 0, FALTA_ENVIAR: 0, GENERADA: 0, ENVIADO: 0, NO_PENDIENTE: 0, HISTORICO: 0 }
  for (const f of filas) {
    const e = estadoPantalla(f)
    r[e]++
    if (e === 'FALTA_ENVIAR') r.PENDIENTE++
  }
  return r
}

/** ¿La fila pasa el filtro «Enviado»? «Pendientes» deja también las de «Falta por enviar». */
const pasaEnviado = (f: FilaVista, elegidos: Set<string>): boolean => {
  const e = estadoPantalla(f)
  return elegidos.has(e) || (e === 'FALTA_ENVIAR' && elegidos.has('PENDIENTE'))
}

/** Los filtros por columna sobre lo recibido (nunca piden al servidor): una selección vacía no filtra; un valor elegido que ya no está
 *  entre las filas sigue filtrando (la pantalla lo enseña con su etiqueta y la tabla explica que no queda nada); «solo sin IMEI» deja las
 *  filas editables sin IMEI (las enviadas también); «no cuadran», las del IMEI en naranja. Sin filtro devuelve las mismas filas;
 *  con él, un array nuevo con los mismos objetos. */
export function filtrarColumnas(filas: FilaVista[], f: FiltrosColumna): FilaVista[] {
  // Se aplica exactamente lo guardado, este o no entre las filas: cada valor se ve como etiqueta y se puede quitar (nada oculto).
  const { plataformas, skus } = f
  if (plataformas.size === 0 && skus.size === 0 && !f.soloSinImei && !f.noCuadran && f.enviado.size === 0) return filas
  return filas.filter((x) =>
    (plataformas.size === 0 || plataformas.has(tiendaDe(x)))
    && (skus.size === 0 || (x.sku != null && skus.has(x.sku)))
    && (!f.soloSinImei || (x.editable && !x.imei))
    && (!f.noCuadran || noCuadra(x))
    && (f.enviado.size === 0 || pasaEnviado(x, f.enviado)))
}

/** Un rango con las dos fechas puestas y en orden. */
export function rangoValido(r?: { desde: string; hasta: string }): r is { desde: string; hasta: string } {
  return !!r && !!r.desde && !!r.hasta && r.desde <= r.hasta
}
