import { NavLink, useLocation } from 'react-router'
import { cn } from '@/shared/lib/utils'

type Enlace = { to: string; label: string }

/** Enlaces de la columna por sección (primer segmento de la ruta). Cada sub-proyecto añade los suyos al
 *  migrar su vista; las secciones que aún no están migradas no aparecen aquí y dejan la columna vacía.
 *  reparaciones: [{ to: '/reparaciones', label: 'Reparaciones' }, ...]   // sub-proyectos 1 y 2
 *  stock: [{ to: '/stock/telefonos', label: 'Teléfonos' }, ...]          // sub-proyecto 3
 *  estadisticas: [...]                                                   // sub-proyecto 4 */
const SUBNAV: Record<string, Enlace[]> = {
  clientes: [{ to: '/clientes', label: 'Clientes' }],
}

/** Calco de la columna lateral del JavaFX (`.stock-sidebar`): 200 px blancos bajo la barra, con la
 *  sub-navegación de la sección actual. Siempre visible, aunque la sección no tenga enlaces, para que la
 *  geometría del contenido no cambie de una vista a otra. */
export function SubNav() {
  const { pathname } = useLocation()
  const seccion = pathname.split('/')[1] ?? ''
  // `Object.hasOwn` y no `SUBNAV[seccion] ?? []`: la sección viene de la URL, y un `/constructor` o un
  // `/__proto__` resolverían a un miembro heredado de Object.prototype (una función, no un array) y harían
  // reventar el `.map`. Con el catch-all del router dentro de AppLayout, esa ruta llega a pintarse.
  const enlaces = Object.hasOwn(SUBNAV, seccion) ? SUBNAV[seccion] : []
  return (
    <aside className="w-[200px] shrink-0 bg-white p-2">
      {enlaces.map((e) => (
        <NavLink
          key={e.to}
          to={e.to}
          className={({ isActive }) =>
            cn(
              'block w-full rounded-3xl px-4 py-2.5 text-left text-[13px] font-bold',
              isActive ? 'bg-azul-noche text-texto-nav-activo' : 'text-azul-medio hover:bg-azul-medio/8',
            )
          }
        >
          {e.label}
        </NavLink>
      ))}
    </aside>
  )
}
