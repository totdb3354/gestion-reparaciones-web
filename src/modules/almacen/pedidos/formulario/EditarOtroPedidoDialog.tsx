import { useLayoutEffect, useMemo, useState } from 'react'
import type { CompraOtro } from '@/shared/api/client'
import { formatearNumero } from '@/shared/lib/importes'
import { cn } from '@/shared/lib/utils'
import { ComboNavy } from '@/shared/ui/ComboNavy'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useProveedoresComponentes } from '../../proveedores/api'
import { DialogoAlmacen } from '../../ui/DialogoAlmacen'
import { useEditarOtro, useLineasPedido } from '../api'
import { agruparEnBloques, destinoSugeridoEdicion, textoMoverYaPedida } from '../bloques/reglas'
import { idVisible } from '../reglas'
import { useTasa } from '../tasa'
import { opcionesBloqueEdicion, VALOR_NUEVO } from './destinos'
import { CLASE_CAMPO, CLASE_ETIQUETA, DIVISAS_EDICION, MSG_PEDIDO_MODIFICADO, textoTotalEdicion, validarEdicion } from './edicion'
import { esBloqueInexistente, mensajeErrorGuardado, staleDataDe } from './errores'

type Props = { pedido: CompraOtro | null; onCerrar: () => void }

/** "Editar pedido #O-{id}" de otros (FormularioOtroPedidoEditarController, inventario §13): Concepto editable, sin
 *  "Urgente" (se conserva el del pedido, calco). 0.9.15 (spec «Añadir otro» §5.1): el ID con «O-» y, como el editor de
 *  piezas, al cambiar el proveedor aparece «Bloque» (el otro pasa a un bloque del proveedor nuevo) y, si ya se pidió,
 *  guardar pide la confirmación «Mover línea ya pedida». */
