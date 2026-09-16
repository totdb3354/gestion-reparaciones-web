import type { ReparacionResumen } from '@/shared/api/client'
import { fechaLocal } from '@/shared/lib/fechas'
import { categoriaPieza } from './piezas'

export const SIN_CLIENTE = '(Sin cliente)'

export type TipoPendiente = 'solicitud' | 'incidencia' | 'asignacion'
export function tipoPendiente(rep: ReparacionResumen): TipoPendiente {
  if (rep.esSolicitud > 0) return 'solicitud'
  if (rep.esIncidencia) return 'incidencia'
  return 'asignacion'
}
export function pasaTipo(rep: ReparacionResumen, marcados: Set<TipoPendiente>): boolean {
  return marcados.size === 0 || marcados.has(tipoPendiente(rep))
}

export type EstadoIncidencia = 'abiertas' | 'cerradas' | 'sin'
export function estadoIncidencia(rep: ReparacionResumen): EstadoIncidencia {
  if (!rep.esIncidencia) return 'sin'
  return rep.esResuelto ? 'cerradas' : 'abiertas'
}
export function pasaIncidencias(rep: ReparacionResumen, marcados: Set<EstadoIncidencia>): boolean {
  return marcados.size === 0 || marcados.has(estadoIncidencia(rep))
}

/** Por fecha de fin en Madrid, extremos incluidos ('' = sin límite); sin fecha de fin y con rango → fuera. */
export function pasaFechas(rep: ReparacionResumen, desde: string, hasta: string): boolean {
  if (desde === '' && hasta === '') return true
  const fin = fechaLocal(rep.fechaFin)
  if (fin === null) return false
  if (desde !== '' && fin < desde) return false
  if (hasta !== '' && fin > hasta) return false
  return true
}

export function pasaImeis(imei: string, imeis: Set<string>): boolean {
  return imeis.size === 0 || imeis.has(imei)
}

export function pasaCliente(cliente: string | null | undefined, marcados: Set<string>): boolean {
  if (marcados.size === 0) return true
  return !cliente || cliente === '' ? marcados.has(SIN_CLIENTE) : marcados.has(cliente)
}

export function pasaPieza(tipoComponente: string | null | undefined, marcadas: Set<string>): boolean {
  return marcadas.size === 0 || marcadas.has(categoriaPieza(tipoComponente))
}

export function pasaTecnico(idTec: number, marcados: Set<number>): boolean {
  return marcados.size === 0 || marcados.has(idTec)
}

/** Urgentes primero, después con cliente, después el resto; estable (orden del servidor dentro de cada grupo). */
export function ordenarPendientes(lista: ReparacionResumen[]): ReparacionResumen[] {
  const rango = (r: ReparacionResumen) => (r.urgente ? 0 : r.cliente ? 1 : 2)
  return [...lista].sort((a, b) => rango(a) - rango(b))
}

/** "N pendientes" / "1 pendiente" / "999+ pendientes" (tope opcional). */
export function etiquetaContador(n: number, singular: string, plural: string, tope?: number): string {
  const numero = tope !== undefined && n > tope ? `${tope}+` : String(n)
  return `${numero} ${n === 1 ? singular : plural}`
}

/** Sufijo de los toggles de Pendientes, siempre presente y con tope 99+. */
export function sufijoToggle(n: number): string {
  return `(${n > 99 ? '99+' : n})`
}

/** Badge de la columna lateral: oculto a cero, tope 99+. */
export function textoBadgeLateral(total: number): string | null {
  if (total <= 0) return null
  return total > 99 ? '99+' : String(total)
}
