import { useState } from 'react'
import type { FilaVista } from '@/shared/api/client'
import { StaleDataError, mensajeDeError } from '@/shared/api/errors'
import { crearClavesIdempotencia } from '@/shared/lib/clavesIdempotencia'
import { usePonerMarca } from '../api'
import { estadoPedidos } from './estado'
import { MARCAS } from './filas'

/** Lo más largo que admite la nota de una marca (el servidor responde 400 con más). */
export const MAX_NOTA = 200

/** El selector de marca de una fila con su nota, «Guardar marca» y «Quitar la marca». Lo usan el desplegable de la celda del IMEI
 *  (debajo del campo, sin quitarle el foco: nada de aquí se enfoca solo) y el panel de la fila. `onHecho` se llama al guardar bien, o
 *  al recibir un 409 (la fila se recarga y el aviso lo dice). Un fallo de otro tipo deja el editor como está y avisa arriba de la
 *  tabla; reintentar manda la misma clave de idempotencia. */
export function EditorMarca({ fila, onHecho }: { fila: FilaVista; onHecho?: () => void }) {
  const [marca, setMarca] = useState(fila.marca ?? '')
  const [nota, setNota] = useState(fila.marcaNota ?? '')
  // Lo que la fila tenía en pantalla al abrir el editor: el servidor lo compara con lo que hay (409 si otra persona lo cambió).
  const [anterior] = useState(() => fila.marca ?? '')
  const poner = usePonerMarca()
  const [claves] = useState(() => crearClavesIdempotencia())
  const guardar = (nueva: string | null) => {
    if (poner.isPending) return
    const idFila = fila.idFila
    const cuerpo = { marca: nueva, nota: nueva ? nota.trim() || null : null, marcaAnterior: anterior }
    const operacion = `marca:${idFila}`
    poner.mutateAsync({ idFila, ...cuerpo, clave: claves.para(operacion, cuerpo) }).then(
      () => {
        claves.hecha(operacion)
        estadoPedidos.set((s) => (s.avisoImei === null ? s : { ...s, avisoImei: null }))
        onHecho?.()
      },
      (e: unknown) => {
        const aviso = e instanceof StaleDataError
          ? `Pedido ${fila.pedido ?? idFila}: ${mensajeDeError(e)}`
          : `No se guardó la marca del pedido ${fila.pedido ?? idFila}. Vuelve a intentarlo.`
        estadoPedidos.set((s) => ({ ...s, avisoImei: aviso }))
        if (e instanceof StaleDataError) onHecho?.()
      },
    )
  }
  const cambiada = marca !== (fila.marca ?? '') || (marca !== '' && nota.trim() !== (fila.marcaNota ?? ''))
  return (
    <div role="group" aria-label="Marca de la fila" className="mt-2 border-t border-form-fila-brd pt-2">
      <div className="flex gap-1.5">
        <select aria-label="Marca" value={marca} onChange={(e) => setMarca(e.target.value)}
          className="h-7 min-w-0 flex-1 rounded-md border border-borde-input bg-superficie px-1.5 text-[12px]">
          <option value="">Sin marca</option>
          {MARCAS.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
          {fila.marca && !MARCAS.some((m) => m.valor === fila.marca) && <option value={fila.marca}>{fila.marca}</option>}
        </select>
        <button type="button" disabled={poner.isPending || marca === '' || !cambiada} onClick={() => guardar(marca)}
          className="h-7 cursor-pointer rounded-md border border-borde-input bg-superficie px-2 text-[12px] font-semibold disabled:cursor-default disabled:opacity-60">Guardar marca</button>
      </div>
      {marca !== '' && (
        <input aria-label="Nota de la marca" placeholder="Nota (opcional)" autoComplete="off" maxLength={MAX_NOTA} value={nota}
          onChange={(e) => setNota(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (cambiada) guardar(marca) } }}
          className="mt-1.5 h-7 w-full rounded-md border border-borde-input px-2 text-[12px]" />
      )}
      {fila.marca && (
        <button type="button" disabled={poner.isPending} onClick={() => guardar(null)}
          className="mt-1.5 h-7 cursor-pointer rounded-md border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold disabled:cursor-default disabled:opacity-60">Quitar la marca</button>
      )}
    </div>
  )
}
