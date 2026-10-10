import { useState } from 'react'
import { formatear } from '@/shared/lib/fechas'
import { formatearImporte } from '@/shared/lib/importes'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { DialogoAlmacen } from '../../ui/DialogoAlmacen'
import { useJuntarBloque, vistaDe } from '../api'
import { tratarFalloBloque } from './fallos'
import { situacion, textoLineas, textoYaPedidasJuntar, totalBloque, type Bloque } from './reglas'

type Props = { bloque: Bloque; candidatos: Bloque[]; onCerrar: () => void }

/** «Juntar con…» (spec §6.5): todas las líneas pasan al bloque elegido (del mismo proveedor) y este desaparece. */
export function JuntarDialog({ bloque, candidatos, onCerrar }: Props) {
  const juntar = useJuntarBloque()
  const { mostrarAviso } = useAlerta()
  const [destino, setDestino] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const yaPedidas = bloque.lineas.filter((p) => p.estado !== 'pendiente').length

  async function confirmar() {
    if (destino === null) return
    try {
      await juntar.mutateAsync({ idBloque: bloque.idBloque as number, destino, lineas: bloque.lineas.map(vistaDe) })
      onCerrar()
    } catch (e) {
      tratarFalloBloque(e, onCerrar, mostrarAviso, setError)
    }
  }

  const subtitulo = `Sus ${textoLineas(bloque.lineas.length)} pasan al bloque que elijas y el Bloque ${bloque.idBloque} desaparece.`
    + (bloque.nota ? ' Su nota se añade a la del destino.' : '')
  return (
    <DialogoAlmacen abierto ancho={520} titulo={`Juntar Bloque ${bloque.idBloque} con…`} subtitulo={subtitulo} error={error}
      textoAccion="Juntar" accionDeshabilitada={destino === null} enviando={juntar.isPending}
      onConfirmar={() => void confirmar()} onCancelar={onCerrar}>
      <div role="radiogroup" aria-label="Bloque destino" className="max-h-[50vh] overflow-y-auto rounded-lg border border-fila-sep bg-superficie">
        {candidatos.map((b) => (
          <label key={b.clave} className="flex cursor-pointer items-center gap-2.5 border-b border-crema px-2.5 py-2 text-[12px] text-azul-medio last:border-b-0">
            <input type="radio" name="juntar-destino" checked={destino === b.idBloque} onChange={() => { setDestino(b.idBloque); setError(null) }} />
            <b>Bloque {b.idBloque}</b>
            <span className="text-azul-gris">
              {formatear(b.fecha, 'dd/MM/yyyy')} · {textoLineas(b.lineas.length)} · {formatearImporte(totalBloque(b), '€')} · {situacion(b)}
            </span>
          </label>
        ))}
      </div>
      {yaPedidas > 0 && (
        <p role="status" className="rounded-lg bg-aviso-conflicto-bg px-2.5 py-2 text-[12px] text-aviso-conflicto-text">
          {textoYaPedidasJuntar(bloque.idBloque as number, yaPedidas)}
        </p>
      )}
    </DialogoAlmacen>
  )
}
