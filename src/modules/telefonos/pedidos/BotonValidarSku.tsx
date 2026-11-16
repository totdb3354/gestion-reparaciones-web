import { useRef, useState } from 'react'
import type { FilaVista } from '@/shared/api/client'
import { StaleDataError, mensajeDeError } from '@/shared/api/errors'
import { crearClavesIdempotencia } from '@/shared/lib/clavesIdempotencia'
import { useValidarSku } from '../api'
import { estadoPedidos } from './estado'
import { estaValidada, pedidoVisible, puedeValidar } from './filas'

/** El botón único «Validar SKU» / «Quitar validación» de una fila: da por bueno el aviso naranja de SKU del IMEI (o lo deja sin validar).
 *  Sale «Validar SKU» si la celda está en naranja por un motivo de SKU y «Quitar validación» si la fila ya está validada; en cualquier
 *  otro caso no sale. Sin autofoco (el foco del desplegable es del campo del lector). Guarda al pulsar; si falla, el aviso sale arriba de
 *  la tabla (con el mensaje del servidor en el 409) y reintentar manda la misma clave de idempotencia. */
export function BotonValidarSku({ fila }: { fila: FilaVista }) {
  const validada = estaValidada(fila)
  const poner = useValidarSku()
  const [claves] = useState(() => crearClavesIdempotencia())
  const enCurso = useRef(false)
  if (!validada && !puedeValidar(fila)) return null
  if (validada && !fila.editable) return null
  const pulsar = () => {
    if (enCurso.current || poner.isPending) return
    enCurso.current = true
    const idFila = fila.idFila
    const cuerpo = { validar: !validada, imeiAnterior: fila.imei }
    const operacion = `validacion:${idFila}`
    poner.mutateAsync({ idFila, ...cuerpo, clave: claves.para(operacion, cuerpo) }).then(
      () => {
        enCurso.current = false
        claves.hecha(operacion)
        estadoPedidos.set((s) => (s.avisoImei === null ? s : { ...s, avisoImei: null }))
      },
      (e: unknown) => {
        enCurso.current = false
        const aviso = e instanceof StaleDataError
          ? `Pedido ${pedidoVisible(fila) ?? idFila}: ${mensajeDeError(e)}`
          : `No se guardó la validación del pedido ${pedidoVisible(fila) ?? idFila}. Vuelve a intentarlo.`
        estadoPedidos.set((s) => ({ ...s, avisoImei: aviso }))
      },
    )
  }
  return (
    <button type="button" disabled={poner.isPending} onClick={pulsar}
      className="mt-1.5 h-7 cursor-pointer rounded-md border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold disabled:cursor-default disabled:opacity-60">
      {validada ? 'Quitar validación' : 'Validar SKU'}
    </button>
  )
}
