import { crearStore } from '@/shared/lib/store'

/** Última pestaña de Stock visitada, para el botón "Stock" de la barra superior: calco de la caché de vista del JavaFX
 *  (MainController.vistaCache, spec 4a S2), que al volver desde Reparaciones conserva la pestaña del sidebar
 *  (stock-cache-vuelta.png). La fijan StockPage y ProveedoresPage al entrar; vuelve a "/stock" al cerrar sesión
 *  (reiniciarStores). */
export const ultimaRutaStock = crearStore<string>('/stock')
