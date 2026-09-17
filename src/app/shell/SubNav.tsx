import { NavLink, useLocation } from 'react-router'
import { enlacesReparaciones, type EnlaceTaller } from '@/modules/taller/rutas'
import { BadgePendientes } from '@/modules/taller/componentes/BadgePendientes'
import { cn } from '@/shared/lib/utils'
import { useSession } from '@/shared/session/SessionProvider'
import type { Sesion } from '@/shared/session/storage'

/** Enlaces de la columna por sección (primer segmento de la ruta) y rol. Cada sub-proyecto añade los suyos. */
const SUBNAV: Record<string, (sesion: Sesion | null) => EnlaceTaller[]> = {
  clientes: () => [{ to: '/clientes', label: 'Clientes' }],
  reparaciones: enlacesReparaciones,
}

export function SubNav() {
  const { pathname } = useLocation()
  const { sesion } = useSession()
  const seccion = pathname.split('/')[1]
  // Object.hasOwn: la sección viene de la URL y un /constructor resolvería a un miembro heredado de Object.prototype
  const enlaces = Object.hasOwn(SUBNAV, seccion) ? SUBNAV[seccion](sesion) : []
  return (
    <nav aria-label="Sub-navegación" className="w-[200px] shrink-0 bg-superficie p-2">
      {enlaces.map((e) => (
        <NavLink
          key={e.to}
          to={e.to}
          className={({ isActive }) =>
            cn(
              'flex w-full items-center rounded-3xl px-4 py-2.5 text-left text-[13px] font-bold',
              isActive ? 'bg-azul-noche text-texto-nav-activo' : 'text-azul-medio hover:bg-azul-medio/8',
            )
          }
        >
          {({ isActive }) => (
            <>
              {e.label}
              {e.badge === 'pendientes' && <BadgePendientes activo={isActive} />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
