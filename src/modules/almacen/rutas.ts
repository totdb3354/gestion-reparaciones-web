import { Building2, Package, ShoppingCart } from 'lucide-react'
import type { Enlace } from '@/shared/lib/enlaces'

/** Sidebar de StockView.fxml (`stock-sidebar-btn`): "Stock actual" · "Pedidos" · "Proveedores", en ese orden, sin badges y
 *  para los tres roles (el botón "Stock" de la barra superior tampoco depende del rol). `end` en el primero: sin él,
 *  NavLink lo marcaría activo también en /stock/pedidos. Iconos desde la 0.9.10. */
export function enlacesStock(): Enlace[] {
  return [
    { to: '/stock', label: 'Stock actual', icono: Package, end: true },
    { to: '/stock/pedidos', label: 'Pedidos', icono: ShoppingCart },
    { to: '/stock/proveedores', label: 'Proveedores', icono: Building2 },
  ]
}
