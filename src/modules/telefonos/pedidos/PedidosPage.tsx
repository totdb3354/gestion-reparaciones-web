import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { hoyMadrid } from '@/shared/lib/fechas'
import { useStore } from '@/shared/lib/store'
import { usePedidos } from '../api'
import { DetalleUnidad } from './DetalleUnidad'
import { estadoPedidos } from './estado'
import { FiltrosPedidos } from './FiltrosPedidos'
import { ListaPedidos } from './ListaPedidos'
import { PildoraFuentes } from './PildoraFuentes'
import { filtrar, recuentos, type Filtros } from './pedidos'

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** «Pedidos» de clientes (0.9.26, spec pieza 2 §9.2): solo lee; disposición A del prototipo, sin la sugerencia (0.9.27). Se
 *  refresca cada minuto (usePedidos); la unidad elegida se conserva por su id. */
export function PedidosPage() {
  const [{ viejos, filtros, elegida, expandidos }, poner] = useStore(estadoPedidos)
  const setViejos = (v: boolean) => poner((e) => ({ ...e, viejos: v }))
  const setFiltros = (f: Filtros) => poner((e) => ({ ...e, filtros: f }))
  const setElegida = (id: number) => poner((e) => ({ ...e, elegida: id }))
  const { data, isError } = usePedidos(viejos)
  const pedidos = useMemo(() => data ?? [], [data])
  // Como StockTelefonosPage: un error con datos viejos en caché no vacía la pantalla; sin datos, no se hace pasar por «no hay».
  const sinCargar = isError && !data
  const navigate = useNavigate()
  const hoy = hoyMadrid()

  const visibles = useMemo(() => filtrar(pedidos, filtros), [pedidos, filtros])
  const { porCanal, porGrupo } = useMemo(() => recuentos(pedidos, filtros.canales), [pedidos, filtros.canales])
  const totalUnidades = pedidos.reduce((n, p) => n + p.unidades.length, 0)
  const totalCanal = pedidos.filter((p) => filtros.canales.size === 0 || filtros.canales.has(p.canal)).reduce((n, p) => n + p.unidades.length, 0)

  const todasVisibles = visibles.flatMap((p) => p.unidades.map((u) => ({ p, u })))
  const actual = todasVisibles.find((x) => x.u.idUnidad === elegida)
    ?? todasVisibles.find((x) => x.u.estado === 'SIN_MOVIL') ?? todasVisibles[0] ?? null

  const expandir = (id: number) => poner((e) => {
    const n = new Set(e.expandidos)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return { ...e, expandidos: n }
  })
  const sinFiltros = filtros.canales.size === 0 && filtros.grupos.size === 0 && !filtros.texto.trim()
  const vacio = sinCargar ? 'No se pudo cargar la lista de pedidos.'
    : sinFiltros ? 'No hay pedidos pendientes.' : 'Ningún pedido con estos filtros.'

  return (
    <div className="flex h-[calc(100vh-var(--spacing-navbar))] flex-col gap-2 p-10 max-[1500px]:p-5">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Pedidos</h1>
        {!sinCargar && (
          <span className="rounded-full bg-fila-sep px-2.5 py-0.5 text-[12px] font-semibold">
            {plural(totalUnidades, 'unidad', 'unidades')} en {plural(pedidos.length, 'pedido', 'pedidos')} · los más antiguos arriba
          </span>
        )}
        <PildoraFuentes />
      </div>
      <FiltrosPedidos filtros={filtros} porCanal={porCanal} porGrupo={porGrupo} total={totalUnidades} totalCanal={totalCanal}
        viejos={viejos} onFiltros={setFiltros} onViejos={setViejos} />
      <div className="flex min-h-0 flex-1 gap-3">
        <ListaPedidos pedidos={visibles} todos={pedidos} hoy={hoy} elegida={actual?.u.idUnidad ?? null} expandidos={expandidos}
          sinPlegar={filtros.grupos.has('cuadra')} vacio={vacio}
          onElegir={setElegida} onExpandir={expandir} />
        <DetalleUnidad pedido={actual?.p ?? null} unidad={actual?.u ?? null} todos={pedidos} hoy={hoy}
          onRastro={(imei) => navigate(`/reparaciones/imeis/${encodeURIComponent(imei)}`, { state: { desde: '/telefonos/pedidos' } })} />
      </div>
    </div>
  )
}
