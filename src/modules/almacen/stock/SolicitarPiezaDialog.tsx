import { useLayoutEffect, useState } from 'react'
import { Label } from '@/shared/ui/label'
import { ComboNavy } from '@/shared/ui/ComboNavy'
import { DialogoAlmacen } from '../ui/DialogoAlmacen'
import { subtituloComponente } from './dialogos'
import { esGrupo, nombreGrupo, type FilaStock } from './grupos'

type Props = { componente: FilaStock | null; enviando: boolean; onConfirmar: (idCom: number, descripcion: string | null) => void; onCancelar: () => void }

/** Calco de solicitarPieza (:701-755): descripción recortada y vacía → null. Enter dentro del área de texto NO confirma
 *  (es un textarea; el JavaFX tampoco lo hacía). En una fila de grupo compartido hay que elegir el modelo (un miembro del
 *  grupo) y la solicitud se guarda con el idCom del elegido. */
export function SolicitarPiezaDialog({ componente, enviando, onConfirmar, onCancelar }: Props) {
  const [texto, setTexto] = useState('')
  const [idElegido, setIdElegido] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- vacía el área, el modelo y el aviso al abrir
    if (componente) { setTexto(''); setIdElegido(null); setError(null) }
  }, [componente])
  const grupo = componente !== null && esGrupo(componente)
  const confirmar = () => {
    if (!componente) return
    let idCom = componente.idCom
    if (grupo) {
      if (idElegido === null) { setError('Elige el modelo.'); return }
      idCom = Number(idElegido)
    }
    const d = texto.trim()
    onConfirmar(idCom, d === '' ? null : d)
  }
  const subtitulo = componente ? subtituloComponente(grupo ? { tipo: nombreGrupo(componente), stock: componente.stock } : componente) : undefined
  return (
    <DialogoAlmacen abierto={componente !== null} titulo="Solicitar pieza" subtitulo={subtitulo} error={error} textoAccion="Solicitar" enviando={enviando} accionDeshabilitada={grupo && idElegido === null} onConfirmar={confirmar} onCancelar={onCancelar}>
      {grupo && componente && (
        <>
          <span className="text-[12px] font-bold text-azul-gris">Modelo</span>
          <ComboNavy valor={idElegido} opciones={componente.miembros.map((m) => ({ valor: String(m.idCom), etiqueta: m.tipo }))} onChange={(v) => { setIdElegido(v); setError(null) }} textoVacio="" ancho="full" visibles={8} aria-label="Modelo" />
        </>
      )}
      <Label htmlFor="solicitar-pieza-descripcion" className="text-[12px] font-bold text-azul-gris">Descripción (opcional)</Label>
      <textarea id="solicitar-pieza-descripcion" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Motivo o contexto de la solicitud..." autoFocus={!grupo} className="w-full resize-none rounded border border-fila-sep bg-superficie p-2 text-[13px] text-azul-medio" />
    </DialogoAlmacen>
  )
}
