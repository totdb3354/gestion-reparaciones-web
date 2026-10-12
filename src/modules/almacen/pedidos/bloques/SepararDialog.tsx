import { useState } from 'react'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { cn } from '@/shared/lib/utils'
import { Checkbox } from '@/shared/ui/checkbox'
import { DialogoAlmacen } from '../../ui/DialogoAlmacen'
import { useSepararBloque, vistaDe } from '../api'
import { BadgeEstadoPedido } from '../BadgeEstadoPedido'
import { tratarFalloBloque } from './fallos'
import { sePuedeMover, textoYaPedidasSeparar, type Bloque } from './reglas'

type Props = { bloque: Bloque; onCerrar: () => void }

/** «Separar líneas…» (spec §6.5): las marcadas pasan a un bloque nuevo del mismo proveedor; al menos una se queda. Las
 *  ya pedidas no piden otra confirmación: el aviso va dentro y el botón dice «Separar igualmente». Solo se marcan
 *  líneas vivas (pendiente, en camino o parcial); las recibidas y canceladas se ven pero no se pueden separar (2026-10-12). */
export function SepararDialog({ bloque, onCerrar }: Props) {
  const separar = useSepararBloque()
  const { mostrarAviso } = useAlerta()
  const [marcadas, setMarcadas] = useState<Set<number>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const elegidas = bloque.lineas.filter((p) => marcadas.has(p.idCompra))
  const todas = elegidas.length === bloque.lineas.length
  const yaPedidas = elegidas.filter((p) => p.estado !== 'pendiente').length
  const deshabilitado = elegidas.length === 0 || todas

  function alternar(idCompra: number, marcada: boolean) {
    setMarcadas((m) => {
      const n = new Set(m)
      if (marcada) n.add(idCompra)
      else n.delete(idCompra)
      return n
    })
    setError(null)
  }

  async function confirmar() {
    if (deshabilitado) return
    try {
      await separar.mutateAsync({ idBloque: bloque.idBloque as number, lineas: elegidas.map(vistaDe) })
      onCerrar()
    } catch (e) {
      tratarFalloBloque(e, onCerrar, mostrarAviso, setError)
    }
  }

  const textoAccion = `${yaPedidas > 0 ? 'Separar igualmente' : 'Separar'}${elegidas.length > 0 ? ` (${elegidas.length})` : ''}`
  return (
    <DialogoAlmacen abierto ancho={520} titulo={`Separar líneas · Bloque ${bloque.idBloque}`}
      subtitulo={`Las marcadas pasan a un bloque nuevo de ${bloque.nombreProveedor} con fecha de hoy.`} error={error}
      textoAccion={textoAccion} accionDeshabilitada={deshabilitado} enviando={separar.isPending}
      onConfirmar={() => void confirmar()} onCancelar={onCerrar}>
      <ul className="max-h-[50vh] overflow-y-auto rounded-lg border border-fila-sep bg-superficie">
        {bloque.lineas.map((p) => (
          <li key={p.idCompra} className="border-b border-crema last:border-b-0">
            <label className={cn('flex items-center gap-2.5 px-2.5 py-1.5 text-[12px] text-azul-medio',
              sePuedeMover(p) ? 'cursor-pointer' : 'cursor-default opacity-60')}>
              <Checkbox checked={marcadas.has(p.idCompra)} disabled={!sePuedeMover(p)} onCheckedChange={(v) => alternar(p.idCompra, v === true)}
                aria-label={`Separar ${p.tipoComponente} (ID ${p.idCompra})`} className="bg-superficie" />
              <span className="text-azul-gris">{p.idCompra}</span>
              <b>{p.tipoComponente}</b>
              <span>× {p.cantidad}</span>
              <span className="ml-auto"><BadgeEstadoPedido pedido={p} /></span>
            </label>
          </li>
        ))}
      </ul>
      {todas && <p role="status" className="text-[12px] text-azul-gris">Deja al menos una línea en el Bloque {bloque.idBloque}.</p>}
      {yaPedidas > 0 && (
        <p role="status" className="rounded-lg bg-aviso-conflicto-bg px-2.5 py-2 text-[12px] text-aviso-conflicto-text">{textoYaPedidasSeparar(yaPedidas)}</p>
      )}
    </DialogoAlmacen>
  )
}
