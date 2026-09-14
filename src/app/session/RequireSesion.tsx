import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from './SessionProvider'

export function RequireSesion() {
  const { sesion } = useSession()
  const location = useLocation()
  if (!sesion) return <Navigate to="/login" replace state={{ desde: location.pathname }} />
  return <Outlet />
}
