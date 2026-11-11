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

export const estadoDe = (f: FilaVista): EstadoFila => f.estado as EstadoFila

/** El transportista como lo lee el usuario: sin el sufijo técnico de ShippyPro («UPSv2» → «UPS», «GLSSpain» → «GLS»). */
export const nombreTransportista = (t: string): string => t.replace(/(v2|Spain)$/, '')

/** Lo que dice el título de la celda «Enviado»: «transportista · seguimiento», o lo que haya de los dos; sin nada, undefined. */
export function detalleEnvio(f: FilaVista): string | undefined {
  const partes = [f.transportista ? nombreTransportista(f.transportista) : null, f.seguimiento].filter((x): x is string => !!x)
  return partes.length > 0 ? partes.join(' · ') : undefined
}

/** El tono de toda la fila: gris solo en las enviadas y el histórico; las «ya no pendientes» llevan uno más suave (y su texto);
 *  las pendientes, ninguno. */
export function tonoFila(f: FilaVista): 'gris' | 'suave' | null {
  switch (estadoDe(f)) {
    case 'ENVIADA':
    case 'HISTORICO': return 'gris'
    case 'NO_PENDIENTE': return 'suave'
    default: return null
  }
}

/** Las clases del fondo (y el texto) de cada tono. El suave es `seleccion-suave`, el azul pálido de las selecciones: ni gris ni
 *  el ámbar y el naranja de los avisos del IMEI. */
export const CLASE_TONO: Record<'gris' | 'suave', string> = {
  gris: 'bg-[#fafbfc] text-[#8b93a1]',
  suave: 'bg-seleccion-suave',
}

/** Cómo se pinta la celda del IMEI: vacía, o por el nivel que dice el servidor (solo lo manda en pendientes y no pendientes). */
export function claseCelda(f: FilaVista): 'vacia' | 'ok' | 'aviso' | 'mal' {
  if (!f.imei) return 'vacia'
  if (f.nivel === 'AVISO') return 'aviso'
  if (f.nivel === 'MAL') return 'mal'
  return 'ok'
}

/** El contador de la cabecera: todas las filas, las pendientes y las editables que aún no tienen IMEI (enviadas incluidas). */
export function recuento(filas: FilaVista[]): { total: number; pendientes: number; sinImei: number } {
  return {
    total: filas.length,
    pendientes: filas.filter((f) => estadoDe(f) === 'PENDIENTE').length,
    sinImei: filas.filter((f) => f.editable && !f.imei).length,
  }
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

export type FiltrosColumna = { plataformas: Set<string>; skus: Set<string>; soloSinImei: boolean; enviado: Set<string> }

/** Los valores distintos de una columna, ordenados. */
export function valores(filas: FilaVista[], columna: 'plataforma' | 'sku'): string[] {
  return [...new Set(filas.map((f) => f[columna]).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'es'))
}

/** Lo elegido que todavía existe entre los valores recibidos: un valor que ya no está se ignora. */
export function vigente(elegidos: Set<string>, disponibles: string[]): Set<string> {
  const hay = new Set(disponibles)
  return new Set([...elegidos].filter((v) => hay.has(v)))
}

/** Las opciones del filtro «Enviado»; el histórico cuenta como «ENVIADA» (es historia cerrada). */
export const OPCIONES_ENVIADO: { valor: 'PENDIENTE' | 'ENVIADA' | 'NO_PENDIENTE'; texto: string }[] = [
  { valor: 'PENDIENTE', texto: 'Pendientes' },
  { valor: 'ENVIADA', texto: 'Enviados' },
  { valor: 'NO_PENDIENTE', texto: 'Ya no pendientes' },
]
const grupoEnviado = (f: FilaVista): string => (estadoDe(f) === 'HISTORICO' ? 'ENVIADA' : estadoDe(f))

/** Los filtros por columna sobre lo recibido (nunca piden al servidor): una selección vacía no filtra; «solo sin IMEI» deja las
 *  filas editables sin IMEI (las enviadas también). Sin filtro devuelve las mismas filas; con él, un array nuevo con los mismos objetos. */
export function filtrarColumnas(filas: FilaVista[], f: FiltrosColumna): FilaVista[] {
  const plataformas = vigente(f.plataformas, valores(filas, 'plataforma'))
  const skus = vigente(f.skus, valores(filas, 'sku'))
  if (plataformas.size === 0 && skus.size === 0 && !f.soloSinImei && f.enviado.size === 0) return filas
  return filas.filter((x) =>
    (plataformas.size === 0 || (x.plataforma != null && plataformas.has(x.plataforma)))
    && (skus.size === 0 || (x.sku != null && skus.has(x.sku)))
    && (!f.soloSinImei || (x.editable && !x.imei))
    && (f.enviado.size === 0 || f.enviado.has(grupoEnviado(x))))
}

/** Un rango con las dos fechas puestas y en orden. */
export function rangoValido(r?: { desde: string; hasta: string }): r is { desde: string; hasta: string } {
  return !!r && !!r.desde && !!r.hasta && r.desde <= r.hasta
}
