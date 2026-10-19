import type { EstadoNsys, ImportacionNsys, ProgresoHistorico } from '@/shared/api/client'
import { diaNsys } from '@/shared/lib/telefonoNsys'

/** Textos del aviso de datos de NSYS (0.9.17, spec «Pieza 1» §5.7). El servidor da las horas de Madrid sin zona; para
 *  restarlas de «ahora» se lleva ahora a la hora de Madrid, sea cual sea la zona del navegador. */

const MADRID = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

/** «2026-10-16 13:43» de ahora en Madrid. */
function ahoraEnMadrid(ahora: Date): string {
  return MADRID.format(ahora).replace(',', '')
}

/** «2026-10-16»: el día de hoy en Madrid. */
export function diaDeHoyEnMadrid(ahora: Date = new Date()): string {
  return ahoraEnMadrid(ahora).slice(0, 10)
}

/** Una hora de pared (sin zona) a minutos desde una referencia fija, para restar dos horas de Madrid. */
function aMinutos(fechaHora: string): number {
  const [d, h] = fechaHora.replace('T', ' ').split(' ')
  const [anio, mes, dia] = d.split('-').map(Number)
  const [hora, minuto] = h.split(':').map(Number)
  return Date.UTC(anio, mes - 1, dia, hora, minuto) / 60_000
}

export function minutosDesde(isoMadrid: string, ahora: Date = new Date()): number {
  return Math.max(0, aMinutos(ahoraEnMadrid(ahora)) - aMinutos(isoMadrid))
}

const hora = (iso: string) => iso.slice(11, 16)
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const esHoy = (iso: string, ahora: Date) => iso.slice(0, 10) === ahoraEnMadrid(ahora).slice(0, 10)

export function textoPildora(e: EstadoNsys | null | undefined, ahora: Date = new Date()): string {
  if (!e?.ultimaExportacion) return 'NSYS: sin datos todavía'
  const iso = e.ultimaExportacion
  const minutos = minutosDesde(iso, ahora)
  if (e.nivel === 'SIN_DATOS') {
    const horas = Math.floor(minutos / 60)
    return horas > 0 ? `NSYS: sin datos nuevos desde hace ${horas} h` : `NSYS: sin datos nuevos desde hace ${minutos} min`
  }
  if (e.nivel === 'RETRASO') return `NSYS: última exportación hace ${Math.floor(minutos / 60)} h ${minutos % 60} min (${hora(iso)})`
  return esHoy(iso, ahora) ? `NSYS: exportación de hoy ${hora(iso)} · hace ${minutos} min` : `NSYS: exportación del ${diaMes(iso)} ${hora(iso)}`
}

/** La banda roja de la cabecera: solo cuando no llegan datos (SIN_DATOS). */
export function textoBanda(e: EstadoNsys | null | undefined, ahora: Date = new Date()): string | null {
  if (!e || e.nivel !== 'SIN_DATOS') return null
  if (!e.ultimaExportacion) return 'Todavía no ha llegado ningún dato de NSYS.'
  const iso = e.ultimaExportacion
  const desde = esHoy(iso, ahora) ? `las ${hora(iso)}` : `el ${diaMes(iso)} a las ${hora(iso)}`
  return `No llegan datos nuevos de NSYS desde ${desde}. El PC de producción o Drive pueden estar parados. Se enseñan los últimos datos recibidos.`
}

const ABRE = 7 * 60
const CIERRA = 23 * 60
/** Más de estos minutos hábiles entre dos exportaciones seguidas es un hueco: falta un Items (spec 0.9.18 §4.11). */
export const HUECO_MINUTOS = 45

/** Minutos de 07:00 a 23:00 entre dos horas de Madrid, cuando el bot exporta: la misma cuenta que AvisoNsys del servidor. */
export function minutosHabiles(desde: string, hasta: string): number {
  const d = aMinutos(desde)
  const h = aMinutos(hasta)
  let total = 0
  for (let dia = Math.floor(d / 1440) * 1440; dia < h; dia += 1440) {
    const inicio = Math.max(d, dia + ABRE)
    const fin = Math.min(h, dia + CIERRA)
    if (fin > inicio) total += fin - inicio
  }
  return total
}

export type FilaLista = { tipo: 'importacion'; importacion: ImportacionNsys } | { tipo: 'hueco'; desde: string; hasta: string }

/** Intercala «falta un Items» entre dos exportaciones seguidas separadas por más de 45 minutos hábiles. Todas las filas
 *  cuentan como exportación que llegó (el fichero existía, aunque se rechazara o diera error: su resultado ya avisa). La
 *  lista llega de la más reciente a la más antigua. */
export function conHuecos(importaciones: ImportacionNsys[]): FilaLista[] {
  const filas: FilaLista[] = []
  importaciones.forEach((imp, i) => {
    filas.push({ tipo: 'importacion', importacion: imp })
    const anterior = importaciones[i + 1]
    if (anterior && minutosHabiles(anterior.fechaExportacion, imp.fechaExportacion) > HUECO_MINUTOS) {
      filas.push({ tipo: 'hueco', desde: anterior.fechaExportacion, hasta: imp.fechaExportacion })
    }
  })
  return filas
}

/** La hora del Items: «13:31» si es de hoy y «15/10 13:31» si no. */
export function horaItems(iso: string, ahora: Date = new Date()): string {
  return esHoy(iso, ahora) ? hora(iso) : `${diaMes(iso)} ${hora(iso)}`
}

export const textoCambios = (n: number): string => (n === 1 ? '1 cambio' : `${n} cambios`)

/** La línea del progreso del histórico al pie del popover; sin importaciones HISTORICO, ninguna. El histórico termina en
 *  el Items de la primera importación ACTUAL OK (`hasta`): cuando el último hecho llega ahí, está terminado. */
export function textoHistorico(h: ProgresoHistorico | null | undefined): string | null {
  if (!h || h.total === 0) return null
  if (h.ultimo && h.hasta && h.ultimo >= h.hasta) return `Histórico: terminado (${h.hechos} ${h.hechos === 1 ? 'fichero' : 'ficheros'})`
  const hechos = `${h.hechos} ${h.hechos === 1 ? 'fichero hecho' : 'ficheros hechos'}`
  return `Histórico: ${hechos}${h.ultimo ? `, hasta el Items del ${diaNsys(h.ultimo)}` : ''}${h.hasta ? `; termina en el del ${diaNsys(h.hasta)}` : ''}`
}
