import { useLayoutEffect, useRef, useState } from 'react'
import { useCerrojoEnvio } from '@/shared/lib/useCerrojoEnvio'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { EJEMPLOS_MOTIVO, EXPLICA_DESCARTAR, MAX_MOTIVO, TITULO_DESCARTAR } from './porPasar'

type Props = { imeiSn: string | null; enviando: boolean; onDescartar: (motivo: string) => void; onCerrar: () => void }

/** La ventana de «descartar» de «No está en NSYS» (spec 0.9.22 pieza 3 §5.2): explica qué pasa y pide el motivo (obligatorio, hasta
 *  500). Como DialogoIncidencia: un doble clic no envía dos veces (useCerrojoEnvio); mientras guarda no se cierra y, si falla, sigue
 *  abierta con lo escrito (quien la abre la cierra cuando va bien). Abre con el foco en el motivo. */
export function DescartarAltaDialog({ imeiSn, enviando, onDescartar, onCerrar }: Props) {
  const [motivo, setMotivo] = useState('')
  const campo = useRef<HTMLTextAreaElement>(null)
  const enviar = useCerrojoEnvio({ abierto: imeiSn !== null, enviando })
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- vacía el motivo al abrir con otra fila
    if (imeiSn) setMotivo('')
  }, [imeiSn])
  const listo = motivo.trim() !== ''
  return (
    <Dialog open={imeiSn !== null} onOpenChange={(o) => { if (!o && !enviando) onCerrar() }}>
      <DialogContent className="max-w-[min(470px,calc(100%-2rem))] gap-2.5 p-5"
        onOpenAutoFocus={(e) => { e.preventDefault(); campo.current?.focus() }}>
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold text-azul-noche">{TITULO_DESCARTAR}</DialogTitle>
          <DialogDescription className="text-[12.5px] leading-snug text-azul-medio">
            <b className="font-mono">{imeiSn}</b>{` ${EXPLICA_DESCARTAR}`}
          </DialogDescription>
        </DialogHeader>
        <Label htmlFor="descartar-motivo" className="text-[12px] font-bold">Motivo (obligatorio)</Label>
        <textarea id="descartar-motivo" ref={campo} value={motivo} maxLength={MAX_MOTIVO} rows={3}
          placeholder="Por qué no va a NSYS" onChange={(e) => setMotivo(e.target.value)}
          className="w-full resize-y rounded border border-borde-input bg-superficie p-2 text-[13px] text-azul-medio" />
        <p className="text-[11px] text-azul-gris">{EJEMPLOS_MOTIVO}</p>
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={enviando} onClick={onCerrar}>Cancelar</Button>
          <Button disabled={!listo || enviando} onClick={() => enviar(() => onDescartar(motivo.trim()))}
            className="bg-rojo-accion text-crema hover:bg-rojo-accion/90">Descartar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
