import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { hoyMadrid } from '@/shared/lib/fechas'
import { usePedidos } from '../api'
import { DetalleUnidad } from './DetalleUnidad'
import { FiltrosPedidos } from './FiltrosPedidos'
import { ListaPedidos } from './ListaPedidos'
import { PildoraFuentes } from './PildoraFuentes'
import { filtrar, recuentos, type Filtros } from './pedidos'

/** «Pedidos» de clientes (0.9.26, spec pieza 2 §9.2): solo lee; disposición A del prototipo, sin la sugerencia (0.9.27). Se
 *  refresca cada minuto (usePedidos); la unidad elegida se conserva por su id. */
export function PedidosPage() {
  const [viejos, setViejos] = useState(false)
  const [filtros, setFiltros] = useState<Filtros>({ canales: new Set(), grupos: new Set(), texto: '' })
  const [elegida, setElegida] = useState<number | null>(null)
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())
  const { data: pedidos = [] } = usePedidos(viejos)
  const navigate = useNavigate()
  const hoy = hoyMadrid()

  const visibles = useMemo(() => filtrar(pedidos, filtros), [pedidos, filtros])
  const { porCanal, porGrupo } = useMemo(() => recuentos(pedidos, filtros.canales), [pedidos, filtros.canales])
  const totalUnidades = pedidos.reduce((n, p) => n + p.unidades.length, 0)
  const totalCanal = pedidos.filter((p) => filtros.canales.size === 0 || filtros.canales.has(p.canal)).reduce((n, p) => n + p.unidades.length, 0)

  const todasVisibles = visibles.flatMap((p) => p.unidades.map((u) => ({ p, u })))
  const actual = todasVisibles.find((x) => x.u.idUnidad === elegida)
    ?? todasVisibles.find((x) => x.u.estado === 'SIN_MOVIL') ?? todasVisibles[0] ?? null

  const expandir = (id: number) => setExpandidos((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Pedidos</h1>
        <span className="rounded-full bg-fila-sep px-2.5 py-0.5 text-[12px] font-semibold">
          {totalUnidades} unidades en {pedidos.length} pedidos · los más antiguos arriba
        </span>
        <PildoraFuentes />
      </div>
      <FiltrosPedidos filtros={filtros} porCanal={porCanal} porGrupo={porGrupo} total={totalUnidades} totalCanal={totalCanal}
        viejos={viejos} onFiltros={setFiltros} onViejos={setViejos} />
      <div className="flex min-h-0 flex-1 gap-3">
        <ListaPedidos pedidos={visibles} hoy={hoy} elegida={actual?.u.idUnidad ?? null} expandidos={expandidos}
          onElegir={setElegida} onExpandir={expandir} />
        <DetalleUnidad pedido={actual?.p ?? null} unidad={actual?.u ?? null} todos={pedidos} hoy={hoy}
          onRastro={(imei) => navigate(`/reparaciones/imeis/${encodeURIComponent(imei)}`, { state: { desde: '/telefonos/pedidos' } })} />
      </div>
    </div>
  )
}
