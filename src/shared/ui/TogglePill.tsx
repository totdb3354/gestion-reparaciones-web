import { NavLink } from 'react-router'
import { cn } from '@/shared/lib/utils'

export type OpcionToggle = { to: string; etiqueta: string }

/** Calco de toggle-pill-left/mid/right: píldora segmentada (extremos redondeados, centro recto, activo navy con texto
 *  blanco). Cada opción es un enlace porque los toggles del taller son rutas. */
export function TogglePill({ opciones, className }: { opciones: OpcionToggle[]; className?: string }) {
  return (
    <div role="group" className={cn('inline-flex', className)}>
      {opciones.map((o, i) => (
        <NavLink
          key={o.to}
          to={o.to}
          end
          className={({ isActive }) =>
            cn(
              'border border-pill-borde px-3.5 py-[5px] text-[12px] font-bold',
              i === 0 && 'rounded-l-3xl',
              i === opciones.length - 1 && 'rounded-r-3xl',
              i > 0 && '-ml-px',
              isActive ? 'border-azul-noche bg-azul-noche text-superficie' : 'bg-pill-bg text-azul-gris hover:bg-azul-medio/8',
            )
          }
        >
          {o.etiqueta}
        </NavLink>
      ))}
    </div>
  )
}
