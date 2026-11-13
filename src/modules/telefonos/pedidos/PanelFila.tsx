import { useState, type ReactNode } from 'react'
import type { CambioImei, FilaVista } from '@/shared/api/client'
import { diaNsys } from '@/shared/lib/telefonoNsys'
import { crearClavesIdempotencia } from '@/shared/lib/clavesIdempotencia'
import { useCambiosImei, useFaltaEnviar } from '../api'
import { PrevisualizarEtiqueta } from './PrevisualizarEtiqueta'
import { EtiquetaEstado } from './TablaFilas'
import { construirHistorial, type EntradaHistorial } from './historial'
import { esCanalWeb, estadoDe, estadoPantalla, nombreTransportista, textoMotivo, textoTienda, tiendaDe } from './filas'

const dia = (iso: string | null) => (iso ? diaNsys(iso) : '')
/** «2026-11-09T10:30:00» → «09/11/2026 10:30» (hora de Madrid, cortada del texto como las demás fechas). */
const diaHora = (iso: string) => `${diaNsys(iso)} ${iso.slice(11, 16)}`

/** «2026-11-09T10:30:00» → «09/11 10:30». */
const diaMesHora = (iso: string) => `${diaNsys(iso).slice(0, 5)} ${iso.slice(11, 16)}`

