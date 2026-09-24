import type { ReactNode } from 'react'
import { BotonPrimario, BotonSecundario } from '@/shared/ui/Botones'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'

type Props = {
  abierto: boolean
  titulo: string
  subtitulo?: string
  error: string | null
  textoAccion: string
  enviando?: boolean
  onConfirmar: () => void
  onCancelar: () => void
  children: ReactNode
}

/** Calco de las ventanas propias de StockController (editarStock, solicitarPieza, editarProveedor): VBox de 360 px con
 *  padding 28 y fondo #DDE1E7, título de 20 px, subtítulo de 12 px gris, campos, error de 11 px rojo y los botones
 *  "Cancelar" (btn-secondary) y la acción (btn-primary) a la derecha. Los TextInputDialog nativos del JavaFX ("Stock
 *  mínimo", "Nuevo proveedor") también pasan por aquí (spec 4a, S5). Enter confirma porque los campos van en un form. */
export function DialogoAlmacen({ abierto, titulo, subtitulo, error, textoAccion, enviando = false, onConfirmar, onCancelar, children }: Props) {
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCancelar()}>
      <DialogContent {...(subtitulo ? {} : { 'aria-describedby': undefined })} className="w-[360px] max-w-[min(360px,calc(100%-2rem))] gap-3 bg-fondo-vista p-7 sm:max-w-[min(360px,calc(100%-2rem))]">
        <form onSubmit={(e) => { e.preventDefault(); if (!enviando) onConfirmar() }} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle className="text-[20px] font-bold text-azul-medio">{titulo}</DialogTitle>
            {subtitulo ? <DialogDescription className="whitespace-pre text-[12px] text-azul-gris">{subtitulo}</DialogDescription> : null}
          </DialogHeader>
          {children}
          {error !== null && <p role="alert" className="text-[11px] text-texto-error">{error}</p>}
          <DialogFooter className="flex-row justify-end gap-2.5 sm:flex-row sm:justify-end">
            <BotonSecundario type="button" disabled={enviando} onClick={onCancelar}>Cancelar</BotonSecundario>
            <BotonPrimario type="submit" disabled={enviando}>{textoAccion}</BotonPrimario>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
