import type { MovilStock } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { contarFiltros, FILTROS_VACIOS, muestraColor, opciones, type Dimension, type Filtros } from './modelo'

type Props = { moviles: MovilStock[]; filtros: Filtros; onCambiar: (f: Filtros) => void }

/** Filtros de la derecha: chips de color y grado con su número y desplegables de batería, ubicación y estado. Cada número
 *  dice cuántos móviles quedarían con los demás filtros puestos. Los que darían cero, apagados. */
export function FiltrosMoviles({ moviles, filtros, onCambiar }: Props) {
  const alternar = (dim: Dimension, v: string) => {
    const s = new Set(filtros[dim])
    if (s.has(v)) s.delete(v)
    else s.add(v)
    onCambiar({ ...filtros, [dim]: s })
  }
  const activos = contarFiltros(filtros)
  const desplegable = (dim: Dimension, titulo: string, todas: string) => (
    <MultiSelect opciones={opciones(moviles, dim, filtros)} clave={(o) => o.valor} etiqueta={(o) => `${o.valor} (${o.cuenta})`}
      seleccion={new Set(filtros[dim])} onChange={(s) => onCambiar({ ...filtros, [dim]: s })}
      textoVacio={`${titulo}: ${todas}`} textoPlural={(n) => `${titulo}: ${n}`} etiquetaAccesible={titulo} className="min-w-[150px]" />
  )
  return (
    <div className="mb-2.5">
      {(['color', 'grado'] as const).map((dim) => (
        <div key={dim} role="group" aria-label={dim === 'color' ? 'Color' : 'Grado'} className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="w-[52px] text-[10.5px] font-extrabold tracking-wider text-azul-gris uppercase">{dim === 'color' ? 'Color' : 'Grado'}</span>
          {opciones(moviles, dim, filtros).map((o) => {
            const marcado = filtros[dim].has(o.valor)
            const apagado = o.cuenta === 0 && !marcado
            return (
              <button key={o.valor} type="button" aria-pressed={marcado} disabled={apagado} onClick={() => alternar(dim, o.valor)}
                className={cn('inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-bold',
                  marcado ? 'border-azul-noche bg-azul-noche text-superficie' : 'border-pill-borde bg-pill-bg text-azul-gris',
                  apagado && 'cursor-default opacity-35')}>
                {dim === 'color' && <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-pill-borde" style={{ background: muestraColor(o.valor) }} />}
                {o.valor}<span className="font-normal opacity-80">{o.cuenta}</span>
              </button>
            )
          })}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {desplegable('bateria', 'Batería', 'todas')}
        {desplegable('ubicacion', 'Ubicación', 'todas')}
        {desplegable('estado', 'Estado', 'todos')}
        {activos > 0 && (
          <button type="button" onClick={() => onCambiar(FILTROS_VACIOS)} className="ml-auto cursor-pointer text-[12px] font-bold text-texto-accion hover:underline">
            Quitar filtros ({activos})
          </button>
        )}
      </div>
    </div>
  )
}
