import type { FilaVista } from '@/shared/api/client'
import { hoyMadrid } from '@/shared/lib/fechas'
import { MODELOS_ORDENADOS } from '@/shared/lib/modelos'
import { diaNsys } from '@/shared/lib/telefonoNsys'
import { nivelSalida, textoSalida } from './salida'
import { textoReparandose } from '../stock/quien'

/** Las columnas de la tabla, con los nombres de la hoja (sin letras). */
export const COLUMNAS = ['Fecha', 'Plataforma', 'SKU', 'IMEI', 'Pedido', 'Enviado', 'Fecha compra'] as const

/** Lo que cada recomendado dice de sí mismo respecto al pedido (nivel 1 = el mejor). */
export const TEXTO_NIVEL: Record<1 | 2 | 3, string> = {
  1: 'igual que el pedido',
  2: 'reparándose, acabará igual',
  3: 'hay que transformarlo',
}

export type ParteAviso = { texto: string; tono: 'naranja' | 'ambar' }

const PALABRA_SIM: Record<string, string> = { ESIM: 'eSIM', SIM_FISICA: 'SIM física' }
const FRASE_SIM: Record<string, string> = {
  ESIM: 'el pedido es de SIM física y el móvil es eSIM',
  SIM_FISICA: 'el pedido es de eSIM y el móvil es de SIM física',
}
const DE_MODELO = ['MODELO', 'CAPACIDAD']

/** El motivo en corto, como se lee en la celda. */
export function textoMotivoCorto(f: FilaVista): string {
  const dato = f.detalle?.dato
  const con = (nombre: string, otro: string) => (dato ? `${nombre}: ${dato}` : otro)
  switch (f.motivo) {
    case 'NO_EN_NSYS': return 'no está en NSYS'
    case 'EN_OTRA_FILA': return 'en otro pedido'
    case 'SKU_DESCONOCIDO': return 'SKU desconocido'
    case 'MODELO': return con('modelo', 'otro modelo')
    case 'CAPACIDAD': return con('capacidad', 'otra capacidad')
    case 'COLOR': return con('color', 'otro color')
    case 'GRADO': return con('grado', 'otro grado')
    case 'COLOR_O_GRADO': return 'otro color o grado'
    case 'GRADO_NO_VENDIBLE': return con('no se vende', 'no se vende')
    case 'EN_TALLER': {
      const quien = textoReparandose(f.detalle?.trabajos ?? [])
      return quien ? `reparándose · ${quien}` : 'reparándose'
    }
    case 'B_POR_A': return 'B por A'
    case 'MS': return 'MS' // servidor anterior
    default: return 'revisar'
  }
}

/** Las piezas de la celda del IMEI (spec 2026-11-24 §2): SIM, modelo o capacidad, N/A, MS y el resto. Naranja: la SIM y lo que no
 *  cuadra; ámbar: lo demás. */
export function partesAviso(f: FilaVista): ParteAviso[] {
  const d = f.detalle
  const p: ParteAviso[] = []
  const tonoMotivo = f.nivel === 'MAL' ? 'naranja' : 'ambar'
  if (d?.sim) p.push({ texto: PALABRA_SIM[d.sim] ?? d.sim, tono: 'naranja' })
  if (f.motivo && DE_MODELO.includes(f.motivo)) p.push({ texto: textoMotivoCorto(f), tono: tonoMotivo })
  if (d?.na) p.push({ texto: 'N/A', tono: 'ambar' })
  if (d?.ms) p.push({ texto: 'MS', tono: 'ambar' })
  if (f.motivo && !DE_MODELO.includes(f.motivo)) p.push({ texto: textoMotivoCorto(f), tono: tonoMotivo })
  // Quién lo tiene sale siempre (24/11), también con lo que no cuadra; con EN_TALLER ya va en el motivo.
  if (d?.trabajos?.length && f.motivo !== 'EN_TALLER') p.push({ texto: `reparándose · ${textoReparandose(d.trabajos)}`, tono: 'ambar' })
  return p
}

