import { useLayoutEffect, useState } from 'react'
import type { ReparacionResumen } from '@/shared/api/client'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'

type Props = { fila: ReparacionResumen | null; onGuardar: (comentario: string) => void; onCerrar: () => void }

/**
 * Calco de abrirEditorComentario: "Comentario de asignación", área de 4 líneas precargada con el comentario de la
 * fila, "Guardar" y "Cancelar". Mismo esqueleto que DialogoObservacion (el del teléfono), pero no lo reutiliza:
 * aquel recibe un GrupoImei y escribe la observación del teléfono, y aquí lo que se edita es el comentario de
 * ESTA asignación.
 *
 * El texto NO se recorta: el JavaFX guarda `ta.getText()` tal cual (a diferencia de la observación del teléfono,
 * que sí hace trim).
 */
export function EditorComentario({ fila, onGuardar, onCerrar }: Props) {
  const [texto, setTexto] = useState('')
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga el comentario de la fila al abrir (patrón de DialogoObservacion)
    if (fila) setTexto(fila.comentarioAsignacion ?? '')
  }, [fila])
  return (
    <Dialog open={fila !== null} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent aria-describedby={undefined} className="max-w-[520px] gap-2 bg-fondo-input p-4">
        <DialogHeader><DialogTitle className="text-[14px] font-bold text-azul-medio">Comentario de asignación</DialogTitle></DialogHeader>
        <Label htmlFor="comentario-asignacion" className="text-[12px]">Comentario — {fila?.idRep ?? ''}</Label>
        <textarea id="comentario-asignacion" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Instrucciones para el técnico..." rows={4}
          className="w-full rounded border border-gris-borde bg-superficie p-2 text-[13px]" />
        <Button onClick={() => onGuardar(texto)} className="h-auto w-full rounded bg-fila-reparado-ico py-2 text-[12px] text-superficie hover:bg-fila-reparado-ico/90">Guardar</Button>
        <DialogFooter><Button variant="outline" onClick={onCerrar}>Cancelar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
