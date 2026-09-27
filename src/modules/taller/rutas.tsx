import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { MSG_SIN_PERMISOS } from '@/shared/api/errors'
import { useSession } from '@/shared/session/SessionProvider'
import { esAdmin, esAdminOSuperTecnico, esSuperTecnico, type Sesion } from '@/shared/session/storage'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import type { Enlace } from '@/shared/lib/enlaces'

export type EnlaceTaller = Enlace

/** Columna lateral de Reparaciones en el orden del JavaFX: TECNICO Pendientes·Historial·IMEIs; SUPERTECNICO
 *  Asignaciones·Pendientes·Historial·IMEIs; ADMIN Asignaciones·Historial·IMEIs. */
// eslint-disable-next-line react-refresh/only-export-components -- la función vive con las rutas que la usan, patrón del proyecto
export function enlacesReparaciones(sesion: Sesion | null): EnlaceTaller[] {
  const enlaces: EnlaceTaller[] = []
  // El badge de Asignaciones (total de la tabla unificada) es solo del supertécnico: para el ADMIN desaparece (spec 3a §12).
  if (esSuperTecnico(sesion)) enlaces.push({ to: '/reparaciones/asignaciones', label: 'Asignaciones', badge: 'asignaciones' })
  else if (esAdmin(sesion)) enlaces.push({ to: '/reparaciones/asignaciones', label: 'Asignaciones' })
  if (!esAdmin(sesion) && sesion?.idTec != null) enlaces.push({ to: '/reparaciones/pendientes', label: 'Pendientes', badge: 'pendientes' })
  enlaces.push({ to: '/reparaciones/historial', label: 'Historial' }, { to: '/reparaciones/imeis', label: 'IMEIs' })
  return enlaces
}

/** Entrada por rol al pulsar "Reparaciones" y tras el login, calco del JavaFX (hotfix/0.16.3): MainController.initialize()
 *  abre la vista de Reparaciones del rol (MainController.java:111 → mostrarReparaciones :763-769).
 *  - SUPERTECNICO → Asignaciones: `ReparacionControllerSuperTecnico.initialize()` termina con
 *    `mostrarPanel(pnlPendientes, btnTabPendientes)` (ReparacionControllerSuperTecnico.java:229), y ese panel es la
 *    pestaña "Asignaciones" (ReparacionViewSuperTecnico.fxml:28 y :115-116, PendientesSuperTecnicoView).
 *  - ADMIN → Historial: `pnlHistorial visible="true"` (ReparacionViewAdmin.fxml:41; `irAInicio` :209 no cambia de panel).
 *  - TECNICO → sus pendientes: `pnlMisPendientes visible="true"` (ReparacionViewTecnico.fxml:105).
 *  Sin técnico en sesión (no debería ocurrir fuera del ADMIN) se va a Historial. */
export function InicioReparaciones() {
  const { sesion } = useSession()
  if (esSuperTecnico(sesion)) return <Navigate to="/reparaciones/asignaciones" replace />
  const aPendientes = !esAdminOSuperTecnico(sesion) && sesion?.idTec != null
  return <Navigate to={aPendientes ? '/reparaciones/pendientes' : '/reparaciones/historial'} replace />
}

/** Pendientes exige técnico en sesión: el ADMIN (sin idTec) va a Historial. */
export function RequiereTecnico() {
  const { sesion } = useSession()
  if (esAdmin(sesion) || sesion?.idTec == null) return <Navigate to="/reparaciones/historial" replace />
  return <Outlet />
}

/** Asignaciones la abren SUPERTECNICO y ADMIN (spec 3a, D6; el ADMIN entra en solo lectura). El TECNICO no tiene la
 *  entrada en el lateral, así que solo llega por URL: recibe el aviso genérico y sale a /reparaciones, que ya reparte
 *  por rol. Mismo patrón que RequiereSupertecnico; el destino es fijo porque esta ruta no cuelga de ninguna lista. */
export function RequiereSupertecnicoOAdmin() {
  const { sesion } = useSession()
  const { mostrarError } = useAlerta()
  const permitido = esAdminOSuperTecnico(sesion)
  useEffect(() => {
    if (!permitido) mostrarError(MSG_SIN_PERMISOS)
  }, [permitido, mostrarError])
  if (!permitido) return <Navigate to="/reparaciones" replace />
  return <Outlet />
}

/** La edición de una reparación ya hecha es solo del supertécnico (el servidor exige el mismo rol). Quien llegue por URL
 *  sin serlo recibe el aviso genérico y vuelve a la lista de la que cuelga la ruta: se quita el tramo "/editar/<idRep>". */
export function RequiereSupertecnico() {
  const { sesion } = useSession()
  const { mostrarError } = useAlerta()
  const { pathname } = useLocation()
  const permitido = esSuperTecnico(sesion)
  useEffect(() => {
    if (!permitido) mostrarError(MSG_SIN_PERMISOS)
  }, [permitido, mostrarError])
  if (!permitido) return <Navigate to={pathname.replace(/\/editar\/[^/]+\/?$/, '')} replace />
  return <Outlet />
}