/** El motivo en una frase, con lo que es el móvil (`skuMovil`). Sin motivo, null. */
export function textoMotivo(f: FilaVista): string | null {
  if (!f.motivo) return null
  const es = f.skuMovil ? `: es ${f.skuMovil}` : ''
  const dato = f.detalle?.dato ? ` (${f.detalle.dato})` : ''
  switch (f.motivo) {
    case 'NO_EN_NSYS': return 'no está en NSYS'
    case 'EN_OTRA_FILA': return 'ya está en otro pedido'
    case 'SKU_DESCONOCIDO': return 'el maestro no conoce este SKU'
    case 'MODELO': return `otro modelo${dato}${es}`
    case 'CAPACIDAD': return `otra capacidad${dato}${es}`
    case 'COLOR': return `otro color${dato}${es}`
    case 'GRADO': return `otro grado${dato}${es}`
    case 'COLOR_O_GRADO': return `el color y el grado valen por separado, pero el pedido no tiene esa combinación${es}`
    case 'GRADO_NO_VENDIBLE': return `ese grado no se vende${dato}`
    case 'EN_TALLER': return `se está reparando${f.detalle?.trabajos?.length ? ` (${textoReparandose(f.detalle.trabajos)})` : ''}`
    case 'B_POR_A': return `B por A${es}`
    case 'MS': return 'es un Ms'
    default: return 'revisar'
  }
}

/** Una frase por pieza, en el orden de la celda: para el title y el panel. */
export function lineasAviso(f: FilaVista): string[] {
  const d = f.detalle
  const l: string[] = []
  if (d?.sim) l.push(FRASE_SIM[d.sim] ?? d.sim)
  const motivo = textoMotivo(f)
  if (motivo && f.motivo && DE_MODELO.includes(f.motivo)) l.push(motivo)
  if (d?.na) l.push('grado n/a: NSYS no le da grado')
  if (d?.ms) l.push('es un Ms')
  if (motivo && !(f.motivo && DE_MODELO.includes(f.motivo))) l.push(motivo)
  if (d?.trabajos?.length && f.motivo !== 'EN_TALLER') l.push(`se está reparando (${textoReparandose(d.trabajos)})`)
  return l
}

/** Los motivos del aviso naranja que una persona puede dar por buenos («Validar SKU»): solo los de SKU. NO_EN_NSYS y EN_OTRA_FILA son
 *  errores del IMEI (se arreglan cambiándolo) y el ámbar no se valida. */
export const MOTIVOS_SKU = ['MODELO', 'CAPACIDAD', 'COLOR', 'GRADO', 'COLOR_O_GRADO', 'GRADO_NO_VENDIBLE', 'SKU_DESCONOCIDO']

/** La fila tiene el aviso de SKU dado por bueno (el servidor ya manda el nivel OK). */
export const estaValidada = (f: FilaVista): boolean => !!f.motivoValidado

/** Sale el botón «Validar SKU»: celda naranja por un motivo de SKU, sin validar. */
export const puedeValidar = (f: FilaVista): boolean =>
  f.editable && !!f.imei && f.nivel === 'MAL' && !estaValidada(f) && f.motivo != null && MOTIVOS_SKU.includes(f.motivo)

