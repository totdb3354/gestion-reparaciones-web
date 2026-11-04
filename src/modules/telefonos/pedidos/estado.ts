import { crearStore } from '@/shared/lib/store'
import type { Filtros } from './pedidos'

/** Lo que el usuario ha elegido en «Pedidos»: el interruptor de los viejos, los filtros, la unidad elegida y los pedidos
 *  desplegados. Vive en un store de módulo (no en `useState`) para que «← Volver» desde «Ver rastro» (o el botón Atrás del
 *  navegador) lo deje todo donde estaba, como el stock de teléfonos; `reiniciarStores` lo limpia al cerrar sesión. */
export type EstadoPedidos = {
  viejos: boolean
  filtros: Filtros
  /** `idUnidad` de la unidad elegida; null es «la de por defecto». */
  elegida: number | null
  expandidos: Set<number>
}

export const estadoPedidos = crearStore<EstadoPedidos>({
  viejos: false, filtros: { canales: new Set(), grupos: new Set(), texto: '' }, elegida: null, expandidos: new Set(),
})
