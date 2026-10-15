import { cn } from '@/shared/lib/utils'
import type { TipoFiltro } from './filtros'

const OPCIONES: { valor: TipoFiltro; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'piezas', etiqueta: 'Piezas' },
  { valor: 'otros', etiqueta: 'Otros' },
]

/** Filtro «Tipo» de Pedidos (0.9.15, spec «Añadir otro» §5.1 y prototipo): segmentado «Todos | Piezas | Otros» con la
 *  etiqueta delante, como una píldora de la barra. */
export function FiltroTipo({ valor, onChange }: { valor: TipoFiltro; onChange: (tipo: TipoFiltro) => void }) {
  return (
    <div role="radiogroup" aria-label="Tipo" className="inline-flex items-center overflow-hidden rounded-3xl border border-azul-noche bg-superficie">
      <span aria-hidden="true" className="pr-1 pl-3 text-[12px] text-azul-gris">Tipo</span>
      {OPCIONES.map((o) => (
        <button key={o.valor} type="button" role="radio" aria-checked={valor === o.valor} onClick={() => onChange(o.valor)}
          className={cn('cursor-pointer px-3 py-[5px] text-[12px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50',
            valor === o.valor ? 'bg-azul-noche text-superficie' : 'text-azul-noche hover:bg-badge-neutro-bg')}>
          {o.etiqueta}
        </button>
      ))}
    </div>
  )
}
