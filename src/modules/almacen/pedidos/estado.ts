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
