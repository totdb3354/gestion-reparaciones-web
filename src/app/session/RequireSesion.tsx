import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '@/shared/session/SessionProvider'

/** Ruta que la sesión ve mientras la contraseña sea la temporal que entregó el administrador (spec sp7b §5.4). */
export const RUTA_CAMBIO_OBLIGATORIO = '/cuenta/cambiar-obligatorio'

export function RequireSesion() {
  const { sesion } = useSession()
  const location = useLocation()
  if (!sesion) return <Navigate to="/login" replace state={{ desde: location.pathname }} />
  // Con una contraseña temporal solo se puede hacer una cosa: ponerse una propia. Cualquier otra ruta vuelve ahí.
  if (sesion.passwordTemporal && location.pathname !== RUTA_CAMBIO_OBLIGATORIO) {
    return <Navigate to={RUTA_CAMBIO_OBLIGATORIO} replace />
  }
  // Y sin la marca no hay nada que cambiar: una pestaña que se quedó en esa pantalla cuando otra ya cambió la
  // contraseña (o que llega a ella por la dirección) vuelve sola al inicio.
  if (!sesion.passwordTemporal && location.pathname === RUTA_CAMBIO_OBLIGATORIO) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
