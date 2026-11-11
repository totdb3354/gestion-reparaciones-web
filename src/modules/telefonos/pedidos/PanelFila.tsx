import type { ReactNode } from 'react'
import type { CambioImei, FilaVista } from '@/shared/api/client'
import { diaNsys } from '@/shared/lib/telefonoNsys'
import { useCambiosImei } from '../api'
import { EtiquetaEstado } from './TablaFilas'
import { estadoDe, nombreTransportista, textoMotivo, textoTienda, tiendaDe } from './filas'

const dia = (iso: string | null) => (iso ? diaNsys(iso) : '')
/** «2026-11-09T10:30:00» → «09/11/2026 10:30» (hora de Madrid, cortada del texto como las demás fechas). */
const diaHora = (iso: string) => `${diaNsys(iso)} ${iso.slice(11, 16)}`

function Dato({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (<><dt className="text-azul-gris">{nombre}</dt><dd className="m-0 font-semibold break-words">{children}</dd></>)
}

const Titulo = ({ children }: { children: ReactNode }) => (
  <h3 className="mt-3 mb-1.5 border-t border-form-fila-brd pt-2.5 text-[11px] font-bold tracking-wide text-azul-gris uppercase">{children}</h3>
)

/** Lo que hizo un cambio: «puso …», «cambió A por B» o «quitó …». */
function textoCambio(c: CambioImei): ReactNode {
  const imei = (v: string) => <code className="font-mono text-[12px]">{v}</code>
  if (c.imeiAnterior && c.imeiNuevo) return <>cambió {imei(c.imeiAnterior)} por {imei(c.imeiNuevo)}</>
  if (c.imeiNuevo) return <>puso {imei(c.imeiNuevo)}</>
  if (c.imeiAnterior) return <>quitó {imei(c.imeiAnterior)}</>
  return <>sin cambio de IMEI</>
}

function Cambios({ fila }: { fila: FilaVista }) {
  const historico = estadoDe(fila) === 'HISTORICO'
  // Una fila del histórico no tiene registro: no se pide nada.
  const cambios = useCambiosImei(historico ? null : fila.idFila)
  if (historico) return <p className="text-[12px] text-azul-gris">Viene de la hoja: no hay registro de quién lo puso.</p>
  if (cambios.isPending) return <p className="text-[12px] text-azul-gris">Cargando…</p>
  if (cambios.isError) return <p className="text-[12px] text-azul-gris">No se pudo cargar quién ha tocado el IMEI.</p>
  if (cambios.data.length === 0) return <p className="text-[12px] text-azul-gris">Nadie ha puesto IMEI todavía.</p>
  return (
    <ul className="m-0 list-none p-0">
      {cambios.data.map((c, i) => (
        <li key={i} className="border-b border-dashed border-form-fila-brd py-1.5 text-[12px]">
          <span className="font-bold">{c.usuario ?? 'Carga desde la hoja'}</span> {textoCambio(c)}
          <div className="text-[11px] text-azul-gris">{diaHora(c.fecha)}</div>
        </li>
      ))}
    </ul>
  )
}

/** El panel de la derecha (spec v2 §3.5): el pedido, el móvil y quién ha tocado el IMEI. Solo enseña; el IMEI se pone en la celda. */
export function PanelFila({ fila: f, onCerrar }: { fila: FilaVista; onCerrar: () => void }) {
  const estado = estadoDe(f)
  const motivo = textoMotivo(f)
  const envio = estado === 'ENVIADA'
  return (
    <section aria-label="Detalle del pedido" className="w-[340px] max-w-[40%] shrink-0 overflow-auto rounded-md border border-borde-input bg-superficie px-3.5 py-3">
      <div className="mb-2.5 flex items-center gap-2">
        <h2 className="m-0 text-[15px] font-bold text-azul-medio">Detalle del pedido</h2>
        <button type="button" onClick={onCerrar} className="ml-auto h-7 cursor-pointer rounded-md border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold">Cerrar</button>
      </div>
      <h3 className="mb-1.5 text-[11px] font-bold tracking-wide text-azul-gris uppercase">El pedido</h3>
      <dl className="m-0 grid grid-cols-[104px_1fr] gap-x-2 gap-y-1.5 text-[12.5px]">
        <Dato nombre="Pedido">{f.pedido}</Dato>
        <Dato nombre="Estado"><EtiquetaEstado fila={f} estado={estado} conDetalle={false} /></Dato>
        <Dato nombre="Tienda">{f.plataforma}</Dato>
        <Dato nombre="Plataforma">{textoTienda(tiendaDe(f))}</Dato>
        <Dato nombre="SKU"><span className="font-mono text-[12px]">{f.sku}</span></Dato>
        <Dato nombre="Fecha">{dia(f.fecha)}</Dato>
        <Dato nombre="Fecha compra">{dia(f.fechaCompra)}</Dato>
        {envio && f.transportista && <Dato nombre="Transportista">{nombreTransportista(f.transportista)}</Dato>}
        {envio && f.seguimiento && <Dato nombre="Seguimiento">{f.seguimiento}</Dato>}
      </dl>
      <Titulo>El móvil</Titulo>
      {f.imei ? (
        <dl className="m-0 grid grid-cols-[104px_1fr] gap-x-2 gap-y-1.5 text-[12.5px]">
          <Dato nombre="IMEI"><span className="font-mono text-[12px]">{f.imei}</span></Dato>
          {f.skuMovil && <Dato nombre="Es"><span className="font-mono text-[12px]">{f.skuMovil}</span></Dato>}
          {f.caja && <Dato nombre="Caja">{f.caja}</Dato>}
          {motivo && <Dato nombre="Aviso">{motivo}</Dato>}
        </dl>
      ) : (
        <p className="text-[12px] text-azul-gris">{f.editable ? 'Sin IMEI todavía.' : 'Sin IMEI.'}</p>
      )}
      <Titulo>Quién ha tocado el IMEI</Titulo>
      <Cambios fila={f} />
    </section>
  )
}
