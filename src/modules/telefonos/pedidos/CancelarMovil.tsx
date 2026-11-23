import { useState, type ReactNode } from 'react'
import type { FilaVista } from '@/shared/api/client'
import { StaleDataError, mensajeDeError } from '@/shared/api/errors'
import { crearClavesIdempotencia } from '@/shared/lib/clavesIdempotencia'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { usePonerMarca } from '../api'
import { MAX_NOTA } from './EditorMarca'
import { estadoPedidos } from './estado'
import { pedidoVisible, textoMarca } from './filas'

const BOTON = 'h-7 cursor-pointer rounded-md border bg-superficie px-2.5 text-[12px] font-semibold disabled:cursor-default disabled:opacity-60'
const BOTON_DIALOGO = 'h-8 cursor-pointer rounded-md border px-3 text-[12.5px] font-semibold disabled:cursor-default disabled:opacity-60'

/** Guarda la marca CANCELADO (o la quita) con la misma clave de idempotencia al reintentar. Un fallo deja el aviso arriba de la tabla
 *  como el editor de marcas (un 409, con el mensaje del servidor: otra persona cambió la marca o el IMEI ya está en otro pedido). */
function useGuardarCancelacion(fila: FilaVista) {
  const poner = usePonerMarca()
  const [claves] = useState(() => crearClavesIdempotencia())
  const guardar = (cancelar: boolean, nota: string | null, alAcabar: () => void) => {
    const cuerpo = cancelar
      ? { marca: 'CANCELADO', nota, marcaAnterior: fila.marca ?? '' }
      : { marca: null, nota: null, marcaAnterior: 'CANCELADO' }
    const operacion = `cancelar:${fila.idFila}`
    poner.mutateAsync({ idFila: fila.idFila, ...cuerpo, clave: claves.para(operacion, cuerpo) }).then(
      () => {
        claves.hecha(operacion)
        estadoPedidos.set((s) => (s.avisoImei === null ? s : { ...s, avisoImei: null }))
        alAcabar()
      },
      (e: unknown) => {
        const pedido = pedidoVisible(fila) ?? fila.idFila
        const aviso = e instanceof StaleDataError
          ? `Pedido ${pedido}: ${mensajeDeError(e)}`
          : `No se guardó la cancelación del pedido ${pedido}. Vuelve a intentarlo.`
        estadoPedidos.set((s) => ({ ...s, avisoImei: aviso }))
        alAcabar()
      },
    )
  }
  return { guardar, guardando: poner.isPending }
}

function Confirmacion({ abierto, titulo, children, textoAccion, peligro, guardando, onConfirmar, onVolver }: {
  abierto: boolean; titulo: string; children: ReactNode; textoAccion: string; peligro: boolean; guardando: boolean
  onConfirmar: () => void; onVolver: () => void
}) {
  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o) onVolver() }}>
      <DialogContent className="max-w-[min(420px,calc(100%-2rem))] gap-2 p-5">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-bold text-azul-medio">{titulo}</DialogTitle>
          <DialogDescription asChild><div className="text-[13px] text-azul-noche">{children}</div></DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2">
          <button type="button" onClick={onVolver} className={`${BOTON_DIALOGO} border-borde-input bg-superficie`}>Volver</button>
          <button type="button" disabled={guardando} onClick={onConfirmar}
            className={`${BOTON_DIALOGO} ${peligro ? 'border-rojo-accion bg-rojo-accion text-crema' : 'border-azul-noche bg-azul-noche text-crema'}`}>{textoAccion}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** «Cancelar móvil» (spec 2026-11-23): con confirmación y nota opcional. Pone la marca CANCELADO; el servidor quita «Falta por enviar». */
export function BotonCancelarMovil({ fila }: { fila: FilaVista }) {
  const [abierto, setAbierto] = useState(false)
  const [nota, setNota] = useState('')
  const { guardar, guardando } = useGuardarCancelacion(fila)
  const pedido = pedidoVisible(fila)
  const que = [pedido && `Pedido ${pedido}`, fila.imei && `IMEI ${fila.imei}`].filter(Boolean).join(', ')
  const abrir = () => { setNota(''); setAbierto(true) }
  return (
    <>
      <button type="button" onClick={abrir} className={`${BOTON} mt-2.5 border-[#e7a29b] text-texto-error`}>Cancelar móvil</button>
      <Confirmacion abierto={abierto} titulo="¿Cancelar este móvil?" textoAccion="Cancelar el móvil" peligro guardando={guardando}
        onVolver={() => setAbierto(false)}
        onConfirmar={() => guardar(true, nota.trim() || null, () => setAbierto(false))}>
        {que && <p className="m-0 mb-1.5">{que}.</p>}
        <p className="m-0 mb-1.5">{fila.imei ? 'No saldrá en este pedido y su IMEI quedará libre para otro pedido.' : 'No saldrá en este pedido.'}</p>
        {fila.faltaEnviarEn && <p className="m-0 mb-1.5 font-semibold text-pill-aviso-text">Se quitará también «Falta por enviar».</p>}
        {fila.marca && <p className="m-0 mb-1.5 text-azul-gris">Sustituye a la marca «{textoMarca(fila.marca)}».</p>}
        <input aria-label="Nota de la cancelación" placeholder="Nota (opcional): motivo de la cancelación" autoComplete="off"
          maxLength={MAX_NOTA} value={nota} onChange={(e) => setNota(e.target.value)}
          className="mt-1 h-8 w-full rounded-md border border-borde-input px-2 text-[12.5px]" />
      </Confirmacion>
    </>
  )
}

/** «Quitar cancelación»: con confirmación. Quita la marca CANCELADO; el servidor da 409 si el IMEI ya está en otra fila viva. */
export function BotonQuitarCancelacion({ fila }: { fila: FilaVista }) {
  const [abierto, setAbierto] = useState(false)
  const { guardar, guardando } = useGuardarCancelacion(fila)
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={`${BOTON} mt-2 border-borde-input`}>Quitar cancelación</button>
      <Confirmacion abierto={abierto} titulo="¿Quitar la cancelación?" textoAccion="Quitar cancelación" peligro={false} guardando={guardando}
        onVolver={() => setAbierto(false)}
        onConfirmar={() => guardar(false, null, () => setAbierto(false))}>
        <p className="m-0 mb-1.5">{`${pedidoVisible(fila) ? `Pedido ${pedidoVisible(fila)}. ` : ''}La fila vuelve a estar pendiente${fila.imei ? ' y su IMEI vuelve a contar como ocupado' : ''}.`}</p>
        <p className="m-0 text-azul-gris">«Falta por enviar» no vuelve: si hace falta, márcala otra vez.</p>
      </Confirmacion>
    </>
  )
}
