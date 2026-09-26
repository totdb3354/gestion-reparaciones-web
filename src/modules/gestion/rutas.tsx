import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router'
import { MSG_SIN_PERMISOS } from '@/shared/api/errors'
import { useSession } from '@/shared/session/SessionProvider'
import { esAdmin } from '@/shared/session/storage'
import { useAlerta } from '@/shared/ui/AlertaProvider'

/** "Gestionar técnicos" y "Ver logs" (spec 6, §6.4 y Roles): solo ADMIN. TECNICO y SUPERTECNICO no tienen las entradas del
 *  menú, así que solo llegan por URL: reciben el aviso genérico y salen a /reparaciones, que ya reparte por rol. Mismo
 *  patrón que RequiereSupertecnicoOAdmin (modules/taller/rutas.tsx), copiado porque un módulo no importa de otro. */
export function RequiereAdmin() {
  const { sesion } = useSession()
  const { mostrarError } = useAlerta()
  const permitido = esAdmin(sesion)
  useEffect(() => {
    if (!permitido) mostrarError(MSG_SIN_PERMISOS)
  }, [permitido, mostrarError])
  if (!permitido) return <Navigate to="/reparaciones" replace />
  return <Outlet />
}
