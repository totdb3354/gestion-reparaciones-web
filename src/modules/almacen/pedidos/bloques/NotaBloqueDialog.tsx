import { useState } from 'react'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { DialogoAlmacen } from '../../ui/DialogoAlmacen'
import { useNotaBloque } from '../api'
import { tratarFalloBloque } from './fallos'
import type { Bloque } from './reglas'

const MAX_NOTA = 200 // VARCHAR(200) de Bloque_compra.NOTA

type Props = { bloque: Bloque; onCerrar: () => void }

/** «Añadir nota…» / «Editar nota…» (spec §6.5): recortada; vacía = sin nota. */
export function NotaBloqueDialog({ bloque, onCerrar }: Props) {
  const guardar = useNotaBloque()
  const { mostrarAviso } = useAlerta()
  const [texto, setTexto] = useState(bloque.nota ?? '')
  const [error, setError] = useState<string | null>(null)

  async function confirmar() {
    const limpia = texto.trim()
    try {
      await guardar.mutateAsync({ idBloque: bloque.idBloque as number, nota: limpia === '' ? null : limpia, updatedAt: bloque.updatedAt as string })
      onCerrar()
    } catch (e) {
      tratarFalloBloque(e, onCerrar, mostrarAviso, setError)
    }
  }

  return (
    <DialogoAlmacen abierto ancho={520} titulo={`Nota · Bloque ${bloque.idBloque}`}
      subtitulo="Nº de pedido o factura del proveedor, seguimiento, forma de pago… Sale en la cabecera y en el CSV."
      error={error} textoAccion="Guardar" enviando={guardar.isPending} onConfirmar={() => void confirmar()} onCancelar={onCerrar}>
      <textarea aria-label="Nota del bloque" value={texto} maxLength={MAX_NOTA} rows={3}
        onChange={(e) => { setTexto(e.target.value); setError(null) }}
        className="w-full resize-none rounded border border-fila-sep bg-superficie p-2 text-[13px] text-azul-medio" />
      <p className="text-right text-[11px] text-texto-sub">{texto.length}/{MAX_NOTA}</p>
    </DialogoAlmacen>
  )
}
