import { useEffect } from 'react'
import { Smartphone } from 'lucide-react'
import { Navigate, Outlet } from 'react-router'
import { MSG_SIN_PERMISOS } from '@/shared/api/errors'
import type { Enlace } from '@/shared/lib/enlaces'
import { useSession } from '@/shared/session/SessionProvider'
import { esAdminOSuperTecnico, type Sesion } from '@/shared/session/storage'
import { useAlerta } from '@/shared/ui/AlertaProvider'

/** Grupo «Teléfonos» (0.9.17, spec «Pieza 1 del módulo de teléfonos» §3): solo SUPERTECNICO y ADMIN. El TECNICO (o sin
 *  sesión) no tiene grupo. */
// eslint-disable-next-line react-refresh/only-export-components -- la función vive con las rutas que la usan, patrón del proyecto
export function enlacesTelefonos(sesion: Sesion | null): Enlace[] {
  return esAdminOSuperTecnico(sesion) ? [{ to: '/telefonos/stock', label: 'Stock de teléfonos', icono: Smartphone }] : []
}

/** El TECNICO que llega por la dirección recibe el aviso genérico y vuelve a /reparaciones. Mismo patrón que
 *  RequiereAccesoPedidos (modules/almacen/rutas.tsx), copiado porque un módulo no importa de otro. */
export function RequiereAccesoTelefonos() {
  const { sesion } = useSession()
  const { mostrarError } = useAlerta()
  const permitido = esAdminOSuperTecnico(sesion)
  useEffect(() => {
    if (!permitido) mostrarError(MSG_SIN_PERMISOS)
  }, [permitido, mostrarError])
  if (!permitido) return <Navigate to="/reparaciones" replace />
  return <Outlet />
}
