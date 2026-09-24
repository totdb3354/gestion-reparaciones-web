import { crearStore } from '@/shared/lib/store'
import { FILTROS_STOCK_VACIOS, type FiltrosStock } from './filtros'

/** Calco de la caché de vista del JavaFX (MainController.vistaCache, spec 4a S2): los filtros y la fila seleccionada de
 *  "Stock actual" sobreviven al cambio de pestaña y a la vuelta desde Reparaciones; se reinician al cerrar sesión
 *  (reiniciarStores). El id va como texto porque DataTable identifica las filas por string. */
export const filtrosStock = crearStore<FiltrosStock>(FILTROS_STOCK_VACIOS)
export const seleccionStock = crearStore<string | null>(null)
