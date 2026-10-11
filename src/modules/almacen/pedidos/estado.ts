import { crearStore, type Store } from '@/shared/lib/store'
import { FILTROS_PEDIDOS_VACIOS, type FiltrosPedidos } from './filtros'
import type { TipoPedido } from './reglas'

/** Caché de vista del JavaFX (spec 4a S2, 4b P4): los filtros son uno para los dos toggles y sobreviven al cambio de toggle,
 *  de sección y a la vuelta desde Reparaciones; la fila seleccionada es una por toggle (id como texto, como DataTable).
 *  Se reinician al cerrar sesión (reiniciarStores). */
export const filtrosPedidos = crearStore<FiltrosPedidos>(FILTROS_PEDIDOS_VACIOS)
export const seleccionPedidos: Record<TipoPedido, Store<string | null>> = {
  componentes: crearStore<string | null>(null),
  otros: crearStore<string | null>(null),
}

/** 0.9.9 (spec §6.2): bloques plegados o desplegados a mano durante la sesión. Con filtros va aparte (`filtrado`) y solo
 *  vale para la firma de filtros con la que se guardó: cambiar los filtros lo olvida. Se reinicia al cerrar sesión. */
export type PlegadoBloques = { normal: Record<string, boolean>; filtrado: { firma: string; mapa: Record<string, boolean> } }
export const plegadoBloques = crearStore<PlegadoBloques>({ normal: {}, filtrado: { firma: '', mapa: {} } })
