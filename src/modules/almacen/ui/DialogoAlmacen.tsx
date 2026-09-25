import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { BotonPrimario, BotonSecundario } from '@/shared/ui/Botones'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'

type Props = {
  abierto: boolean
  titulo: string
  subtitulo?: string
  error: string | null
  textoAccion: string
  enviando?: boolean
  /** 360 (por defecto): ventanas de StockController, título de 20 px. 520: editores de pedido
   *  (FormularioCompraEditar.fxml, FormularioOtroPedidoEditar.fxml), título `vista-titulo` de 24 px. */
  ancho?: 360 | 520
  onConfirmar: () => void
  onCancelar: () => void
  children: ReactNode
}

const ESTILO_ANCHO: Record<360 | 520, { caja: string; titulo: string }> = {
  360: { caja: 'w-[360px] max-w-[min(360px,calc(100%-2rem))] sm:max-w-[min(360px,calc(100%-2rem))]', titulo: 'text-[20px]' },
  520: { caja: 'w-[520px] max-w-[min(520px,calc(100%-2rem))] sm:max-w-[min(520px,calc(100%-2rem))]', titulo: 'text-2xl' },
}

/** Calco de las ventanas propias de StockController (editarStock, solicitarPieza, editarProveedor): VBox de 360 px con
 *  padding 28 y fondo #DDE1E7, título de 20 px, subtítulo de 12 px gris, campos, error de 11 px rojo y los botones
 *  "Cancelar" (btn-secondary) y la acción (btn-primary) a la derecha. Los TextInputDialog nativos del JavaFX ("Stock
 *  mínimo", "Nuevo proveedor") también pasan por aquí (spec 4a, S5). Enter confirma porque los campos van en un form.
 *  Con `ancho={520}` sirve a los editores de pedido (spec 4b §6). */
export function DialogoAlmacen({ abierto, titulo, subtitulo, error, textoAccion, enviando = false, ancho = 360, onConfirmar, onCancelar, children }: Props) {
  const estilo = ESTILO_ANCHO[ancho]
  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o && !enviando) onCancelar() }}>
      <DialogContent {...(subtitulo ? {} : { 'aria-describedby': undefined })} className={cn(estilo.caja, 'gap-3 bg-fondo-vista p-7')}>
        <form onSubmit={(e) => { e.preventDefault(); if (!enviando) onConfirmar() }} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle className={cn(estilo.titulo, 'font-bold text-azul-medio')}>{titulo}</DialogTitle>
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
