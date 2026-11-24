import type { FilaVista } from '@/shared/api/client'
import { estadoPantalla } from './filas'

export type NivelSalida = 'RETRASO' | 'HOY' | 'MANANA' | 'LUEGO'
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** Día siguiente a una fecha ISO (yyyy-mm-dd), sin husos: se trabaja con el día de Madrid ya calculado. */
function siguiente(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Día de la semana de una fecha ISO (0 = domingo, 6 = sábado). */
function diaSemana(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay()
}

/** El lunes siguiente a una fecha ISO. */
function lunesSiguiente(iso: string): string {
  let d = siguiente(iso)
  while (diaSemana(d) !== 1) d = siguiente(d)
  return d
}

/** La fecha con la que se calcula el nivel (spec 2026-11-23 «salida web 24 h»). Sin `salidaDesde` (Amazon), el límite. En las webs:
 *  «desde» si aún no ha llegado; hoy si está dentro del plazo (el lunes siguiente si hoy es sábado o domingo); el límite si ya pasó.
 *  La web no conoce los festivos: un festivo entre semana dentro del plazo sale «Sale hoy» (el límite, que sí los cuenta, no cambia). */
export function fechaReferencia(f: FilaVista, hoy: string): string | null {
  if (!f.fechaSalida) return null
  const desde = f.salidaDesde
  if (!desde || hoy > f.fechaSalida) return f.fechaSalida
  if (hoy < desde) return desde
  const d = diaSemana(hoy)
  return d === 0 || d === 6 ? lunesSiguiente(hoy) : hoy
}

/** Spec 2026-11-18 §3: solo las filas pendientes o con «falta por enviar» que tienen fecha de salida. */
export function nivelSalida(f: FilaVista, hoy: string): NivelSalida | null {
  const e = estadoPantalla(f)
  if ((e !== 'PENDIENTE' && e !== 'FALTA_ENVIAR') || !f.fechaSalida) return null
  const ref = fechaReferencia(f, hoy)!
  if (ref < hoy) return 'RETRASO'
  if (ref === hoy) return 'HOY'
  return ref === siguiente(hoy) ? 'MANANA' : 'LUEGO'
}

export function textoSalida(f: FilaVista, hoy: string): string | null {
  const n = nivelSalida(f, hoy)
  if (n === null) return null
  if (n === 'RETRASO') return 'Con retraso'
  if (n === 'HOY') return 'Sale hoy'
  if (n === 'MANANA') return 'Sale mañana'
  const ref = fechaReferencia(f, hoy)!
  return `Sale ${DIAS[diaSemana(ref)]} ${ref.slice(8, 10)}/${ref.slice(5, 7)}`
}
