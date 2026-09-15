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

/** Calco de ConfirmDialog.mostrar(titulo, descripcion, textoAccion, "Cancelar", onConfirm): contenedor de
 *  400 px, título rojo con la "✕" a la derecha (la pone DialogContent) y los dos botones apilados a ancho
 *  completo, la acción encima de Cancelar. El JavaFX no tiene hover en Cancelar, de ahí los hover: neutros. */
export function ConfirmDialog({ abierto, titulo, descripcion, textoAccion, textoCancelar = 'Cancelar', onConfirmar, onCancelar }: Props) {
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCancelar()}>
      {/* el sm: repite el ancho porque DialogContent trae un sm:max-w-lg que si no gana a partir de 640 px */}
      <DialogContent className="max-w-[400px] gap-2.5 p-6 sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-bold text-texto-error">{titulo}</DialogTitle>
          <DialogDescription className="text-[13px] text-azul-medio">{descripcion}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2.5 sm:flex-col">
          <Button className="w-full rounded bg-rojo-accion py-2.5 text-[12px] text-crema hover:bg-rojo-accion/90" onClick={onConfirmar}>{textoAccion}</Button>
          <Button variant="outline" className="w-full rounded border-azul-gris bg-crema py-2.5 text-[12px] text-azul-gris hover:bg-crema hover:text-azul-gris" onClick={onCancelar}>{textoCancelar}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
