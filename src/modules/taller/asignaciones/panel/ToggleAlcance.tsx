import { cn } from '@/shared/lib/utils'
import type { Alcance } from '../carga'

/** Los dos botones del toggle, en el orden del JavaFX. */
const ALCANCES: { clave: Alcance; etiqueta: string }[] = [
  { clave: 'pedidos', etiqueta: 'Pedidos' },
  { clave: 'total', etiqueta: 'Total' },
]

/** Pedidos | Total del panel de carga: calco de toggle-pill en pequeño. No es el TogglePill de shared: aquel navega (son
 *  NavLink), y aquí el alcance es una preferencia del panel que no toca la ruta ni vuelve al servidor (D3: la respuesta trae
 *  los dos alcances). `data-no-arrastre`: va en la cabecera, que es el asa del arrastre. */
export function ToggleAlcance({ valor, onCambio }: { valor: Alcance; onCambio: (alcance: Alcance) => void }) {
  return (
    // title="": la cabecera lleva «Arrastra para moverlo» y los botones lo heredarían como tooltip; vacío lo corta.
    <div role="group" aria-label="Alcance de la carga" title="" className="inline-flex">
      {ALCANCES.map((a, i) => (
        <button
          key={a.clave}
          type="button"
          data-no-arrastre
          aria-pressed={valor === a.clave}
          onClick={() => onCambio(a.clave)}
          className={cn(
            'cursor-pointer border border-pill-borde px-2.5 py-[3px] text-[11px] font-bold',
            i === 0 ? 'rounded-l-3xl' : '-ml-px rounded-r-3xl',
            valor === a.clave ? 'border-azul-noche bg-azul-noche text-superficie' : 'bg-pill-bg text-azul-gris hover:bg-azul-medio/8',
          )}
        >
          {a.etiqueta}
        </button>
      ))}
    </div>
  )
}
