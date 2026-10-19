import { cn } from '@/shared/lib/utils'
import { textoCapacidad, type Pestana } from './modelo'

type Props = { pestanas: Pestana[]; elegida: string | null; onElegir: (capacidad: string | null) => void }

/** Pestañas de capacidad a la derecha del nombre del modelo (spec 0.9.18 §4.3): «Todas» y una por capacidad, con su número
 *  de stock; sin nada que enseñar, apagadas. */
export function PestanasCapacidad({ pestanas, elegida, onElegir }: Props) {
  return (
    <div role="group" aria-label="Capacidad" className="flex overflow-hidden rounded-lg border border-borde-input">
      {pestanas.map((p) => {
        const texto = p.capacidad === null ? 'Todas' : textoCapacidad(p.capacidad)
        const on = p.capacidad === elegida
        return (
          <button key={p.capacidad ?? ''} type="button" aria-label={`${texto}: ${p.stock}`} aria-pressed={on} disabled={!p.activa}
            onClick={() => onElegir(p.capacidad)}
            className={cn('cursor-pointer border-r border-borde-input px-3 py-1 text-[12px] font-semibold whitespace-nowrap last:border-r-0',
              on ? 'bg-azul-noche text-superficie' : 'bg-superficie text-azul-medio hover:bg-seleccion-suave',
              'disabled:cursor-default disabled:text-texto-suave disabled:hover:bg-superficie')}>
            {texto}<span className={cn('ml-1', on ? 'text-[#c9d3e6]' : 'text-azul-gris')}>{p.stock}</span>
          </button>
        )
      })}
    </div>
  )
}
