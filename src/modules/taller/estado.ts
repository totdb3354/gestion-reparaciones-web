import { crearStore } from '@/shared/lib/store'
import type { EstadoIncidencia, TipoPendiente } from './lib/filtros'

/** Filtros que sobreviven al cambio de ruta dentro del taller (calco de los campos de los controllers del JavaFX). */
export const filtroImeiPendientes = crearStore('')
export const tipoPendientes = {
  REPARACION: crearStore(new Set<TipoPendiente>()),
  GLASS: crearStore(new Set<TipoPendiente>()),
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
export const FILTROS_IMEIS_VACIOS: FiltrosImeis = { imei: '', tecnicos: new Set(), clientes: new Set(), desde: '', hasta: '', incidencias: new Set() }
export const filtrosImeis = crearStore<FiltrosImeis>(FILTROS_IMEIS_VACIOS)
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
