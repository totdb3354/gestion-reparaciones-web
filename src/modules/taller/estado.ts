import { crearStore } from '@/shared/lib/store'
import type { EstadoIncidencia, TipoPendiente } from './lib/filtros'

/** Filtros que sobreviven al cambio de ruta dentro del taller (calco de los campos de los controllers del JavaFX). */
export const filtroImeiPendientes = crearStore('')
const tipoVacio = (): Set<TipoPendiente> => new Set()
export const tipoPendientes = {
  REPARACION: crearStore(tipoVacio()),
  GLASS: crearStore(tipoVacio()),
}

export type FiltrosHistorial = { tecnicos: Set<number>; piezas: Set<string>; desde: string; hasta: string; incidencias: Set<EstadoIncidencia> }
const historialVacio = (): FiltrosHistorial => ({ tecnicos: new Set(), piezas: new Set(), desde: '', hasta: '', incidencias: new Set() })
export const filtroImeiHistorial = crearStore('')
export const filtrosHistorial = {
  REPARACION: crearStore<FiltrosHistorial>(historialVacio()),
  GLASS: crearStore<FiltrosHistorial>(historialVacio()),
  PULIDO: crearStore<FiltrosHistorial>(historialVacio()),
}

export type FiltrosImeis = { imei: string; tecnicos: Set<number>; clientes: Set<string>; desde: string; hasta: string; incidencias: Set<EstadoIncidencia> }
const imeisVacios = (): FiltrosImeis => ({ imei: '', tecnicos: new Set(), clientes: new Set(), desde: '', hasta: '', incidencias: new Set() })
/** Valor vacío para consumidores como "Limpiar filtros" (`filtrosImeis.set(FILTROS_IMEIS_VACIOS)`, Task 18).
 *  Object.freeze evita reasignar sus campos de primer nivel, pero OJO: no congela los Set anidados (tecnicos/
 *  clientes/incidencias), así que por sí solo no evita `FILTROS_IMEIS_VACIOS.tecnicos.add(x)`. La protección de
 *  verdad es que esta constante es una copia propia, distinta del valor inicial interno del store (otra llamada
 *  a imeisVacios(), más abajo): si compartieran el mismo objeto, mutar en sitio el valor vivo del store
 *  (p.ej. `filtrosImeis.get().tecnicos.add(x)`, posible tras ese .set()) corrompería también el reset() del
 *  store, que restaura por referencia (ver crearStore). */
export const FILTROS_IMEIS_VACIOS: FiltrosImeis = Object.freeze(imeisVacios())
export const filtrosImeis = crearStore<FiltrosImeis>(imeisVacios())
/** IMEI del detalle del que se vuelve: el maestro lo reselecciona y desplaza hasta él. */
export const ultimoImeiVisto = crearStore<string | null>(null)

export function reiniciarEstadoTaller() {
  filtroImeiPendientes.reset()
  tipoPendientes.REPARACION.reset()
  tipoPendientes.GLASS.reset()
  filtroImeiHistorial.reset()
  filtrosHistorial.REPARACION.reset()
  filtrosHistorial.GLASS.reset()
  filtrosHistorial.PULIDO.reset()
  filtrosImeis.reset()
  ultimoImeiVisto.reset()
}
