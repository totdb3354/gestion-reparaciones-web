import { useLayoutEffect, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/shared/ui/dialog'

type Props = { abierto: boolean; inicial: string; onGuardar: (descripcion: string) => void; onCancelarSolicitud: () => void; onCancelar: () => void }

/** Diálogo "Editar descripción de solicitud" (440 px) de una solicitud LOCAL aún sin enviar. No tiene cabecera visible: el título
 *  va en sr-only para que el diálogo tenga nombre accesible. Tres botones, en este orden: "Guardar descripción" (ámbar),
 *  "Cancelar solicitud" (rojo) y "Cancelar" (cierra sin cambios). */
export function DialogoDescripcionSolicitud({ abierto, inicial, onGuardar, onCancelarSolicitud, onCancelar }: Props) {
  const [texto, setTexto] = useState(inicial)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga la descripción actual cada vez que se abre
    if (abierto) setTexto(inicial)
  }, [abierto, inicial])
  const claseBoton = 'h-auto w-full rounded py-2 text-[12px] text-superficie'
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCancelar()}>
      <DialogContent aria-describedby={undefined} showCloseButton={false} className="max-w-[min(440px,calc(100%-2rem))] gap-2 bg-fondo-input p-4 sm:max-w-[min(440px,calc(100%-2rem))]">
        <DialogTitle className="sr-only">Editar descripción de solicitud</DialogTitle>
        <textarea
          aria-label="Descripción de la pieza"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Describe la pieza que necesitas (opcional)..."
          rows={4}
          className="w-full resize-none rounded border border-gris-borde bg-superficie p-2 text-[13px]"
        />
        <Button onClick={() => onGuardar(texto.trim())} className={`${claseBoton} bg-ambar hover:bg-ambar/90`}>Guardar descripción</Button>
        <Button onClick={onCancelarSolicitud} className={`${claseBoton} bg-rojo-cancelar hover:bg-rojo-cancelar/90`}>Cancelar solicitud</Button>
        <DialogFooter>
          <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
