import { useLayoutEffect, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'

type Props = { abierto: boolean; tipo: string; inicial: string; onGuardar: (texto: string) => void; onCancelar: () => void }

/** Diálogo "Observación" de una fila (440 px): cabecera "Observación para: <tipo>", área de 5 líneas precargada, "Guardar" verde
 *  a ancho completo y "Cancelar". Entrega el texto tal cual: recortar, y no cambiar nada si queda vacío, es regla del reductor
 *  (PONER_OBSERVACION). El ancho repite el sm: por el sm:max-w-lg de DialogContent (mismo truco que ConfirmDialog). */
export function DialogoObservacionFila({ abierto, tipo, inicial, onGuardar, onCancelar }: Props) {
  const [texto, setTexto] = useState(inicial)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga la observación actual cada vez que se abre
    if (abierto) setTexto(inicial)
  }, [abierto, inicial])
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCancelar()}>
      <DialogContent aria-describedby={undefined} className="max-w-[min(440px,calc(100%-2rem))] gap-2 bg-fondo-input p-4 sm:max-w-[min(440px,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-bold text-azul-medio">{`Observación para: ${tipo}`}</DialogTitle>
        </DialogHeader>
        <textarea
          aria-label="Observación"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={5}
          className="w-full resize-none rounded border border-gris-borde bg-superficie p-2 text-[13px] whitespace-pre-wrap"
        />
        <Button onClick={() => onGuardar(texto)} className="h-auto w-full rounded bg-fila-reparado-ico py-2 text-[12px] text-superficie hover:bg-fila-reparado-ico/90">
          Guardar
        </Button>
        <DialogFooter>
          <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
