import { useState, type ReactNode } from 'react'
import type { CambioImei, FilaVista } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { clasesUbicacion, diaNsys } from '@/shared/lib/telefonoNsys'
import { crearClavesIdempotencia } from '@/shared/lib/clavesIdempotencia'
import { useCambiosImei, useFaltaEnviar } from '../api'
import { PrevisualizarEtiqueta } from './PrevisualizarEtiqueta'
import { EtiquetaEstado } from './TablaFilas'
import { autorImei, construirHistorial, type EntradaHistorial, type TonoReserva } from './historial'
import { EditorMarca } from './EditorMarca'
import { BotonCancelarMovil, BotonQuitarCancelacion } from './CancelarMovil'
import { BotonValidarSku } from './BotonValidarSku'
import { colorMarca, esCanalWeb, estadoDe, estadoPantalla, nombreTransportista, sinAsociar, esAmazon, textoMarca, lineasAviso, textoMotivoValidado, textoTienda, tiendaDe } from './filas'

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

/** Los colores de las etiquetas del historial de la reserva (como el prototipo aprobado): la etiqueta y la raya de la izquierda. */
export const TONO_RESERVA: Record<TonoReserva, { etiqueta: string; raya: string }> = {
  res: { etiqueta: 'bg-[#E3F2FD] text-[#1565C0]', raya: 'border-l-[#90CAF9]' },
  ok: { etiqueta: 'bg-[#E8F5E9] text-[#2E7D32]', raya: 'border-l-[#A5D6A7]' },
  gris: { etiqueta: 'bg-[#E8EAF0] text-azul-gris', raya: 'border-l-form-fila-brd' },
  dev: { etiqueta: 'bg-[#F3E5F5] text-[#7B1FA2]', raya: 'border-l-[#CE93D8]' },
  mal: { etiqueta: 'bg-[#FFE0B2] text-[#B45309]', raya: 'border-l-[#FFB74D]' },
  aviso: { etiqueta: 'bg-form-agotado-bg text-form-agotado-text', raya: 'border-l-[#FFE082]' },
}

/** Un hito de la propia fila: lo que pasó, y cuándo (sin hora si solo se sabe el día). */
function textoHito(e: Exclude<EntradaHistorial, { tipo: 'imei' | 'marca' | 'reserva' }>): { quien: string; texto: ReactNode } {
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
          <li key={e.clave} data-reserva={e.tipo === 'reserva' ? e.tono : undefined}
            className={cn('border-b border-dashed border-form-fila-brd py-1.5 text-[12px]', e.tipo === 'reserva' && cn('border-l-[3px] pl-2', TONO_RESERVA[e.tono].raya))}>
            {e.tipo === 'reserva'
              ? <><span data-etiqueta className={cn('mr-1 inline-block rounded-[10px] px-2 text-[11px] font-bold', TONO_RESERVA[e.tono].etiqueta)}>{e.etiqueta}</span>{e.texto}{e.caja && <> <span data-caja className={cn('inline-block rounded-md px-2 py-px text-[11px] font-bold', clasesUbicacion(e.caja))}>{e.caja}</span></>}</>
              : e.tipo === 'imei'
              ? <><span className="font-bold">{autorImei(e.cambio)}</span> {textoCambio(e.cambio)}</>
              : e.tipo === 'marca'
              ? <><span className="font-bold">{e.texto}</span>{e.quien && <> · {e.quien}</>}</>
              : <><span className="font-bold">{textoHito(e).quien}</span>{textoHito(e).texto}</>}
            <div className="text-[11px] text-azul-gris">{e.conHora ? diaHora(e.cuando) : diaNsys(e.cuando)}{e.tipo === 'reserva' && <> · {e.quien}</>}</div>
          </li>
        ))}
      </ul>
      {cambios.data.length === 0 && <p className="mt-1 text-[12px] text-azul-gris">Nadie ha puesto IMEI todavía.</p>}
    </>
  )
}

/** El pedido de una fila de Amazon: «sin asociar», o su número con desde dónde y cuándo lo asoció el libro de ventas (o el histórico). */
function DatoPedido({ fila: f }: { fila: FilaVista }) {
  if (sinAsociar(f)) return <span className="font-normal text-azul-gris italic">sin asociar</span>
  const desde = f.asociadaOrigen === 'HISTORICO' ? ' desde el histórico de la hoja' : f.asociadaOrigen === 'LIBRO' ? ' desde el libro de ventas' : ''
  return (
    <>
      {f.pedido}
      {esAmazon(f) && f.asociadaEn && <span className="block text-[11px] font-normal text-azul-gris">{`asociado${desde} el ${diaMesHora(f.asociadaEn)}`}</span>}
    </>
  )
}

/** El envío parcial (una fila de web con la etiqueta generada de un pedido que sale por partes): «Falta por enviar» pone la marca y «Ya ha
 *  salido» la quita. Un 409 o un 404 salen por el diálogo normal de errores con el mensaje del servidor. */
