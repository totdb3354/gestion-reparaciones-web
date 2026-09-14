import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog'
import { Button } from './button'

type Props = {
  abierto: boolean
  titulo: string
  descripcion: string
  textoAccion: string
  textoCancelar?: string
  onConfirmar: () => void
  onCancelar: () => void
}

/** Calco de ConfirmDialog.mostrar(titulo, descripcion, textoAccion, "Cancelar", onConfirm). */
export function ConfirmDialog({ abierto, titulo, descripcion, textoAccion, textoCancelar = 'Cancelar', onConfirmar, onCancelar }: Props) {
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCancelar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancelar}>{textoCancelar}</Button>
          <Button className="bg-rojo-accion text-white hover:bg-rojo-accion/90" onClick={onConfirmar}>{textoAccion}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
