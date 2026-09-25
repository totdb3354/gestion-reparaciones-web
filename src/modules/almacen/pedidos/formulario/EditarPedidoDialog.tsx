import { useLayoutEffect, useMemo, useState } from 'react'
import type { CompraComponente } from '@/shared/api/client'
import { formatearNumero } from '@/shared/lib/importes'
import { cn } from '@/shared/lib/utils'
import { Checkbox } from '@/shared/ui/checkbox'
import { ComboNavy } from '@/shared/ui/ComboNavy'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useProveedoresComponentes } from '../../proveedores/api'
import { DialogoAlmacen } from '../../ui/DialogoAlmacen'
import { useEditarCompra } from '../api'
import { useTasa } from '../tasa'
import { CLASE_CAMPO, CLASE_ETIQUETA, DIVISAS_EDICION, MSG_PEDIDO_MODIFICADO, textoTotalEdicion, validarEdicion } from './edicion'
import { mensajeErrorGuardado } from './errores'

type Props = { pedido: CompraComponente | null; onCerrar: () => void }

/** "Editar pedido #{id}" de componentes (FormularioCompraEditarController, inventario §12, spec §6). `pedido === null` =
 *  cerrado. La cantidad se precarga con la PEDIDA (P2); el servidor rechaza cambiarla en un recibido (422). */
export function EditarPedidoDialog({ pedido, onCerrar }: Props) {
  const { data: proveedores } = useProveedoresComponentes({ activo: false })
  const activos = useMemo(() => (proveedores ?? []).filter((p) => p.activo), [proveedores])
  const opciones = useMemo(() => activos.map((p) => ({ valor: String(p.idProv), etiqueta: p.nombre })), [activos])
  const [idProv, setIdProv] = useState<number | null>(null)
  const [cantidad, setCantidad] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [precio, setPrecio] = useState('')
  const [divisa, setDivisa] = useState('EUR')
  const [error, setError] = useState<string | null>(null)
  const editar = useEditarCompra()
  const tasa = useTasa(pedido ? divisa : null)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga al abrir con otro pedido (patrón de EditarStockDialog)
    if (pedido) { setIdProv(pedido.idProv); setCantidad(String(pedido.cantidad)); setUrgente(pedido.esUrgente); setPrecio(formatearNumero(pedido.precioUnidadPedido)); setDivisa(pedido.divisa); setError(null) }
  }, [pedido])
  // Proveedor inactivo (o lista aún sin llegar) → combo vacío y "Selecciona un proveedor." al guardar (calco, FCE :70-72).
  const proveedor = idProv !== null && activos.some((p) => p.idProv === idProv) ? idProv : null

  async function guardar() {
    if (!pedido) return
    const v = validarEdicion({ idProv: proveedor, cantidad, precio })
    if (!v.ok) {
      setError(v.error)
      return
    }
    setError(null)
    try {
      await editar.mutateAsync({
        idCompra: pedido.idCompra,
        cuerpo: { idProv: v.valor.idProv, cantidad: v.valor.cantidad, esUrgente: urgente, precioUnidad: v.valor.precioUnidad, divisa, updatedAt: pedido.updatedAt },
      })
      onCerrar()
    } catch (e) {
      setError(mensajeErrorGuardado(e, { staleData: MSG_PEDIDO_MODIFICADO }))
    }
  }

  return (
    <DialogoAlmacen abierto={pedido !== null} ancho={520} titulo={pedido ? `Editar pedido #${pedido.idCompra}` : ''} error={error} textoAccion="Guardar" enviando={editar.isPending} onConfirmar={() => void guardar()} onCancelar={onCerrar}>
      <div className="grid grid-cols-[130px_1fr] items-center gap-x-3.5 gap-y-3">
        <span className={CLASE_ETIQUETA}>Componente:</span>
        <span className="text-[12px] font-bold text-azul-medio">{pedido?.tipoComponente}</span>
        <span className={CLASE_ETIQUETA}>Proveedor:</span>
        <ComboNavy valor={proveedor === null ? null : String(proveedor)} opciones={opciones} onChange={(v) => { setIdProv(Number(v)); setError(null) }} textoVacio="" ancho={320} visibles={8} aria-label="Proveedor" />
        <Label htmlFor="editar-pedido-cantidad" className={CLASE_ETIQUETA}>Cantidad:</Label>
        <Input id="editar-pedido-cantidad" value={cantidad} placeholder="Ej. 10" onChange={(e) => { setCantidad(e.target.value); setError(null) }} className={CLASE_CAMPO} />
        <Label htmlFor="editar-pedido-urgente" className={CLASE_ETIQUETA}>Urgente:</Label>
        <Checkbox id="editar-pedido-urgente" checked={urgente} onCheckedChange={(v) => { setUrgente(v === true); setError(null) }} className="justify-self-start bg-superficie" />
        <Label htmlFor="editar-pedido-precio" className={CLASE_ETIQUETA}>Precio unidad:</Label>
        <div className="flex items-center gap-2">
          <Input id="editar-pedido-precio" value={precio} placeholder="0.00" onChange={(e) => { setPrecio(e.target.value); setError(null) }} className={cn(CLASE_CAMPO, 'flex-1')} />
          <ComboNavy valor={divisa} opciones={DIVISAS_EDICION} onChange={(d) => { setDivisa(d); setError(null) }} textoVacio={divisa} ancho={84} aria-label="Divisa" />
        </div>
        <span className={CLASE_ETIQUETA}>Total EUR:</span>
        <span data-testid="total-eur" className="whitespace-pre text-[13px] font-bold text-azul-medio">{textoTotalEdicion(precio, cantidad, divisa, tasa)}</span>
      </div>
    </DialogoAlmacen>
  )
}
