import { useLayoutEffect, useState } from 'react'
import type { Proveedor } from '@/shared/api/client'
import { ComboNavy } from '@/shared/ui/ComboNavy'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { DialogoAlmacen } from '../ui/DialogoAlmacen'
import { useErrorServidor } from '../ui/useErrorServidor'
import { MSG_NOMBRE_VACIO } from './NuevoProveedorDialog'

/** Exactamente las dos del combo del JavaFX (:1803-1806). */
const DIVISAS = [{ valor: 'EUR', etiqueta: 'EUR' }, { valor: 'USD', etiqueta: 'USD' }]

type Props = { proveedor: Proveedor | null; enviando: boolean; errorServidor?: string | null; onConfirmar: (datos: { nombre: string; divisa: string; comentario: string }) => void; onCancelar: () => void }

/** Calco de editarProveedor (:1787-1868): Nombre, Divisa (EUR/USD, combo navy), Comentario (3 filas). Sin Enter en el
 *  JavaFX; aquí Enter en "Nombre" confirma (form), diferencia menor que se anota. El nombre del proveedor va en el
 *  subtítulo porque la web no tiene título de ventana ("Editar proveedor — <nombre>"). */
export function EditarProveedorDialog({ proveedor, enviando, errorServidor, onConfirmar, onCancelar }: Props) {
  const [nombre, setNombre] = useState('')
  const [divisa, setDivisa] = useState('EUR')
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState<string | null>(null)
  const servidor = useErrorServidor(errorServidor)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga al abrir con otro proveedor
    if (proveedor) { setNombre(proveedor.nombre); setDivisa(proveedor.divisa || 'EUR'); setComentario(proveedor.comentario ?? ''); setError(null) }
  }, [proveedor])
  function confirmar() {
    const n = nombre.trim()
    if (n === '') { setError(MSG_NOMBRE_VACIO); return }
    setError(null)
    onConfirmar({ nombre: n, divisa, comentario: comentario.trim() })
  }
  return (
    <DialogoAlmacen abierto={proveedor !== null} titulo="Editar proveedor" subtitulo={proveedor?.nombre} error={error ?? servidor.error} textoAccion="Confirmar" enviando={enviando} onConfirmar={confirmar} onCancelar={onCancelar}>
      <Label htmlFor="editar-proveedor-nombre" className="text-[12px] font-bold text-azul-gris">Nombre</Label>
      <Input id="editar-proveedor-nombre" value={nombre} onChange={(e) => { setNombre(e.target.value); servidor.ocultar() }} autoFocus className="bg-superficie text-[13px] text-azul-medio" />
      <span className="text-[12px] font-bold text-azul-gris">Divisa</span>
      <ComboNavy valor={divisa} opciones={DIVISAS} onChange={(d) => { setDivisa(d); servidor.ocultar() }} textoVacio="EUR" ancho={304} aria-label="Divisa" />
      <Label htmlFor="editar-proveedor-comentario" className="text-[12px] font-bold text-azul-gris">Comentario</Label>
      <textarea id="editar-proveedor-comentario" rows={3} value={comentario} onChange={(e) => { setComentario(e.target.value); servidor.ocultar() }} className="w-full rounded border border-fila-sep bg-superficie p-1.5 text-[13px] text-azul-medio" />
    </DialogoAlmacen>
  )
}
