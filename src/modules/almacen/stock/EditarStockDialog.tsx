import { useLayoutEffect, useState } from 'react'
import type { Componente } from '@/shared/api/client'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { DialogoAlmacen } from '../ui/DialogoAlmacen'
import { useErrorServidor } from '../ui/useErrorServidor'
import { parseEnteroNoNegativo, subtituloComponente } from './dialogos'

export const MSG_CANTIDAD_NO_VALIDA = 'Cantidad no válida (debe ser ≥ 0).'

type Props = { componente: Componente | null; enviando: boolean; errorServidor?: string | null; onConfirmar: (stock: number) => void; onCancelar: () => void }

/** Calco de editarStock (:607-675): campo precargado con el stock y con foco, Enter confirma, el error deja el diálogo
 *  abierto. Un 422 del servidor (`errorServidor`) se pinta en la misma línea si no hay error local. */
export function EditarStockDialog({ componente, enviando, errorServidor, onConfirmar, onCancelar }: Props) {
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const servidor = useErrorServidor(errorServidor)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el campo al abrir con otro componente (patrón "Adjusting state")
    if (componente) { setTexto(String(componente.stock)); setError(null) }
  }, [componente])
  function confirmar() {
    const n = parseEnteroNoNegativo(texto)
    if (n === null) { setError(MSG_CANTIDAD_NO_VALIDA); return }
    setError(null)
    onConfirmar(n)
  }
  return (
    <DialogoAlmacen abierto={componente !== null} titulo="Editar stock" subtitulo={componente ? subtituloComponente(componente) : undefined} error={error ?? servidor.error} textoAccion="Confirmar" enviando={enviando} onConfirmar={confirmar} onCancelar={onCancelar}>
      <Label htmlFor="editar-stock-cantidad" className="text-[12px] font-bold text-azul-gris">Nueva cantidad</Label>
      <Input id="editar-stock-cantidad" value={texto} onChange={(e) => { setTexto(e.target.value); servidor.ocultar() }} autoFocus className="bg-superficie text-[13px] text-azul-medio" />
    </DialogoAlmacen>
  )
}
