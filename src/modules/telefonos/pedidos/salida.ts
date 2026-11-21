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

/** Spec 2026-11-18 §3: solo las filas pendientes o con «falta por enviar» que tienen fecha de salida. */
export function nivelSalida(f: FilaVista, hoy: string): NivelSalida | null {
  const e = estadoPantalla(f)
  if ((e !== 'PENDIENTE' && e !== 'FALTA_ENVIAR') || !f.fechaSalida) return null
  if (f.fechaSalida < hoy) return 'RETRASO'
  if (f.fechaSalida === hoy) return 'HOY'
  return f.fechaSalida === siguiente(hoy) ? 'MANANA' : 'LUEGO'
}

export function textoSalida(f: FilaVista, hoy: string): string | null {
  const n = nivelSalida(f, hoy)
  if (n === null) return null
  if (n === 'RETRASO') return 'Con retraso'
  if (n === 'HOY') return 'Sale hoy'
  if (n === 'MANANA') return 'Sale mañana'
  const d = new Date(`${f.fechaSalida}T12:00:00Z`)
  return `Sale ${DIAS[d.getUTCDay()]} ${f.fechaSalida!.slice(8, 10)}/${f.fechaSalida!.slice(5, 7)}`
}
