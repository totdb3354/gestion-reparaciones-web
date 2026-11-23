import { useRef, useState } from 'react'
import type { FilaVista } from '@/shared/api/client'
import { StaleDataError, mensajeDeError } from '@/shared/api/errors'
import { crearClavesIdempotencia } from '@/shared/lib/clavesIdempotencia'
import { usePonerMarca } from '../api'
import { estadoPedidos } from './estado'
import { MARCAS, MARCAS_DESPLEGABLE, pedidoVisible } from './filas'

/** Lo más largo que admite la nota de una marca (el servidor responde 400 con más). */
export const MAX_NOTA = 200

/** El selector de marca de una fila con su nota (sin «Cancelado», que va con su botón en el panel). Lo usan el desplegable de la celda del IMEI (debajo del campo, sin quitarle el foco:
 *  nada de aquí se enfoca solo) y el panel de la fila. Sin botones: elegir una marca la guarda al momento («Sin marca» la quita) y la
 *  nota se guarda con Enter o al salir del campo si cambió (sin marca elegida, la nota está desactivada y no se guarda). Mientras se
 *  guarda, selector y nota quedan desactivados. Si falla, vuelven a lo último guardado y el aviso sale arriba de la tabla (el 409 con el
 *  mensaje del servidor y `onHecho`: la fila se recarga). Reintentar manda la misma clave de idempotencia. */
export function EditorMarca({ fila, onHecho }: { fila: FilaVista; onHecho?: () => void }) {
  const [marca, setMarca] = useState(fila.marca ?? '')
  const [nota, setNota] = useState(fila.marcaNota ?? '')
  // Lo último guardado (al abrir, lo que la fila tenía en pantalla): el servidor lo compara con lo que hay (409 si otra persona lo cambió).
  const [guardada, setGuardada] = useState(() => ({ marca: fila.marca ?? '', nota: fila.marcaNota ?? '' }))
  const poner = usePonerMarca()
  const [claves] = useState(() => crearClavesIdempotencia())
  // Guardado en vuelo (referencia: Enter y salir del campo pueden llegar antes de que React pinte el estado «pendiente»).
  const enCurso = useRef(false)
  const guardar = (nueva: string, notaNueva: string) => {
    if (enCurso.current || poner.isPending) return
    enCurso.current = true
    const idFila = fila.idFila
    const cuerpo = { marca: nueva || null, nota: nueva ? notaNueva.trim() || null : null, marcaAnterior: guardada.marca }
    const operacion = `marca:${idFila}`
    poner.mutateAsync({ idFila, ...cuerpo, clave: claves.para(operacion, cuerpo) }).then(
      () => {
        enCurso.current = false
        claves.hecha(operacion)
        setGuardada({ marca: nueva, nota: cuerpo.nota ?? '' })
        setNota(cuerpo.nota ?? '')
        estadoPedidos.set((s) => (s.avisoImei === null ? s : { ...s, avisoImei: null }))
      },
      (e: unknown) => {
        enCurso.current = false
        setMarca(guardada.marca)
        setNota(guardada.nota)
        const aviso = e instanceof StaleDataError
          ? `Pedido ${pedidoVisible(fila) ?? idFila}: ${mensajeDeError(e)}`
          : `No se guardó la marca del pedido ${pedidoVisible(fila) ?? idFila}. Vuelve a intentarlo.`
        estadoPedidos.set((s) => ({ ...s, avisoImei: aviso }))
        if (e instanceof StaleDataError) onHecho?.()
      },
    )
  }
  const guardarNota = () => { if (marca !== '' && nota.trim() !== guardada.nota) guardar(marca, nota) }
  const ocupado = poner.isPending
  return (
    <div role="group" aria-label="Marca de la fila" className="mt-2 border-t border-form-fila-brd pt-2">
      <select aria-label="Marca" value={marca} disabled={ocupado}
        onChange={(e) => { const nueva = e.target.value; setMarca(nueva); guardar(nueva, nota) }}
        className="h-7 w-full min-w-0 rounded-md border border-borde-input bg-superficie px-1.5 text-[12px] disabled:opacity-60">
        <option value="">Sin marca</option>
        {MARCAS_DESPLEGABLE.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
        {fila.marca && !MARCAS.some((m) => m.valor === fila.marca) && <option value={fila.marca}>{fila.marca}</option>}
      </select>
      <input aria-label="Nota de la marca" placeholder="Nota (opcional)" autoComplete="off" maxLength={MAX_NOTA} value={nota}
        disabled={marca === '' || ocupado}
        onChange={(e) => setNota(e.target.value)}
        onBlur={guardarNota}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardarNota() } }}
        className="mt-1.5 h-7 w-full rounded-md border border-borde-input px-2 text-[12px] disabled:opacity-60" />
    </div>
  )
}
