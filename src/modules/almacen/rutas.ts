import type { Enlace } from '@/shared/lib/enlaces'

/** Sidebar de StockView.fxml (`stock-sidebar-btn`): "Stock actual" · "Pedidos" · "Proveedores", en ese orden, sin badges y
 *  para los tres roles (el botón "Stock" de la barra superior tampoco depende del rol). `end` en el primero: sin él,
 *  NavLink lo marcaría activo también en /stock/pedidos. */
export function enlacesStock(): Enlace[] {
  return [
    { to: '/stock', label: 'Stock actual', end: true },
    { to: '/stock/pedidos', label: 'Pedidos' },
    { to: '/stock/proveedores', label: 'Proveedores' },
  ]
}
