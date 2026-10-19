import { cn } from '@/shared/lib/utils'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { contarFiltros, esEspecialTecnico, FILTROS_VACIOS, muestraColor, opciones, type Dimension, type Filtros, type Movil } from './modelo'

type Props = { moviles: Movil[]; filtros: Filtros; onCambiar: (f: Filtros) => void }

/** Filtros de la derecha: chips de color y grado con su número y desplegables de batería, ubicación y técnico (0.9.18), con
 *  los avisos de «Quién lo tiene». Cada número dice cuántos móviles quedarían con los demás filtros puestos. Los que darían
 *  cero, apagados. */
export function FiltrosMoviles({ moviles, filtros, onCambiar }: Props) {
  const alternar = (dim: Dimension, v: string) => {
    const s = new Set(filtros[dim])
    if (s.has(v)) s.delete(v)
    else s.add(v)
    onCambiar({ ...filtros, [dim]: s })
  }
  const activos = contarFiltros(filtros)
  const desplegable = (dim: Dimension, titulo: string, todas: string) => {
    const lista = opciones(moviles, dim, filtros)
    return (
      <MultiSelect opciones={lista} clave={(o) => o.valor} etiqueta={(o) => `${o.valor} (${o.cuenta})`}
        seleccion={new Set(filtros[dim])} onChange={(s) => onCambiar({ ...filtros, [dim]: s })}
        textoVacio={`${titulo}: ${todas}`} textoPlural={(n) => `${titulo}: ${n}`} etiquetaAccesible={titulo} className="min-w-[150px]"
        separadorAntes={dim === 'tecnico' ? lista.find((o) => esEspecialTecnico(o.valor))?.valor : undefined} />
    )
  }
  // Avisos de «Quién lo tiene» (spec §4.7): de los móviles que se ven del modelo; con el interruptor apagado, solo el stock.
  const enCaja = moviles.filter((m) => m.quien.enCaja).length
  const descuadres = moviles.filter((m) => m.quien.descuadre).length
  return (
    <div className="mb-2.5">
      {(['color', 'grado'] as const).map((dim) => (
        <div key={dim} role="group" aria-label={dim === 'color' ? 'Color' : 'Grado'} className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="w-[52px] text-[10.5px] font-extrabold tracking-wider text-azul-gris uppercase">{dim === 'color' ? 'Color' : 'Grado'}</span>
          {opciones(moviles, dim, filtros).map((o) => {
            const marcado = filtros[dim].has(o.valor)
            const apagado = o.cuenta === 0 && !marcado
            return (
              <button key={o.valor} type="button" aria-label={`${o.valor} ${o.cuenta}`} aria-pressed={marcado} disabled={apagado} onClick={() => alternar(dim, o.valor)}
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
        {desplegable('tecnico', 'Técnico', 'todos')}
        {enCaja > 0 && <span className="text-[12px] font-bold text-fila-solicitud-brd">{`⚠ ${enCaja} en caja de taller sin asignar`}</span>}
        {descuadres > 0 && <span className="text-[12px] font-bold text-fila-urgente-brd">{`⚠ ${descuadres} con descuadre`}</span>}
        {activos > 0 && (
          <button type="button" onClick={() => onCambiar(FILTROS_VACIOS)} className="ml-auto cursor-pointer text-[12px] font-bold text-texto-accion hover:underline">
            Quitar filtros ({activos})
          </button>
        )}
      </div>
    </div>
  )
}
