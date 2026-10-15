import { crearStore } from '@/shared/lib/store'
import { FILTROS_PEDIDOS_VACIOS, type FiltrosPedidos } from './filtros'

/** Caché de vista del JavaFX (spec 4a S2, 4b P4): los filtros sobreviven al cambio de sección
 *  y a la vuelta desde Reparaciones; la fila seleccionada se guarda por su `claveLinea` (`p-{id}` u `o-{id}`: piezas y
 *  otros van en una sola lista desde la 0.9.15). Se reinician al cerrar sesión (reiniciarStores). */
export const filtrosPedidos = crearStore<FiltrosPedidos>(FILTROS_PEDIDOS_VACIOS)
export const seleccionPedidos = crearStore<string | null>(null)

/** 0.9.9 (spec §6.2): bloques plegados o desplegados a mano durante la sesión. Con filtros va aparte (`filtrado`) y solo
 *  vale para la firma de filtros con la que se guardó: cambiar los filtros lo olvida. Se reinicia al cerrar sesión. */
export type PlegadoBloques = { normal: Record<string, boolean>; filtrado: { firma: string; mapa: Record<string, boolean> } }
export const plegadoBloques = crearStore<PlegadoBloques>({ normal: {}, filtrado: { firma: '', mapa: {} } })
