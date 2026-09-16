import { useLayoutEffect, useState } from 'react'
import type { ReparacionResumen } from '@/shared/api/client'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { useTecnicos } from '../api'

type Props = { rep: ReparacionResumen | null; onGuardar: (comentario: string, idTec: number) => void; onCerrar: () => void }

/** Calco de abrirDialogoIncidencia: comentario, técnico asignado (activos, preseleccionado el reparador) y botón que
 *  solo se habilita con ambos. */
export function DialogoIncidencia({ rep, onGuardar, onCerrar }: Props) {
  const { data: tecnicos = [] } = useTecnicos(true)
  const [comentario, setComentario] = useState('')
  const [idTec, setIdTec] = useState<string>('')
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el formulario al abrir con otra fila
    if (rep) { setComentario(rep.incidencia ?? ''); setIdTec(String(rep.idTec)) }
  }, [rep])
  const listo = comentario.trim() !== '' && idTec !== ''
  return (
    <Dialog open={rep !== null} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent aria-describedby={undefined} className="max-w-[520px] gap-2 bg-fondo-input p-4">
        <DialogHeader><DialogTitle className="text-[14px] font-bold text-azul-medio">Añadir incidencia</DialogTitle></DialogHeader>
        <Label htmlFor="incidencia-comentario" className="text-[12px]">Comentario de incidencia</Label>
        <textarea id="incidencia-comentario" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Describe la incidencia..." rows={4} className="w-full rounded border border-gris-borde bg-superficie p-2 text-[13px]" />
        <Label htmlFor="incidencia-tecnico" className="text-[12px]">Técnico asignado</Label>
        <select id="incidencia-tecnico" value={idTec} onChange={(e) => setIdTec(e.target.value)} className="h-9 w-full rounded border border-gris-borde bg-superficie px-2 text-[13px]">
          <option value="">Selecciona técnico</option>
          {tecnicos.map((t) => <option key={t.idTec} value={String(t.idTec)}>{t.nombre}</option>)}
        </select>
        <Button disabled={!listo} onClick={() => onGuardar(comentario.trim(), Number(idTec))} className="h-auto w-full rounded bg-fila-reparado-ico py-2 text-[12px] text-superficie hover:bg-fila-reparado-ico/90 disabled:bg-gris-disabled disabled:text-gris-borde disabled:opacity-100">
          Añadir incidencia y asignar
        </Button>
        <DialogFooter><Button variant="outline" onClick={onCerrar}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
