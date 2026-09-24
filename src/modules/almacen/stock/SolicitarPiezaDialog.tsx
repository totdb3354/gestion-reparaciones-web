import { useLayoutEffect, useState } from 'react'
import type { Componente } from '@/shared/api/client'
import { Label } from '@/shared/ui/label'
import { DialogoAlmacen } from '../ui/DialogoAlmacen'
import { subtituloComponente } from './dialogos'

type Props = { componente: Componente | null; enviando: boolean; onConfirmar: (descripcion: string | null) => void; onCancelar: () => void }

/** Calco de solicitarPieza (:701-755): sin validación; descripción recortada y vacía → null. Enter dentro del área de
 *  texto NO confirma (es un textarea; el JavaFX tampoco lo hacía). */
export function SolicitarPiezaDialog({ componente, enviando, onConfirmar, onCancelar }: Props) {
  const [texto, setTexto] = useState('')
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- vacía el área al abrir
    if (componente) setTexto('')
  }, [componente])
  return (
    <DialogoAlmacen abierto={componente !== null} titulo="Solicitar pieza" subtitulo={componente ? subtituloComponente(componente) : undefined} error={null} textoAccion="Solicitar" enviando={enviando} onConfirmar={() => { const d = texto.trim(); onConfirmar(d === '' ? null : d) }} onCancelar={onCancelar}>
      <Label htmlFor="solicitar-pieza-descripcion" className="text-[12px] font-bold text-azul-gris">Descripción (opcional)</Label>
      <textarea id="solicitar-pieza-descripcion" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Motivo o contexto de la solicitud..." autoFocus className="w-full resize-none rounded border border-fila-sep bg-superficie p-2 text-[13px] text-azul-medio" />
    </DialogoAlmacen>
  )
}
