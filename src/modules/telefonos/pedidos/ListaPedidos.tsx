import type { PedidoVista } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { diaNsys } from '@/shared/lib/telefonoNsys'
import { CLASE_GRUPO } from './claseGrupo'
import { GRUPOS, grupoDe, hace, plegar, resumenMovil, textoCanal } from './pedidos'

const textoGrupo = (estado: string) => GRUPOS.find((g) => g.clave === grupoDe(estado))?.texto ?? estado

type Props = {
  pedidos: PedidoVista[]
  hoy: string
  elegida: number | null
  expandidos: Set<number>
  onElegir: (idUnidad: number) => void
  onExpandir: (idPedido: number) => void
}

/** La lista de la izquierda (disposición A): un artículo por pedido con sus unidades (spec pieza 2 §9.2). */
export function ListaPedidos({ pedidos, hoy, elegida, expandidos, onElegir, onExpandir }: Props) {
  return (
    <section aria-label="Lista de pedidos" className="w-[52%] shrink-0 overflow-y-auto rounded-[10px] bg-superficie py-1">
      {pedidos.length === 0 && <p className="p-4 text-texto-sub">Ningún pedido con estos filtros.</p>}
      {pedidos.map((p) => {
        const { visibles, plegadas, plegable } = plegar(p.unidades, expandidos.has(p.idPedido))
        return (
          <article key={p.idPedido} aria-label={p.numero} className="border-b border-fila-sep px-2.5 py-2">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="rounded-md bg-fila-sep px-2 py-px text-[11.5px] font-bold">{textoCanal(p.canal)}</span>
              <b className="font-mono">{p.numero}</b>
              <span>{p.cliente ?? '—'}{p.pais && p.canal !== 'SIMULADOR' ? ` · ${p.pais}` : ''}</span>
              <span className="ml-auto text-texto-sub">{diaNsys(p.fecha).slice(0, 5)} · {hace(p.fecha, hoy)}{p.unidades.length > 1 ? ` · ${p.unidades.length} uds.` : ''}</span>
            </div>
            {visibles.map((u) => (
              <button key={u.idUnidad} type="button" aria-label={`${u.sku}: ${textoGrupo(u.estado)}`} aria-current={u.idUnidad === elegida || undefined}
                onClick={() => onElegir(u.idUnidad)}
                className={cn('flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1 text-left hover:bg-seleccion-suave',
                  u.idUnidad === elegida && 'border-fila-edicion-brd bg-seleccion-suave')}>
                <span className="rounded bg-fila-sep px-1.5 font-mono text-[12px] font-bold">{u.sku}</span>
                <span className={cn('rounded-full px-2 text-[11.5px] font-bold', CLASE_GRUPO[grupoDe(u.estado)])}>{textoGrupo(u.estado)}</span>
                {u.repetido && <span className="text-[11px] font-bold text-rojo-accion">IMEI en dos pedidos</span>}
                <span className="ml-auto truncate text-[12px] text-texto-sub">{resumenMovil(u)}</span>
              </button>
            ))}
            {plegadas > 0 && (
              <button type="button" onClick={() => onExpandir(p.idPedido)} className="w-full px-2 py-1 text-left text-[12px] font-semibold text-verde-ok">
                ✔ {plegadas} unidades más cuadran · ver
              </button>
            )}
            {plegadas === 0 && plegable && (
              <button type="button" onClick={() => onExpandir(p.idPedido)} className="w-full px-2 py-1 text-left text-[12px] font-semibold text-verde-ok">
                Plegar las que cuadran
              </button>
            )}
          </article>
        )
      })}
    </section>
  )
}