function Dato({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (<><dt className="text-azul-gris">{nombre}</dt><dd className="m-0 min-w-0 font-semibold [overflow-wrap:anywhere]">{children}</dd></>)
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

/** Un hito de la propia fila: lo que pasó, y cuándo (sin hora si solo se sabe el día). */
function textoHito(e: Exclude<EntradaHistorial, { tipo: 'imei' | 'marca' }>): { quien: string; texto: ReactNode } {
  if (e.tipo === 'sincronizado') return { quien: 'Sincronizado con la web', texto: null }
  if (e.tipo === 'entro') return { quien: 'Entró desde ShippyPro', texto: null }
  if (e.tipo === 'etiqueta') return { quien: 'Etiqueta generada', texto: e.transportista ? <> · {nombreTransportista(e.transportista)}</> : null }
  return { quien: 'Enviado (etiqueta impresa)', texto: null }
}

/** El historial de la fila (más reciente arriba): los cambios del IMEI y los hitos de la propia fila. Con su propio scroll. */
function Historial({ fila }: { fila: FilaVista }) {
  const historico = estadoDe(fila) === 'HISTORICO'
  // Una fila del histórico no tiene registro: no se pide nada.
  const cambios = useCambiosImei(historico ? null : fila.idFila)
  if (historico) return <p className="text-[12px] text-azul-gris">Viene de la hoja: no hay registro de quién lo puso.</p>
  if (cambios.isPending) return <p className="text-[12px] text-azul-gris">Cargando…</p>
  if (cambios.isError) return <p className="text-[12px] text-azul-gris">No se pudo cargar quién ha tocado el IMEI.</p>
  const entradas = construirHistorial(fila, cambios.data)
  return (
    <>
      <ul aria-label="Historial de la fila" tabIndex={0} className="m-0 max-h-[40vh] list-none overflow-x-hidden overflow-y-auto p-0">
        {entradas.map((e) => (
          <li key={e.clave} className="border-b border-dashed border-form-fila-brd py-1.5 text-[12px]">
            {e.tipo === 'imei'
              ? <><span className="font-bold">{e.cambio.usuario ?? 'Carga desde la hoja'}</span> {textoCambio(e.cambio)}</>
              : e.tipo === 'marca'
              ? <><span className="font-bold">{e.texto}</span>{e.quien && <> · {e.quien}</>}</>
              : <><span className="font-bold">{textoHito(e).quien}</span>{textoHito(e).texto}</>}
            <div className="text-[11px] text-azul-gris">{e.conHora ? diaHora(e.cuando) : diaNsys(e.cuando)}</div>
          </li>
        ))}
      </ul>
      {cambios.data.length === 0 && <p className="mt-1 text-[12px] text-azul-gris">Nadie ha puesto IMEI todavía.</p>}
    </>
  )
}

/** El envío parcial (una fila de web con la etiqueta generada de un pedido que sale por partes): «Falta por enviar» pone la marca y «Ya ha
 *  salido» la quita. Un 409 o un 404 salen por el diálogo normal de errores con el mensaje del servidor. */
function MarcaFalta({ fila: f }: { fila: FilaVista }) {
  const marcar = useFaltaEnviar()
  const [claves] = useState(() => crearClavesIdempotencia())
  const marcada = estadoPantalla(f) === 'FALTA_ENVIAR'
  const puede = f.editable && (marcada || (esCanalWeb(f) && estadoDe(f) === 'ENVIADA'))
  if (!marcada && !puede) return null
  const pulsar = (falta: boolean) => {
    const operacion = `falta:${f.idFila}`
    marcar.mutate({ idFila: f.idFila, falta, clave: claves.para(operacion, { falta }) }, { onSuccess: () => claves.hecha(operacion) })
  }
  return (
    <div className="mt-2 text-[12.5px]">
      {marcada && f.faltaEnviarEn && <p className="m-0 mb-1.5 font-bold text-pill-aviso-text">Envío parcial: falta por enviar desde {diaMesHora(f.faltaEnviarEn)}</p>}
      {puede && (
        <button type="button" disabled={marcar.isPending} onClick={() => pulsar(!marcada)}
          className="h-7 cursor-pointer rounded-md border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold disabled:cursor-default disabled:opacity-60">{marcada ? 'Ya ha salido' : 'Falta por enviar'}</button>
      )}
    </div>
  )
}

/** El panel de la derecha (spec v2 §3.5): el pedido, el móvil y el historial de la fila. Solo enseña; el IMEI se pone en la celda. */
export function PanelFila({ fila: f, onCerrar }: { fila: FilaVista; onCerrar: () => void }) {
  const estado = estadoPantalla(f)
  const motivo = textoMotivo(f)
  const envio = estadoDe(f) === 'ENVIADA'
  return (
    <section aria-label="Detalle del pedido" className="w-[min(380px,40vw)] min-w-0 shrink-0 overflow-x-hidden overflow-y-auto rounded-md border border-borde-input bg-superficie px-3.5 py-3">
      <div className="mb-2.5 flex items-center gap-2">
        <h2 className="m-0 text-[15px] font-bold text-azul-medio">Detalle del pedido</h2>
        <button type="button" onClick={onCerrar} className="ml-auto h-7 cursor-pointer rounded-md border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold">Cerrar</button>
      </div>
      <h3 className="mb-1.5 text-[11px] font-bold tracking-wide text-azul-gris uppercase">El pedido</h3>
      <dl className="m-0 grid grid-cols-[104px_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-[12.5px]">
        <Dato nombre="Pedido">{f.pedido}</Dato>
        <Dato nombre="Estado"><EtiquetaEstado fila={f} estado={estado} conDetalle={false} /></Dato>
        <Dato nombre="Tienda">{textoTienda(tiendaDe(f))}</Dato>
        <Dato nombre="Plataforma">{f.plataforma}</Dato>
        <Dato nombre="SKU"><span className="font-mono text-[12px]">{f.sku}</span></Dato>
        <Dato nombre="Fecha">{dia(f.fecha)}</Dato>
        <Dato nombre="Fecha compra">{dia(f.fechaCompra)}</Dato>
        {envio && <Dato nombre="Etiqueta generada">{f.envioFecha ? diaHora(f.envioFecha) : 'sí'}</Dato>}
        {envio && <Dato nombre={f.impresaEn ? 'Enviado (etiqueta impresa)' : 'Enviado'}>{f.impresaEn ? diaHora(f.impresaEn) : 'Etiqueta sin imprimir todavía'}</Dato>}
        {envio && f.transportista && <Dato nombre="Transportista">{nombreTransportista(f.transportista)}</Dato>}
        {envio && f.seguimiento && <Dato nombre="Seguimiento">{f.seguimiento}</Dato>}
      </dl>
      <MarcaFalta key={`falta${f.idFila}`} fila={f} />
      {f.tieneEtiqueta && <PrevisualizarEtiqueta key={f.idFila} fila={f} />}
      <Titulo>El móvil</Titulo>
      {f.imei ? (
        <dl className="m-0 grid grid-cols-[104px_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-[12.5px]">
          <Dato nombre="IMEI"><span className="font-mono text-[12px]">{f.imei}</span></Dato>
          {f.skuMovil && <Dato nombre="Es"><span className="font-mono text-[12px]">{f.skuMovil}</span></Dato>}
          {f.caja && <Dato nombre="Caja">{f.caja}</Dato>}
          {motivo && <Dato nombre="Aviso">{motivo}</Dato>}
        </dl>
      ) : (
        <p className="text-[12px] text-azul-gris">{f.editable ? 'Sin IMEI todavía.' : 'Sin IMEI.'}</p>
      )}
      <Titulo>Historial</Titulo>
      <Historial fila={f} />
    </section>
  )
}
