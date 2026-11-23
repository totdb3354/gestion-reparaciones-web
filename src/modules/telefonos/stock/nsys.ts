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
  if (e.nivel === 'RETRASO') {
    const hace = minutos >= 60 ? `${Math.floor(minutos / 60)} h ${minutos % 60} min` : `${minutos} min`
    return `NSYS: última exportación hace ${hace} (${hora(iso)})`
  }
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

/** Más de estos minutos entre dos exportaciones seguidas es un hueco: falta un Items (spec 0.9.18 §4.11). Desde la 0.9.43,
 *  con NSYS publicando cada 10 min las 24 h (desde el 23/11/2026), 15 y contando también la noche; antes, 45 de 07:00 a 23:00. */
export const HUECO_MINUTOS = 15

/** Minutos entre dos horas de Madrid, de día y de noche: la misma cuenta que AvisoNsys del servidor. 0 si van al revés. */
export function minutosEntre(desde: string, hasta: string): number {
  return Math.max(0, aMinutos(hasta) - aMinutos(desde))
}

export type FilaLista = { tipo: 'importacion'; importacion: ImportacionNsys } | { tipo: 'hueco'; desde: string; hasta: string }

/** Intercala «falta un Items» entre dos exportaciones seguidas separadas por más de 15 minutos. Todas las filas
 *  cuentan como exportación que llegó (el fichero existía, aunque se rechazara o diera error: su resultado ya avisa). La
 *  lista llega de la más reciente a la más antigua. */
export function conHuecos(importaciones: ImportacionNsys[]): FilaLista[] {
  const filas: FilaLista[] = []
  importaciones.forEach((imp, i) => {
    filas.push({ tipo: 'importacion', importacion: imp })
    const anterior = importaciones[i + 1]
    if (anterior && minutosEntre(anterior.fechaExportacion, imp.fechaExportacion) > HUECO_MINUTOS) {
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