/** El aviso original de una fila validada («otro color o grado: es …»); null si no lo está. */
export function textoMotivoValidado(f: FilaVista): string | null {
  return f.motivoValidado ? textoMotivo({ ...f, motivo: f.motivoValidado }) : null
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
export type EstadoPantalla = 'PENDIENTE' | 'FALTA_ENVIAR' | 'GENERADA' | 'ENVIADO' | 'NO_PENDIENTE' | 'CANCELADO' | 'HISTORICO'

/** Las marcas de la fila (una como mucho, con una nota opcional): el valor es el que manda y devuelve el servidor. */
export const MARCAS: { valor: string; texto: string }[] = [
  { valor: 'ESPERA_STOCK', texto: 'En espera de stock' },
  { valor: 'EN_REVISION', texto: 'En revisión' },
  { valor: 'PENDIENTE_COLOR', texto: 'Pendiente de color' },
  { valor: 'CANCELADO', texto: 'Cancelado' },
]

/** Las marcas que se eligen en el desplegable (celda del IMEI y panel). «Cancelado» no: se pone con «Cancelar móvil» del panel, con confirmación. */
export const MARCAS_DESPLEGABLE = MARCAS.filter((m) => m.valor !== 'CANCELADO')

/** El texto de una marca; una que la web aún no conoce se enseña tal cual (la marca nunca se esconde). */
export const textoMarca = (valor: string): string => MARCAS.find((m) => m.valor === valor)?.texto ?? valor
/** El color de la etiqueta de cada marca (ámbar suave, azul suave y gris). */
export const COLOR_MARCA: Record<string, string> = {
  ESPERA_STOCK: 'bg-pill-aviso-bg text-pill-aviso-text',
  PENDIENTE_COLOR: 'bg-pill-aviso-bg text-pill-aviso-text',
  EN_REVISION: 'bg-[#dbe6fb] text-[#1d3a78]',
  CANCELADO: 'bg-[#eceef2] text-[#6b7482]',
}
export const colorMarca = (valor: string): string => COLOR_MARCA[valor] ?? COLOR_MARCA.CANCELADO
/** Las marcas a las que el lector NO salta: la fila tiene un motivo para quedarse sin IMEI. «Pendiente de color» es como sin marca. */
const MARCAS_SIN_SALTO = new Set(['ESPERA_STOCK', 'EN_REVISION', 'CANCELADO'])
/** ¿Puede el salto del lector abrir esta fila? Editable, sin IMEI y sin una marca que diga que no hay que ponérselo ahora. */
export const saltaElLector = (f: FilaVista): boolean => f.editable && !f.imei && !(f.marca != null && MARCAS_SIN_SALTO.has(f.marca))

/** El estado de pantalla de una fila (una comparación por fila; sin trabajo extra). Una enviada con la marca «falta por enviar» (un
 *  envío parcial de web) es `FALTA_ENVIAR`; con otro estado del servidor la marca se ignora (un pedido reabierto vuelve a pendiente). */
export function estadoPantalla(f: FilaVista): EstadoPantalla {
  const e = estadoDe(f)
  // «Cancelado» gana a todo (también a la marca de envío parcial): el móvil ya no sale.
  if (f.marca === 'CANCELADO' && e !== 'HISTORICO') return 'CANCELADO'
  if (e !== 'ENVIADA') return e
  return f.faltaEnviarEn ? 'FALTA_ENVIAR' : f.impresaEn ? 'ENVIADO' : 'GENERADA'
}

/** El texto de la etiqueta de «Enviado» (la de la tabla y la del CSV). En «falta por enviar» añade «con retraso» o «sale hoy» si se da
 *  `hoy`; «Etiqueta generada» lleva la fecha del envío y «Enviado» (etiqueta impresa), la de la impresión. */
export function textoEstado(f: FilaVista, estado: EstadoPantalla, hoy?: string): string {
  const nivel = hoy ? nivelSalida(f, hoy) : null
  const diaMes = (iso: string | null) => (iso ? ` ${diaNsys(iso).slice(0, 5)}` : '')
  return {
    PENDIENTE: (nivel && textoSalida(f, hoy!)) || 'Pendiente',
    FALTA_ENVIAR: `Envío parcial · falta por enviar${nivel === 'RETRASO' ? ' · con retraso' : nivel === 'HOY' ? ' · sale hoy' : ''}`,
    GENERADA: `Etiqueta generada${diaMes(f.envioFecha)}`,
    ENVIADO: `Enviado${diaMes(f.impresaEn)}`,
    NO_PENDIENTE: 'Ya no está en ShippyPro',
    CANCELADO: 'Cancelado',
    HISTORICO: 'De la hoja',
  }[estado]
}

/** Cuenta como pendiente: lo está en el servidor, o es un envío parcial al que aún le falta un móvil por salir. Una cancelada no. */
export function esPendiente(f: FilaVista): boolean {
  const e = estadoPantalla(f)
  return e === 'PENDIENTE' || e === 'FALTA_ENVIAR'
}

/** Los canales de Amazon: ahi el pedido de una fila solo se ve cuando el libro de ventas lo asocia. */
const CANALES_AMAZON = new Set(['AMAZON', 'AMAZON_STOCKROOM'])
export const esAmazon = (f: FilaVista): boolean => f.canal != null && CANALES_AMAZON.has(f.canal)

/** Una fila de Amazon que el libro de ventas aun no ha asociado a su pedido (`asociadaEn` nulo). Las webs y el historico nunca. */
export const sinAsociar = (f: FilaVista): boolean => esAmazon(f) && !f.asociadaEn

/** El numero de pedido que se enseña: el de la fila, salvo en Amazon sin asociar (el ERP lo sabe, pero aun no vale). */
export const pedidoVisible = (f: FilaVista): string | null => (sinAsociar(f) ? null : f.pedido)

/** Cuantas filas de Amazon hay sin asociar entre las recibidas (una pasada). */
export function recuentoSinAsociar(filas: FilaVista[]): number {
  let n = 0
  for (const f of filas) if (sinAsociar(f)) n++
  return n
}

/** Por que una asociacion del libro de ventas quedo «para revisar», en palabras; un motivo que la web no conoce se enseña tal cual. */
export function textoRevisar(motivo: string): string {
  switch (motivo) {
    case 'SIN_HUECO': return 'el pedido no tiene hueco'
    case 'YA_SALIO': return 'el móvil ya salió en otro pedido'
    case 'PEDIDO_AJENO': return 'el pedido no está en el ERP'
    case 'CANCELADO': return 'solo quedan filas canceladas'
    case 'REPETIDO_EN_LIBRO': return 'el libro pone este IMEI en dos pedidos'
    case 'NO_EN_NSYS': return 'el IMEI del libro no está en NSYS'
    case 'OTRO_MODELO': return 'el móvil del libro no cuadra con el pedido'
    default: return motivo
  }
}

/** Las tiendas web (el plugin de la web sincroniza sus envíos): solo en ellas se puede marcar «falta por enviar». */
const CANALES_WEB = new Set(['DISTRIBUIDORES', 'PARTICULARES', 'BACKIPHONE'])
export const esCanalWeb = (f: FilaVista): boolean => f.canal != null && CANALES_WEB.has(f.canal)

/** El número de cada fila dentro de su pedido de varios móviles: «1/3», «2/3»… en el orden de la lista. Solo cuentan las filas con
 *  `canal` y `pedido` (el histórico no; en Amazon, solo las asociadas) y los pedidos de más de una fila; las demás no salen en el
 *  mapa. Una pasada por cambio de filas. */
export function numerosDePedido(filas: FilaVista[]): Map<number, string> {
  const grupos = new Map<string, number[]>()
  for (const f of filas) {
    if (estadoDe(f) === 'HISTORICO' || !f.canal || !f.pedido || sinAsociar(f)) continue
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

/** Cómo se pinta la celda del IMEI: vacía; naranja si no cuadra; amarillo claro si es N/A (el único amarillo); si no, sin fondo. */
export function claseCelda(f: FilaVista): 'vacia' | 'ok' | 'na' | 'mal' {
  if (!f.imei) return 'vacia'
  if (f.nivel === 'MAL') return 'mal'
  if (f.detalle?.na) return 'na'
  return 'ok'
}

/** Las filas cuyo IMEI no cuadra con el pedido (la celda en naranja). */
export const noCuadra = (f: FilaVista): boolean => f.nivel === 'MAL'

export type Recuento = { total: number; pendientes: number; sinImei: number; noCuadran: number }

/** ¿Le falta el IMEI? Editable y sin IMEI (enviadas incluidas), salvo «Cancelado»: ese móvil no sale y no necesita IMEI. */
export function faltaImei(f: FilaVista): boolean {
  return f.editable && !f.imei && f.marca !== 'CANCELADO'
}

/** Los contadores de la cabecera: todas las filas, las pendientes, las editables que aún no tienen IMEI (enviadas incluidas) y las
 *  que no cuadran. Una sola pasada. */
export function recuento(filas: FilaVista[]): Recuento {
  const r: Recuento = { total: filas.length, pendientes: 0, sinImei: 0, noCuadran: 0 }
  for (const f of filas) {
    if (esPendiente(f)) r.pendientes++
    if (faltaImei(f)) r.sinImei++
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

export type FiltrosColumna = { plataformas: Set<string>; skus: Set<string>; soloSinImei: boolean; noCuadran: boolean; enviado: Set<string>; marcas: Set<string>; sinAsociar: boolean }

export const SIN_FILTROS: FiltrosColumna = { plataformas: new Set(), skus: new Set(), soloSinImei: false, noCuadran: false, enviado: new Set(), marcas: new Set(), sinAsociar: false }

/** Los contadores pulsables de la cabecera y el filtro que cada uno aplica (sustituye a los filtros de columna). */
export type Contador = 'filas' | 'pendientes' | 'sinImei' | 'noCuadran' | 'saleHoy' | 'conRetraso'

export function filtrosDeContador(c: Contador): FiltrosColumna {
  switch (c) {
    case 'pendientes': return { ...SIN_FILTROS, enviado: new Set(['PENDIENTE']) }
    case 'sinImei': return { ...SIN_FILTROS, soloSinImei: true }
    case 'noCuadran': return { ...SIN_FILTROS, noCuadran: true }
    case 'saleHoy': return { ...SIN_FILTROS, enviado: new Set(['SALE_HOY']) }
    case 'conRetraso': return { ...SIN_FILTROS, enviado: new Set(['CON_RETRASO']) }
    default: return { ...SIN_FILTROS }
  }
}

/** El contador que está aplicado: el que deja exactamente sus filtros y ninguno más; null si hay otra combinación. */
export function contadorAplicado(f: FiltrosColumna): Contador | null {
  const nada = f.plataformas.size === 0 && f.skus.size === 0 && f.marcas.size === 0 && !f.sinAsociar
  if (!nada) return null
  const enviado = f.enviado.size === 1 && f.enviado.has('PENDIENTE')
  if (f.enviado.size === 1 && !f.soloSinImei && !f.noCuadran) {
    if (f.enviado.has('SALE_HOY')) return 'saleHoy'
    if (f.enviado.has('CON_RETRASO')) return 'conRetraso'
  }
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
export const OPCIONES_ENVIADO: { valor: EstadoPantalla | 'SALE_HOY' | 'CON_RETRASO'; texto: string }[] = [
  { valor: 'PENDIENTE', texto: 'Pendientes' },
  { valor: 'SALE_HOY', texto: 'Sale hoy' },
  { valor: 'CON_RETRASO', texto: 'Con retraso' },
  { valor: 'FALTA_ENVIAR', texto: 'Falta por enviar' },
  { valor: 'GENERADA', texto: 'Etiqueta generada' },
  { valor: 'ENVIADO', texto: 'Enviados' },
  { valor: 'NO_PENDIENTE', texto: 'Ya no están en ShippyPro' },
  { valor: 'CANCELADO', texto: 'Cancelado' },
  { valor: 'HISTORICO', texto: 'Histórico de la hoja' },
]

/** Cuántas filas hay de cada estado de pantalla entre las recibidas (una pasada). «Falta por enviar» cuenta aparte y también dentro de
 *  «Pendientes», porque ese filtro las deja ver. */
export function recuentoEstados(filas: FilaVista[]): Record<EstadoPantalla, number> {
  const r: Record<EstadoPantalla, number> = { PENDIENTE: 0, FALTA_ENVIAR: 0, GENERADA: 0, ENVIADO: 0, NO_PENDIENTE: 0, CANCELADO: 0, HISTORICO: 0 }
  for (const f of filas) {
    const e = estadoPantalla(f)
    r[e]++
    if (e === 'FALTA_ENVIAR') r.PENDIENTE++
  }
  return r
}

/** Cuántas filas hay con cada marca entre las recibidas (una pasada). Solo salen las marcas que hay. */
export function recuentoMarcas(filas: FilaVista[]): Record<string, number> {
  const r: Record<string, number> = {}
  for (const f of filas) if (f.marca) r[f.marca] = (r[f.marca] ?? 0) + 1
  return r
}

/** Cuántas filas salen hoy y cuántas van con retraso (una pasada; ver `nivelSalida`). */
export function recuentoSalida(filas: FilaVista[], hoy: string): { hoy: number; retraso: number } {
  const r = { hoy: 0, retraso: 0 }
  for (const f of filas) {
    const n = nivelSalida(f, hoy)
    if (n === 'HOY') r.hoy++
    else if (n === 'RETRASO') r.retraso++
  }
  return r
}

/** ¿La fila pasa el filtro «Enviado»? «Pendientes» deja también las de «Falta por enviar»; «Sale hoy» y «Con retraso» miran su fecha de salida. */
const pasaEnviado = (f: FilaVista, elegidos: Set<string>, hoy: string): boolean => {
  const e = estadoPantalla(f)
  if (elegidos.has(e) || (e === 'FALTA_ENVIAR' && elegidos.has('PENDIENTE'))) return true
  if (!elegidos.has('SALE_HOY') && !elegidos.has('CON_RETRASO')) return false
  const n = nivelSalida(f, hoy)
  return (n === 'HOY' && elegidos.has('SALE_HOY')) || (n === 'RETRASO' && elegidos.has('CON_RETRASO'))
}

/** Los filtros por columna sobre lo recibido (nunca piden al servidor): una selección vacía no filtra; un valor elegido que ya no está
 *  entre las filas sigue filtrando (la pantalla lo enseña con su etiqueta y la tabla explica que no queda nada); «solo sin IMEI» deja las
 *  filas editables sin IMEI (las enviadas también); «no cuadran», las del IMEI en naranja. Sin filtro devuelve las mismas filas;
 *  con él, un array nuevo con los mismos objetos. */
export function filtrarColumnas(filas: FilaVista[], f: FiltrosColumna, hoy: string = hoyMadrid()): FilaVista[] {
  // Se aplica exactamente lo guardado, este o no entre las filas: cada valor se ve como etiqueta y se puede quitar (nada oculto).
  const { plataformas, skus } = f
  const { marcas } = f
  if (plataformas.size === 0 && skus.size === 0 && !f.soloSinImei && !f.noCuadran && f.enviado.size === 0 && marcas.size === 0 && !f.sinAsociar) return filas
  return filas.filter((x) =>
    (plataformas.size === 0 || plataformas.has(tiendaDe(x)))
    && (skus.size === 0 || (x.sku != null && skus.has(x.sku)))
    && (!f.soloSinImei || faltaImei(x))
    && (!f.noCuadran || noCuadra(x))
    && (!f.sinAsociar || sinAsociar(x))
    && (f.enviado.size === 0 || pasaEnviado(x, f.enviado, hoy))
    && (marcas.size === 0 || (x.marca != null && marcas.has(x.marca))))
}

/** Un rango con las dos fechas puestas y en orden. */
export function rangoValido(r?: { desde: string; hasta: string }): r is { desde: string; hasta: string } {
  return !!r && !!r.desde && !!r.hasta && r.desde <= r.hasta
}

/** El día de una fila (`YYYY-MM-DD`): la columna FECHA es un DATE del día de Madrid; si llegara con hora, cuenta su día. */
const diaDe = (f: FilaVista): string => f.fecha.slice(0, 10)

/** 0.9.38 (spec «rango estricto»): el servidor manda las filas del periodo y, además, las que siguen abiertas de cualquier fecha. La
 *  tabla enseña solo las del periodo (`delPeriodo`, extremos incluidos); de las demás, solo cuentan los pendientes (`esPendiente`:
 *  sin las canceladas), que van a `fuera` para el aviso y para «Ver». Ambas en el orden recibido. */
export function separarPorPeriodo(filas: FilaVista[], desde: string, hasta: string): { delPeriodo: FilaVista[]; fuera: FilaVista[] } {
  const delPeriodo: FilaVista[] = []
  const fuera: FilaVista[] = []
  for (const f of filas) {
    const dia = diaDe(f)
    if (dia >= desde && dia <= hasta) delPeriodo.push(f)
    else if (esPendiente(f)) fuera.push(f)
  }
  return { delPeriodo, fuera }
}

export type AvisoFuera = { n: number; conRetraso: number; donde: 'antes' | 'despues' | 'ambos' }

/** Lo que dice el aviso de los pendientes de fuera del periodo: cuántos, cuántos van con retraso y de qué lado quedan; null si no hay. */
export function avisoFuera(fuera: FilaVista[], desde: string, hasta: string, hoy: string): AvisoFuera | null {
  if (fuera.length === 0) return null
  let conRetraso = 0, antes = false, despues = false
  for (const f of fuera) {
    if (nivelSalida(f, hoy) === 'RETRASO') conRetraso++
    if (diaDe(f) < desde) antes = true
    else if (diaDe(f) > hasta) despues = true
  }
  return { n: fuera.length, conRetraso, donde: antes && despues ? 'ambos' : despues ? 'despues' : 'antes' }
}

/** «Hay 3 pendientes de antes del 20/11 (1 con retraso).» */
export function textoAvisoFuera(a: AvisoFuera, desde: string, hasta: string): string {
  const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
  const donde = a.donde === 'ambos' ? 'fuera de estas fechas' : a.donde === 'antes' ? `de antes del ${dm(desde)}` : `de después del ${dm(hasta)}`
  const retraso = a.conRetraso > 0 ? ` (${a.conRetraso} con retraso)` : ''
  return `Hay ${a.n} ${a.n === 1 ? 'pendiente' : 'pendientes'} ${donde}${retraso}.`
}

/** 0.9.39 (spec «ordenar por cabecera»): el orden de la columna SKU de Pedidos; null = el de siempre (por fecha). */
export type OrdenSku = 'asc' | 'desc' | null

/** El clic en la cabecera SKU: de A a Z, de Z a A y vuelta al orden de siempre. */
export const siguienteOrdenSku = (o: OrdenSku): OrdenSku => (o === null ? 'asc' : o === 'asc' ? 'desc' : null)

/** Lo que cuenta de un SKU para ordenar (`i` + modelo + `eSIM`? + capacidad + color y grado): el modelo es el código MÁS LARGO de
 *  MODELOS_ORDENADOS que va seguido de la capacidad (con «esim» en medio o no), así «i16eSIM128» es un 16 con eSIM y no un 16e. La
 *  capacidad, como número («1TB» = 1024). null si no se entiende. */
export function partesSkuPedido(sku: string): { modelo: number; capacidad: number; esim: boolean; resto: string } | null {
  // Lo escrito a mano en la hoja (histórico) a veces no lleva la «i» o empieza con espacios o «: »: se acepta igual.
  const t = sku.toLowerCase().replace(/^[^a-z0-9]+/, '')
  const r = t.startsWith('i') ? t.slice(1) : t
  let mejor: { modelo: number; largo: number; tras: string } | null = null
  MODELOS_ORDENADOS.forEach((m, i) => {
    if (!r.startsWith(m) || (mejor && mejor.largo >= m.length)) return
    const tras = r.slice(m.length)
    if (/^(esim)?\d/.test(tras)) mejor = { modelo: i, largo: m.length, tras }
  })
  if (!mejor) return null
  const { modelo, tras } = mejor as { modelo: number; largo: number; tras: string }
  const esim = tras.startsWith('esim')
  const c = /^(\d+)(tb)?(.*)$/.exec(esim ? tras.slice(4) : tras)!
  return { modelo, capacidad: Number(c[1]) * (c[2] ? 1024 : 1), esim, resto: c[3] }
}

/** Las filas por SKU como se organiza el almacén (0.9.39): por modelo en el orden de la tienda (`asc`: del más antiguo al más nuevo;
 *  `desc`, al revés) y, dentro de cada modelo, SIEMPRE la capacidad de menor a mayor, sin eSIM antes que con eSIM, y el color y el grado
 *  por orden alfabético. A igual SKU se queda el orden de siempre (orden estable). Los SKU que no se entienden van detrás (alfabético)
 *  y las filas sin SKU al final, en los dos sentidos. Sin orden devuelve la misma lista. */
export function ordenarPorSku(filas: FilaVista[], orden: OrdenSku): FilaVista[] {
  if (orden === null) return filas
  const signo = orden === 'asc' ? 1 : -1
  const partes = new Map<string, ReturnType<typeof partesSkuPedido>>()
  const de = (sku: string) => { if (!partes.has(sku)) partes.set(sku, partesSkuPedido(sku)); return partes.get(sku)! }
  const rango = (f: FilaVista) => (!f.sku ? 2 : de(f.sku) ? 0 : 1)
  return [...filas].sort((a, b) => {
    const ra = rango(a), rb = rango(b)
    if (ra !== rb) return ra - rb
    if (ra === 2) return 0
    if (ra === 1) return a.sku!.localeCompare(b.sku!, 'es', { sensitivity: 'base' })
    const pa = de(a.sku!)!, pb = de(b.sku!)!
    return signo * (pa.modelo - pb.modelo) || pa.capacidad - pb.capacidad || Number(pa.esim) - Number(pb.esim)
      || pa.resto.localeCompare(pb.resto, 'es', { sensitivity: 'base' })
  })
}
