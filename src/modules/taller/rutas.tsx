import { Navigate, Outlet } from 'react-router'
import { useSession } from '@/shared/session/SessionProvider'
import { esAdmin, esAdminOSuperTecnico, type Sesion } from '@/shared/session/storage'

export type EnlaceTaller = { to: string; label: string; badge?: 'pendientes' }

/** Columna lateral de Reparaciones en el orden del JavaFX: TECNICO Pendientes·Historial·IMEIs; SUPERTECNICO
 *  Asignaciones·Pendientes·Historial·IMEIs; ADMIN Asignaciones·Historial·IMEIs. */
// eslint-disable-next-line react-refresh/only-export-components -- la función vive con las rutas que la usan, patrón del proyecto
export function enlacesReparaciones(sesion: Sesion | null): EnlaceTaller[] {
  const enlaces: EnlaceTaller[] = []
  if (esAdminOSuperTecnico(sesion)) enlaces.push({ to: '/reparaciones/asignaciones', label: 'Asignaciones' })
  if (!esAdmin(sesion) && sesion?.idTec != null) enlaces.push({ to: '/reparaciones/pendientes', label: 'Pendientes', badge: 'pendientes' })
  enlaces.push({ to: '/reparaciones/historial', label: 'Historial' }, { to: '/reparaciones/imeis', label: 'IMEIs' })
  return enlaces
}

/** Entrada por rol (spec web-taller §4.1): TECNICO en Pendientes; ADMIN y, hasta el sub-proyecto 3, SUPERTECNICO en Historial. */
export function InicioReparaciones() {
  const { sesion } = useSession()
  const aPendientes = !esAdminOSuperTecnico(sesion) && sesion?.idTec != null
  return <Navigate to={aPendientes ? '/reparaciones/pendientes' : '/reparaciones/historial'} replace />
}

/** Pendientes exige técnico en sesión: el ADMIN (sin idTec) va a Historial. */
export function RequiereTecnico() {
  const { sesion } = useSession()
  if (esAdmin(sesion) || sesion?.idTec == null) return <Navigate to="/reparaciones/historial" replace />
  return <Outlet />
}
