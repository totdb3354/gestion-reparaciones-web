import type { EstadoNsys } from '@/shared/api/client'

/** Textos del aviso de datos de NSYS (0.9.17, spec «Pieza 1» §5.7). El servidor da las horas de Madrid sin zona; para
 *  restarlas de «ahora» se lleva ahora a la hora de Madrid, sea cual sea la zona del navegador. */

const MADRID = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

/** «2026-10-16 13:43» de ahora en Madrid. */
function ahoraEnMadrid(ahora: Date): string {
  return MADRID.format(ahora).replace(',', '')
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
