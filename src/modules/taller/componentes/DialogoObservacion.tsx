import { useLayoutEffect, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import type { GrupoImei } from '../lib/grupoImei'

type Props = { grupo: GrupoImei | null; onGuardar: (observacion: string) => void; onCerrar: () => void }

/** Calco de abrirDialogoObservacionTelefono: "Observación — IMEI <imei>", área de 4 líneas precargada, "Guardar" verde y "Cerrar". */
export function DialogoObservacion({ grupo, onGuardar, onCerrar }: Props) {
  const [texto, setTexto] = useState('')
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga la observación del grupo al abrir
    if (grupo) setTexto(grupo.observacion ?? '')
  }, [grupo])
  return (
    <Dialog open={grupo !== null} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent aria-describedby={undefined} className="max-w-[520px] gap-2 bg-fondo-input p-4">
        <DialogHeader><DialogTitle className="text-[14px] font-bold text-azul-medio">Observación del teléfono</DialogTitle></DialogHeader>
        <Label htmlFor="observacion-telefono" className="text-[12px]">Observación — IMEI {grupo?.imei ?? ''}</Label>
        <textarea id="observacion-telefono" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Observación del teléfono..." rows={4}
          className="w-full rounded border border-gris-borde bg-superficie p-2 text-[13px]" />
        <Button onClick={() => onGuardar(texto.trim())} className="h-auto w-full rounded bg-fila-reparado-ico py-2 text-[12px] text-superficie hover:bg-fila-reparado-ico/90">Guardar</Button>
        <DialogFooter><Button variant="outline" onClick={onCerrar}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
