import { conEfecto } from './base'
import type { EstadoModal } from './tipos'

/** 0.9.23 (spec 2026-11-03 §2.1): pide a NSYS los IMEIs que aún no se han preguntado mientras el modal está abierto y los
 *  apunta con `null`, así una respuesta en camino no se pide dos veces. Sin IMEIs nuevos, no pide nada. */
export function preguntarNsys(s: EstadoModal, imeis: string[]): EstadoModal {
  const nuevos = [...new Set(imeis)].filter((imei) => !(imei in s.enNsys))
  if (nuevos.length === 0) return s
  const enNsys = { ...s.enNsys, ...Object.fromEntries(nuevos.map((imei) => [imei, null])) }
  return conEfecto({ ...s, enNsys }, { tipo: 'comprobarNsys', imeis: nuevos })
}

/** La respuesta de NSYS: `true` lo tiene, `false` no. Un IMEI que no viene se queda como estaba. */
export const nsysComprobado = (s: EstadoModal, resultado: Record<string, boolean>): EstadoModal =>
  ({ ...s, enNsys: { ...s.enNsys, ...resultado } })
