import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { enlacesStock } from '@/modules/almacen/rutas'
import { enlacesReparaciones } from '@/modules/taller/rutas'
import { BadgeAsignaciones } from '@/modules/taller/asignaciones/BadgeAsignaciones'
import { BadgePendientes } from '@/modules/taller/componentes/BadgePendientes'
import type { Enlace } from '@/shared/lib/enlaces'
import { cn } from '@/shared/lib/utils'
import { useSession } from '@/shared/session/SessionProvider'
import type { Sesion } from '@/shared/session/storage'
import { guardarPlegada, leerPlegada } from './preferencias'

/** Enlaces de la columna por sección (primer segmento de la ruta) y rol. Cada sub-proyecto añade los suyos. */
const SUBNAV: Record<string, (sesion: Sesion | null) => Enlace[]> = {
  clientes: () => [{ to: '/clientes', label: 'Clientes', icono: Users }],
  reparaciones: enlacesReparaciones,
  stock: enlacesStock,
}

/** Id de la columna: el botón de plegar la señala con `aria-controls`. */
const ID_COLUMNA = 'columna-lateral'

/**
 * Columna lateral de sub-navegación. Plegable desde la 0.9.10 (spec «Columna lateral plegable»; adaptación web, sin calco
 * en el JavaFX): abierta mide 200 px con icono y nombre; plegada, 56 px con solo los iconos. El botón redondo del borde la
 * pliega y la despliega, y el navegador recuerda cómo se dejó. Las tablas de las vistas se recolocan solas al cambiar el
 * ancho (ResizeObserver de DataTable).
 */
export function SubNav() {
  const { pathname } = useLocation()
  const { sesion } = useSession()
  const [plegada, setPlegada] = useState(leerPlegada)
  const seccion = pathname.split('/')[1]
  // Object.hasOwn: la sección viene de la URL y un /constructor resolvería a un miembro heredado de Object.prototype
  const enlaces = Object.hasOwn(SUBNAV, seccion) ? SUBNAV[seccion](sesion) : []
  // Sin enlaces (Estadísticas, Gestión) no hay columna: el contenido se queda con todo el ancho (0.9.10).
  if (enlaces.length === 0) return null
  const alternar = () => {
    setPlegada(!plegada)
    guardarPlegada(!plegada)
  }
  const accion = plegada ? 'Mostrar menú lateral' : 'Ocultar menú lateral'
  return (
    <nav
      id={ID_COLUMNA}
      aria-label="Sub-navegación"
      className={cn(
        'relative shrink-0 bg-superficie transition-[width] duration-[180ms] ease-in-out motion-reduce:transition-none',
        plegada ? 'w-14' : 'w-[200px]',
      )}
    >
      {/* overflow-hidden: al desplegar, los nombres aparecen antes de que la columna termine de crecer. A la derecha se
          deja sitio para el botón, que monta sobre el borde. */}
      <div className={cn('flex flex-col overflow-hidden py-2', plegada ? 'pr-3.5 pl-1.5' : 'pr-[18px] pl-2')}>
        {enlaces.map((e) => (
          <EnlaceLateral key={e.to} enlace={e} plegada={plegada} />
        ))}
      </div>
      <button
        type="button"
        onClick={alternar}
        aria-label={accion}
        title={accion}
        aria-expanded={!plegada}
        aria-controls={ID_COLUMNA}
        className="absolute top-3.5 -right-3 z-10 flex size-6 cursor-pointer items-center justify-center rounded-full border border-pill-borde bg-superficie text-azul-medio shadow-sm hover:bg-seleccion-suave"
      >
        {plegada ? <ChevronRight aria-hidden className="size-3.5" /> : <ChevronLeft aria-hidden className="size-3.5" />}
      </button>
    </nav>
  )
}

/** Un enlace de la columna. Plegada, solo el icono: el nombre pasa al `aria-label`, porque deja de verse. */
function EnlaceLateral({ enlace: e, plegada }: { enlace: Enlace; plegada: boolean }) {
  return (
    <NavLink
      to={e.to}
      end={e.end}
      aria-label={plegada ? e.label : undefined}
      className={({ isActive }) =>
        cn(
          'relative flex w-full items-center rounded-3xl py-2.5 text-left text-[13px] font-bold whitespace-nowrap',
          plegada ? 'justify-center' : 'px-4',
          isActive ? 'bg-azul-noche text-texto-nav-activo' : 'text-azul-medio hover:bg-azul-medio/8',
        )
      }
    >
      {({ isActive }) => (
        <>
          <e.icono aria-hidden className={cn('size-[18px] shrink-0', !plegada && 'mr-2.5')} />
          {!plegada && e.label}
          {e.badge === 'pendientes' && <BadgePendientes activo={isActive} />}
          {e.badge === 'asignaciones' && <BadgeAsignaciones activo={isActive} />}
        </>
      )}
    </NavLink>
  )
}
