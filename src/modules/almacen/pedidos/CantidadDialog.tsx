import { useLayoutEffect, useState } from 'react'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { DialogoAlmacen } from '../ui/DialogoAlmacen'
import { useErrorServidor } from '../ui/useErrorServidor'
import { idPedido, nombrePedido, restante, validarParcial, validarResto, type Pedido } from './reglas'

type Props = {
  modo: 'parcial' | 'resto'
  pedido: Pedido | null
  errorServidor: string | null
  enviando: boolean
  onConfirmar: (cantidad: number) => void
  onCancelar: () => void
}

/** Cabecera del TextInputDialog (StockController :1506-1507 y :1539-1541). La de "Recibir unidades" corrige el "o más"
 *  que el cliente no permite (P7); una recibida nula (no debería en `parcial`) se pinta 0. */
function subtitulo(modo: 'parcial' | 'resto', p: Pedido): string {
  const cabecera = `Pedido #${idPedido(p)} — ${nombrePedido(p)}`
  if (modo === 'parcial') return `${cabecera} (${p.cantidad} pedidas)`
  return `${cabecera} (recibidas: ${p.cantidadRecibida ?? 0}/${p.cantidad})\nSi introduces ${restante(p)}, el pedido se cerrará como recibido.`
}

/** "Recepción parcial" y "Recibir unidades" (spec 4b §6, P6): los TextInputDialog y los Alert WARNING del JavaFX pasan a
 *  DialogoAlmacen con el error en su línea; el diálogo sigue abierto hasta que la cantidad vale. Un 422 del servidor
 *  (`errorServidor`) se pinta en la misma línea si no hay error local y se oculta al teclear. */
export function CantidadDialog({ modo, pedido, errorServidor, enviando, onConfirmar, onCancelar }: Props) {
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const servidor = useErrorServidor(errorServidor)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el campo al abrir con otro pedido (patrón de EditarStockDialog)
    if (pedido) { setTexto(modo === 'resto' ? String(restante(pedido)) : ''); setError(null) }
  }, [pedido, modo])
  function confirmar() {
    if (!pedido) return
    const r = modo === 'parcial' ? validarParcial(texto, pedido.cantidad) : validarResto(texto, pedido.cantidadRecibida, pedido.cantidad)
    if (!r.ok) { setError(r.error); return }
    setError(null)
    onConfirmar(r.valor)
  }
  const id = `cantidad-pedido-${modo}`
  return (
    <DialogoAlmacen
      abierto={pedido !== null}
      titulo={modo === 'parcial' ? 'Recepción parcial' : 'Recibir unidades'}
      subtitulo={pedido ? subtitulo(modo, pedido) : undefined}
      error={error ?? servidor.error}
      textoAccion="Confirmar"
      enviando={enviando}
      onConfirmar={confirmar}
      onCancelar={onCancelar}
    >
      <Label htmlFor={id} className="text-[12px] font-bold text-azul-gris">{modo === 'parcial' ? 'Cantidad recibida ahora:' : 'Cantidad que llega ahora:'}</Label>
      <Input id={id} value={texto} onChange={(e) => { setTexto(e.target.value); servidor.ocultar() }} autoFocus className="bg-superficie text-[13px] text-azul-medio" />
    </DialogoAlmacen>
  )
}
