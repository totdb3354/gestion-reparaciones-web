import { cn } from '@/shared/lib/utils'
import { CANALES, GRUPOS, type Filtros, type GrupoEstado } from './pedidos'

type Props = {
  filtros: Filtros
  porCanal: Record<string, number>
  porGrupo: Record<GrupoEstado, number>
  total: number
  totalCanal: number
  viejos: boolean
  onFiltros: (f: Filtros) => void
  onViejos: (v: boolean) => void
}

const chip = 'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold'
const chipOn = 'border-azul-medio bg-azul-medio text-white'
const chipOff = 'border-borde-input bg-superficie text-azul-gris'

function alternar<T>(s: Set<T>, v: T): Set<T> {
  const n = new Set(s)
  if (n.has(v)) n.delete(v)
  else n.add(v)
  return n
}

/** Buscador, chips de canal y de estado con su recuento, e interruptor de los del Simulador viejos (spec pieza 2 §9.2). */
export function FiltrosPedidos({ filtros, porCanal, porGrupo, total, totalCanal, viejos, onFiltros, onViejos }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input type="search" aria-label="Buscar pedidos" placeholder="Nº de pedido, cliente, SKU o IMEI" value={filtros.texto}
          onChange={(e) => onFiltros({ ...filtros, texto: e.target.value })}
          className="h-8 w-72 rounded-lg border border-borde-input bg-superficie px-3 text-[13px]" />
        <div role="group" aria-label="Canal" className="flex flex-wrap items-center gap-1.5">
          <button type="button" aria-pressed={filtros.canales.size === 0} className={cn(chip, filtros.canales.size === 0 ? chipOn : chipOff)}
            onClick={() => onFiltros({ ...filtros, canales: new Set() })}>Todos <span>{total}</span></button>
          {CANALES.filter((c) => porCanal[c.clave]).map((c) => (
            <button key={c.clave} type="button" aria-pressed={filtros.canales.has(c.clave)}
              className={cn(chip, filtros.canales.has(c.clave) ? chipOn : chipOff)}
              onClick={() => onFiltros({ ...filtros, canales: alternar(filtros.canales, c.clave) })}>
              {c.texto} <span>{porCanal[c.clave]}</span>
            </button>
          ))}
        </div>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-[12px] font-semibold">
          <button type="button" role="switch" aria-checked={viejos} aria-label="Ver también los del Simulador de más de 14 días"
            onClick={() => onViejos(!viejos)}
            className={cn('relative h-[18px] w-[34px] rounded-full', viejos ? 'bg-azul-medio' : 'bg-gris-borde')}>
            <span className={cn('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white', viejos ? 'left-[18px]' : 'left-[2px]')} />
          </button>
          Simulador de más de 14 días
        </label>
      </div>
      <div role="group" aria-label="Estado" className="flex flex-wrap items-center gap-1.5">
        <button type="button" aria-pressed={filtros.grupos.size === 0} className={cn(chip, filtros.grupos.size === 0 ? chipOn : chipOff)}
          onClick={() => onFiltros({ ...filtros, grupos: new Set() })}>Todos <span>{totalCanal}</span></button>
        {GRUPOS.map((g) => (
          <button key={g.clave} type="button" aria-pressed={filtros.grupos.has(g.clave)}
            className={cn(chip, filtros.grupos.has(g.clave) ? chipOn : chipOff)}
            onClick={() => onFiltros({ ...filtros, grupos: alternar(filtros.grupos, g.clave) })}>
            {g.texto} <span>{porGrupo[g.clave]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