function MarcaFalta({ fila: f }: { fila: FilaVista }) {
  const marcar = useFaltaEnviar()
  const [claves] = useState(() => crearClavesIdempotencia())
  // Una fila cancelada no lleva «Falta por enviar» (cancelar se la come; el servidor da 409).
  if (f.marca === 'CANCELADO') return null
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

/** La marca de la fila (En espera de stock, En revisión o Pendiente de color): cuál es, su nota, quién la puso y cuándo, el editor para
 *  cambiarla o quitarla y «Cancelar móvil». Una fila cancelada enseña la cancelación y solo «Quitar cancelación» (spec 2026-11-23). */
function SeccionMarca({ fila: f }: { fila: FilaVista }) {
  if (!f.editable && !f.marca) return null
  if (f.marca === 'CANCELADO') {
    return (
      <div className="mt-2 text-[12.5px]">
        <p className="m-0 flex flex-wrap items-baseline gap-1.5">
          <span className={`inline-block rounded-lg px-2 py-px text-[11px] font-bold ${colorMarca(f.marca)}`}>{textoMarca(f.marca)}</span>
          {f.marcaNota && <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{f.marcaNota}</span>}
        </p>
        <p className="m-0 mt-0.5 text-[11px] text-azul-gris">
          {f.marcaEn ? `Cancelado${f.marcaPor ? ` por ${f.marcaPor}` : ''} el ${diaHora(f.marcaEn)}. ` : ''}Este móvil no sale en este pedido y su IMEI está libre.
        </p>
        {f.editable && <BotonQuitarCancelacion fila={f} />}
      </div>
    )
  }
  return (
    <div className="mt-2 text-[12.5px]">
      {f.marca ? (
        <>
          <p className="m-0 flex flex-wrap items-baseline gap-1.5">
            <span className={`inline-block rounded-lg px-2 py-px text-[11px] font-bold ${colorMarca(f.marca)}`}>{textoMarca(f.marca)}</span>
            {f.marcaNota && <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{f.marcaNota}</span>}
          </p>
          {f.marcaEn && <p className="m-0 mt-0.5 text-[11px] text-azul-gris">Puesta{f.marcaPor ? ` por ${f.marcaPor}` : ''} el {diaHora(f.marcaEn)}</p>}
        </>
      ) : <p className="m-0 text-[12px] text-azul-gris">Sin marca.</p>}
      {f.editable && <EditorMarca key={`${f.idFila}:${f.marca}:${f.marcaNota}:${f.marcaEn}`} fila={f} />}
      {f.editable && <BotonCancelarMovil key={`cancelar${f.idFila}`} fila={f} />}
    </div>
  )
}

/** El panel de la derecha (spec v2 §3.5): el pedido, el móvil y el historial de la fila. Solo enseña; el IMEI se pone en la celda. */
export function PanelFila({ fila: f, onCerrar }: { fila: FilaVista; onCerrar: () => void }) {
  const estado = estadoPantalla(f)
  const motivo = lineasAviso(f).join(' · ') || null
  const envio = estadoDe(f) === 'ENVIADA'
  return (
    <section aria-label="Detalle del pedido" className="w-[min(380px,40vw)] min-w-0 shrink-0 overflow-x-hidden overflow-y-auto rounded-md border border-borde-input bg-superficie px-3.5 py-3">
      <div className="mb-2.5 flex items-center gap-2">
        <h2 className="m-0 text-[15px] font-bold text-azul-medio">Detalle del pedido</h2>
        <button type="button" onClick={onCerrar} className="ml-auto h-7 cursor-pointer rounded-md border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold">Cerrar</button>
      </div>
      <h3 className="mb-1.5 text-[11px] font-bold tracking-wide text-azul-gris uppercase">El pedido</h3>
      <dl className="m-0 grid grid-cols-[104px_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-[12.5px]">
        <Dato nombre="Pedido"><DatoPedido fila={f} /></Dato>
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
      <Titulo>Marca</Titulo>
      <SeccionMarca fila={f} />
      {f.tieneEtiqueta && <PrevisualizarEtiqueta key={f.idFila} fila={f} />}
      <Titulo>El móvil</Titulo>
      {f.imei ? (
        <dl className="m-0 grid grid-cols-[104px_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-[12.5px]">
          <Dato nombre="IMEI"><span className="font-mono text-[12px]">{f.imei}</span></Dato>
          {f.skuMovil && <Dato nombre="Es"><span className="font-mono text-[12px]">{f.skuMovil}</span></Dato>}
          {f.caja && <Dato nombre="Caja">{f.caja}</Dato>}
          {motivo && <Dato nombre="Aviso">{motivo}</Dato>}
          {f.motivoValidado && (
            <Dato nombre="SKU validado">
              {textoMotivoValidado(f)}
              {f.validadaEn && <span className="block text-[11px] font-normal text-azul-gris">{`${f.validadaPor ? `por ${f.validadaPor} el ` : 'el '}${diaHora(f.validadaEn)}`}</span>}
            </Dato>
          )}
        </dl>
      ) : (
        <p className="text-[12px] text-azul-gris">{f.editable ? 'Sin IMEI todavía.' : 'Sin IMEI.'}</p>
      )}
      {f.imei && <BotonValidarSku key={`${f.idFila}:${f.motivoValidado}`} fila={f} />}
      <Titulo>Historial</Titulo>
      <Historial fila={f} />
    </section>
  )
}
