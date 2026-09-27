import { useLayoutEffect, useState } from 'react'
import { useCerrojoEnvio } from '@/shared/lib/useCerrojoEnvio'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import type { GrupoImei } from '../lib/grupoImei'

type Props = { grupo: GrupoImei | null; enviando: boolean; onGuardar: (observacion: string) => void; onCerrar: () => void }

/** Calco de abrirDialogoObservacionTelefono: "Observación — IMEI <imei>", área de 4 líneas precargada, "Guardar" verde y "Cerrar".
 *  Quien lo abre lo cierra cuando el guardado sale bien: mientras guarda (`enviando`) no se cierra ni se puede volver a
 *  guardar (cerrojo de useCerrojoEnvio) y, si falla, sigue abierto con lo escrito, como la ventana del JavaFX. */
export function DialogoObservacion({ grupo, enviando, onGuardar, onCerrar }: Props) {
  const [texto, setTexto] = useState('')
  const enviar = useCerrojoEnvio({ abierto: grupo !== null, enviando })
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga la observación del grupo al abrir
    if (grupo) setTexto(grupo.observacion ?? '')
  }, [grupo])
  return (
    <Dialog open={grupo !== null} onOpenChange={(o) => { if (!o && !enviando) onCerrar() }}>
      <DialogContent aria-describedby={undefined} className="max-w-[520px] gap-2 bg-fondo-input p-4">
        <DialogHeader><DialogTitle className="text-[14px] font-bold text-azul-medio">Observación del teléfono</DialogTitle></DialogHeader>
        <Label htmlFor="observacion-telefono" className="text-[12px]">Observación — IMEI {grupo?.imei ?? ''}</Label>
        <textarea id="observacion-telefono" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Observación del teléfono..." rows={4}
          className="w-full rounded border border-gris-borde bg-superficie p-2 text-[13px]" />
        <Button disabled={enviando} onClick={() => enviar(() => onGuardar(texto.trim()))} className="h-auto w-full rounded bg-fila-reparado-ico py-2 text-[12px] text-superficie hover:bg-fila-reparado-ico/90">Guardar</Button>
        <DialogFooter><Button variant="outline" disabled={enviando} onClick={onCerrar}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
