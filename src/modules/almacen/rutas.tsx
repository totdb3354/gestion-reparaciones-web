import { useEffect } from 'react'
import { Building2, Package, ShoppingCart } from 'lucide-react'
import { Navigate, Outlet } from 'react-router'
import { MSG_SIN_PERMISOS } from '@/shared/api/errors'
import type { Enlace } from '@/shared/lib/enlaces'
import { useSession } from '@/shared/session/SessionProvider'
import { esAdminOSuperTecnico, type Sesion } from '@/shared/session/storage'
import { useAlerta } from '@/shared/ui/AlertaProvider'

/** Sidebar de StockView.fxml (`stock-sidebar-btn`): "Stock actual" · "Pedidos" · "Proveedores", en ese orden y sin badges.
 *  Desde la 0.9.16 (spec «El técnico sin Pedidos ni Proveedores») Pedidos y Proveedores son de SUPERTECNICO y ADMIN: el
 *  TECNICO (y cualquier otro rol, o sin sesión) se queda con "Stock actual". `end` en el primero: sin él, NavLink lo marcaría
 *  activo también en /stock/pedidos. Iconos desde la 0.9.10. */
// eslint-disable-next-line react-refresh/only-export-components -- la función vive con las rutas que la usan, patrón del proyecto
export function enlacesStock(sesion: Sesion | null): Enlace[] {
  const enlaces: Enlace[] = [{ to: '/stock', label: 'Stock actual', icono: Package, end: true }]
  if (esAdminOSuperTecnico(sesion)) {
    enlaces.push(
      { to: '/stock/pedidos', label: 'Pedidos', icono: ShoppingCart },
      { to: '/stock/proveedores', label: 'Proveedores', icono: Building2 },
    )
  }
  return enlaces
}

/** Pedidos y Proveedores (0.9.16): SUPERTECNICO y ADMIN, este en solo lectura. El TECNICO no tiene las pestañas, así que solo
 *  llega por URL: recibe el aviso genérico y sale a /stock. Mismo patrón que RequiereSupertecnicoOAdmin (modules/taller/rutas.tsx),
 *  copiado porque un módulo no importa de otro, y con otro nombre porque router.tsx importa los dos. */
export function RequiereAccesoPedidos() {
  const { sesion } = useSession()
  const { mostrarError } = useAlerta()
  const permitido = esAdminOSuperTecnico(sesion)
  useEffect(() => {
    if (!permitido) mostrarError(MSG_SIN_PERMISOS)
  }, [permitido, mostrarError])
  if (!permitido) return <Navigate to="/stock" replace />
  return <Outlet />
}