export function EditarOtroPedidoDialog({ pedido, onCerrar }: Props) {
  const { data: proveedores } = useProveedoresComponentes({ activo: false })
  const activos = useMemo(() => (proveedores ?? []).filter((p) => p.activo), [proveedores])
  const opciones = useMemo(() => activos.map((p) => ({ valor: String(p.idProv), etiqueta: p.nombre })), [activos])
  const lineas = useLineasPedido({ activo: false, habilitada: pedido !== null })
  const bloques = useMemo(() => agruparEnBloques(lineas.data ?? []), [lineas.data])
  const [concepto, setConcepto] = useState('')
  const [idProv, setIdProv] = useState<number | null>(null)
  const [cantidad, setCantidad] = useState('')
  const [precio, setPrecio] = useState('')
  const [divisa, setDivisa] = useState('EUR')
  const [error, setError] = useState<string | null>(null)
  const [destino, setDestino] = useState<number | null>(null)
  const [confirmarMover, setConfirmarMover] = useState(false)
  const editar = useEditarOtro()
  const tasa = useTasa(pedido ? divisa : null)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga al abrir con otro pedido (patrón de EditarStockDialog)
    if (pedido) { setConcepto(pedido.concepto); setIdProv(pedido.idProv); setCantidad(String(pedido.cantidad)); setPrecio(formatearNumero(pedido.precioUnidadPedido)); setDivisa(pedido.divisa); setError(null); setDestino(null); setConfirmarMover(false) }
  }, [pedido])
  const proveedor = idProv !== null && activos.some((p) => p.idProv === idProv) ? idProv : null
  const cambiaProveedor = pedido !== null && proveedor !== null && proveedor !== pedido.idProv
  const nuevo = cambiaProveedor ? activos.find((p) => p.idProv === proveedor) : undefined
  const opcionesBloque = cambiaProveedor && proveedor !== null ? opcionesBloqueEdicion(bloques, proveedor) : []

  function elegirProveedor(v: string) {
    const id = Number(v)
    setIdProv(id)
    if (pedido && id !== pedido.idProv) setDestino(destinoSugeridoEdicion(pedido, id, bloques))
    setError(null)
  }

  async function guardar(confirmado = false) {
    if (!pedido) return
    const v = validarEdicion({ concepto, idProv: proveedor, cantidad, precio })
    if (!v.ok) {
      setError(v.error)
      return
    }
    if (cambiaProveedor && pedido.estado !== 'pendiente' && !confirmado) {
      setConfirmarMover(true)
      return
    }
    setError(null)
    try {
      await editar.mutateAsync({
        idCompraOtro: pedido.idCompraOtro,
        cuerpo: {
          idProv: v.valor.idProv, concepto: v.valor.concepto ?? '', cantidad: v.valor.cantidad, esUrgente: pedido.esUrgente, precioUnidad: v.valor.precioUnidad,
          divisa, updatedAt: pedido.updatedAt, destino: cambiaProveedor ? { idBloque: destino } : null,
        },
      })
      onCerrar()
    } catch (e) {
      setError(mensajeErrorGuardado(e, { staleData: staleDataDe(e, MSG_PEDIDO_MODIFICADO) }))
      if (esBloqueInexistente(e) && cambiaProveedor) {
        // El bloque elegido ya no existe: se vuelve a sugerir con los datos recargados.
        const r = await lineas.refetch()
        setDestino(destinoSugeridoEdicion(pedido, v.valor.idProv, agruparEnBloques(r ?? [])))
      }
    }
  }

  return (
    <>
      <DialogoAlmacen abierto={pedido !== null} ancho={520} titulo={pedido ? `Editar pedido #${idVisible(pedido)}` : ''} error={error} textoAccion="Guardar" enviando={editar.isPending} onConfirmar={() => void guardar()} onCancelar={onCerrar}>
        <div className="grid grid-cols-[130px_1fr] items-center gap-x-3.5 gap-y-3">
          <Label htmlFor="editar-otro-concepto" className={CLASE_ETIQUETA}>Concepto:</Label>
          <Input id="editar-otro-concepto" value={concepto} placeholder="Descripción del pedido" onChange={(e) => { setConcepto(e.target.value); setError(null) }} className={CLASE_CAMPO} />
          <span className={CLASE_ETIQUETA}>Proveedor:</span>
          <ComboNavy valor={proveedor === null ? null : String(proveedor)} opciones={opciones} onChange={elegirProveedor} textoVacio="" ancho={320} visibles={8} aria-label="Proveedor" />
          {cambiaProveedor && (
            <>
              <span className={CLASE_ETIQUETA}>Bloque:</span>
              <ComboNavy valor={destino === null ? VALOR_NUEVO : String(destino)} opciones={opcionesBloque} onChange={(v) => setDestino(v === VALOR_NUEVO ? null : Number(v))} textoVacio="" ancho={320} visibles={8} aria-label="Bloque" />
              <p className="col-span-2 rounded-lg bg-seleccion-suave px-2.5 py-2 text-[12px] text-azul-medio">
                Al cambiar el proveedor, la línea sale del Bloque {pedido?.idBloque ?? '—'} y pasa a un bloque de {nuevo?.nombre}.
                {nuevo && nuevo.divisa !== divisa ? ` Ojo: ${nuevo.nombre} trabaja en ${nuevo.divisa}; revisa el precio.` : ''}
              </p>
            </>
          )}
          <Label htmlFor="editar-otro-cantidad" className={CLASE_ETIQUETA}>Cantidad:</Label>
          <Input id="editar-otro-cantidad" value={cantidad} placeholder="Ej. 10" onChange={(e) => { setCantidad(e.target.value); setError(null) }} className={CLASE_CAMPO} />
          <Label htmlFor="editar-otro-precio" className={CLASE_ETIQUETA}>Precio unidad:</Label>
          <div className="flex items-center gap-2">
            <Input id="editar-otro-precio" value={precio} placeholder="0.00" onChange={(e) => { setPrecio(e.target.value); setError(null) }} className={cn(CLASE_CAMPO, 'flex-1')} />
            <ComboNavy valor={divisa} opciones={DIVISAS_EDICION} onChange={(d) => { setDivisa(d); setError(null) }} textoVacio={divisa} ancho={84} aria-label="Divisa" />
          </div>
          <span className={CLASE_ETIQUETA}>Total EUR:</span>
          <span data-testid="total-eur" className="whitespace-pre text-[13px] font-bold text-azul-medio">{textoTotalEdicion(precio, cantidad, divisa, tasa)}</span>
        </div>
      </DialogoAlmacen>
      <ConfirmDialog abierto={confirmarMover} titulo="Mover línea ya pedida" descripcion={pedido ? textoMoverYaPedida(pedido, destino) : ''}
        textoAccion="Guardar y mover" onConfirmar={() => { setConfirmarMover(false); void guardar(true) }} onCancelar={() => setConfirmarMover(false)} />
    </>
  )
}
