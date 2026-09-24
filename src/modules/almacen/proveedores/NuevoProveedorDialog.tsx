import { useLayoutEffect, useState } from 'react'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { DialogoAlmacen } from '../ui/DialogoAlmacen'
import { useErrorServidor } from '../ui/useErrorServidor'

export const MSG_NOMBRE_VACIO = 'El nombre no puede estar vacío.'

type Props = { abierto: boolean; enviando: boolean; errorServidor?: string | null; onConfirmar: (nombre: string) => void; onCancelar: () => void }

/** El TextInputDialog nativo de nuevoProveedor (:1773-1785) pasa al diálogo propio (spec 4a, S5): solo el nombre,
 *  "Nombre del proveedor:", sin cabecera. Diferencia S5: el nombre en blanco avisa en vez de cerrarse en silencio. */
export function NuevoProveedorDialog({ abierto, enviando, errorServidor, onConfirmar, onCancelar }: Props) {
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const servidor = useErrorServidor(errorServidor)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- vacía el campo al abrir
    if (abierto) { setNombre(''); setError(null) }
  }, [abierto])
  function confirmar() {
    const n = nombre.trim()
    if (n === '') { setError(MSG_NOMBRE_VACIO); return }
    setError(null)
    onConfirmar(n)
  }
  return (
    <DialogoAlmacen abierto={abierto} titulo="Nuevo proveedor" error={error ?? servidor.error} textoAccion="Confirmar" enviando={enviando} onConfirmar={confirmar} onCancelar={onCancelar}>
      <Label htmlFor="nuevo-proveedor-nombre" className="text-[12px] font-bold text-azul-gris">Nombre del proveedor:</Label>
      <Input id="nuevo-proveedor-nombre" value={nombre} onChange={(e) => { setNombre(e.target.value); servidor.ocultar() }} autoFocus className="bg-superficie text-[13px] text-azul-medio" />
    </DialogoAlmacen>
  )
}
