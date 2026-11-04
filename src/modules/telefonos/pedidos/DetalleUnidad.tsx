import type { PedidoVista, UnidadVista } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { diaNsys, nombreModeloNsys } from '@/shared/lib/telefonoNsys'
import { CLASE_GRUPO } from './claseGrupo'
import { diferencias, dondeTeclear, grupoDe, hace, queHacer, textoCanal, textoEstado, textoSinPedidoConcreto } from './pedidos'

type Props = { pedido: PedidoVista | null; unidad: UnidadVista | null; todos: PedidoVista[]; hoy: string; onRastro: (imei: string) => void }

const FUENTE: Record<string, string> = { PEDIDOS_2026: 'PEDIDOS 2026', SIMULADOR: 'el Simulador' }

/** La unidad elegida (derecha de la disposición A): lo que pide, su móvil y si cuadra (spec pieza 2 §9.2). */
export function DetalleUnidad({ pedido, unidad, todos, hoy, onRastro }: Props) {
  return (
    <section aria-label="Unidad elegida" className="min-w-0 flex-1 overflow-y-auto rounded-[10px] bg-superficie px-3.5 py-3">
      {!pedido || !unidad ? <p className="text-texto-sub">Elige una unidad.</p> : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="rounded-md bg-fila-sep px-2 py-px text-[11.5px] font-bold">{textoCanal(pedido.canal)}</span>
            <b>Pedido {pedido.numero}</b>
            <span>{pedido.cliente ?? '—'}{pedido.pais && pedido.canal !== 'SIMULADOR' ? ` · ${pedido.pais}` : ''}</span>
            <span className="text-texto-sub">{diaNsys(pedido.fecha).slice(0, 5)} · {hace(pedido.fecha, hoy)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            Pide <span className="rounded bg-fila-sep px-1.5 font-mono font-bold">{unidad.sku}</span>
            {unidad.pide.modelo && <span className="text-texto-sub">iPhone {unidad.pide.modelo} · {unidad.pide.capacidad} · {unidad.pide.color} · {unidad.pide.grado}</span>}
          </div>
          <div className="mt-2 rounded-[10px] border border-fila-sep p-3">
            <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-texto-sub">Móvil</h3>
            {unidad.imei ? (
              <>
                <div className="font-mono text-[16px] font-bold">{unidad.imei}</div>
                <div className="text-texto-sub">
                  Tecleado en {FUENTE[unidad.imeiFuente ?? ''] ?? '—'}{unidad.imeiTecleadoEn ? ` el ${diaNsys(unidad.imeiTecleadoEn)}` : ''}
                  {unidad.sinPedidoConcreto && <> · <span className="rounded bg-fila-sep px-1.5 text-[11px] font-bold">sin pedido concreto</span></>}
                  {unidad.otroOrderId && <> · también en el pedido {unidad.otroOrderId}</>}
                </div>
                {unidad.movil.enNsys && (
                  <div className="mt-1.5 font-semibold">
                    {nombreModeloNsys(unidad.movil.modelo, unidad.movil.modeloMaestro)} · {unidad.movil.capacidad} · {unidad.movil.color} · {unidad.movil.grado}
                    {unidad.movil.ubicacion && <span className="font-normal text-texto-sub"> · {unidad.movil.ubicacion}</span>}
                  </div>
                )}
              </>
            ) : <div className="text-texto-sub">Todavía no se ha tecleado ningún IMEI para esta unidad.</div>}
            <div className={cn('mt-2 rounded-md px-2.5 py-1.5 font-semibold', CLASE_GRUPO[grupoDe(unidad.estado)])}>{textoEstado(unidad)}</div>
            {unidad.repetido && <div className="mt-1.5 font-semibold text-rojo-accion">Este IMEI está tecleado en dos pedidos.</div>}
            {unidad.pide.modelo && unidad.movil.enNsys && (unidad.estado === 'NO_CUADRA' || unidad.estado === 'NECESITA_TALLER') && (
              <table aria-label="Diferencias" className="mt-2 w-full text-[12px]">
                <thead><tr className="text-texto-sub"><th /><th className="text-left">Pide</th><th className="text-left">Es</th><th className="text-left">¿Lo cambia el taller?</th></tr></thead>
                <tbody>
                  {diferencias(unidad.pide, unidad.movil).map((d) => (
                    <tr key={d.dato} data-distinto={d.distinto} className={cn(d.distinto && 'font-bold text-fila-urgente-brd')}>
                      <td>{d.dato}</td><td>{d.pide}</td><td>{d.es}{d.distinto ? ' ✘' : ''}</td><td>{d.taller}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {queHacer(unidad, pedido.canal) && <p className="mt-2 text-[12px] font-semibold">{queHacer(unidad, pedido.canal)}</p>}
            {unidad.imei && (
              <button type="button" onClick={() => onRastro(unidad.imei as string)}
                className="mt-2.5 h-8 rounded-lg border border-borde-input bg-superficie px-3 font-semibold hover:bg-seleccion-suave">Ver rastro</button>
            )}
          </div>
          {unidad.sinPedidoConcreto && (
            <div className="mt-2 rounded-[10px] border border-fila-sep p-3">
              <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-texto-sub">Por qué «sin pedido concreto»</h3>
              <p>{textoSinPedidoConcreto(unidad, todos)}</p>
            </div>
          )}
          {!unidad.imei && <p className="mt-2 text-[11.5px] text-texto-sub">La sugerencia de un móvil llega en la 0.9.27. Hasta entonces, búscalo como hoy y tecléalo en {dondeTeclear(pedido.canal)}.</p>}
        </>
      )}
    </section>
  )
}
