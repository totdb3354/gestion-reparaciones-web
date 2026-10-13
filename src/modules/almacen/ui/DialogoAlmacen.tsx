import type { ReactNode } from 'react'
import { useCerrojoEnvio } from '@/shared/lib/useCerrojoEnvio'
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
  /** Desactiva el botón de acción (p. ej. pesos que no suman 100); Enter tampoco confirma porque onConfirmar valida. */
  accionDeshabilitada?: boolean
  /** 0.9.9: acción destructiva (cancelar o borrar un bloque): botón en rojo. */
  peligro?: boolean
  /** 360 (por defecto): ventanas de StockController, título de 20 px. 520: editores de pedido
   *  (FormularioCompraEditar.fxml, FormularioOtroPedidoEditar.fxml), título `vista-titulo` de 24 px. 640: listas largas («Piezas que vende…», un renglón por tipo),
   *  mismo título de 24 px. */
  ancho?: 360 | 520 | 640
  onConfirmar: () => void
  onCancelar: () => void
  children: ReactNode
}

const ESTILO_ANCHO: Record<360 | 520 | 640, { caja: string; titulo: string }> = {
  360: { caja: 'w-[360px] max-w-[min(360px,calc(100%-2rem))]', titulo: 'text-[20px]' },
  520: { caja: 'w-[520px] max-w-[min(520px,calc(100%-2rem))]', titulo: 'text-2xl' },
  640: { caja: 'w-[640px] max-w-[min(640px,calc(100%-2rem))]', titulo: 'text-2xl' },
}

/** Calco de las ventanas propias de StockController (editarStock, solicitarPieza, editarProveedor): VBox de 360 px con
 *  padding 28 y fondo #DDE1E7, título de 20 px, subtítulo de 12 px gris, campos, error de 11 px rojo y los botones
 *  "Cancelar" (btn-secondary) y la acción (btn-primary) a la derecha. Los TextInputDialog nativos del JavaFX ("Stock
 *  mínimo", "Nuevo proveedor") también pasan por aquí (spec 4a, S5). Enter confirma porque los campos van en un form.
 *  Con `ancho={520}` sirve a los editores de pedido (spec 4b §6). El envío pasa por un cerrojo síncrono (useCerrojoEnvio):
 *  un doble clic no llama dos veces a `onConfirmar`. */
export function DialogoAlmacen({ abierto, titulo, subtitulo, error, textoAccion, enviando = false, accionDeshabilitada = false, peligro = false, ancho = 360, onConfirmar, onCancelar, children }: Props) {
  const estilo = ESTILO_ANCHO[ancho]
  const enviar = useCerrojoEnvio({ abierto, enviando, error })
  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o && !enviando) onCancelar() }}>
      <DialogContent {...(subtitulo ? {} : { 'aria-describedby': undefined })} className={cn(estilo.caja, 'gap-3 bg-fondo-vista p-7')}>
        {/* min-w-0: DialogContent es una rejilla y, sin esto, un texto que no se parte (p. ej. «Sin …» de «Piezas que
            vende…») ensancha la columna por encima del ancho de la caja y el contenido se sale por la derecha. */}
        <form onSubmit={(e) => { e.preventDefault(); enviar(onConfirmar) }} className="flex min-w-0 flex-col gap-3">
          <DialogHeader>
            <DialogTitle className={cn(estilo.titulo, 'font-bold text-azul-medio')}>{titulo}</DialogTitle>
            {subtitulo ? <DialogDescription className="whitespace-pre-wrap text-[12px] text-azul-gris">{subtitulo}</DialogDescription> : null}
          </DialogHeader>
          {children}
          {error !== null && <p role="alert" className="text-[11px] text-texto-error">{error}</p>}
          <DialogFooter className="flex-row justify-end gap-2.5 sm:flex-row sm:justify-end">
            <BotonSecundario type="button" disabled={enviando} onClick={onCancelar}>Cancelar</BotonSecundario>
            <BotonPrimario type="submit" disabled={enviando || accionDeshabilitada} className={peligro ? 'bg-rojo-accion hover:bg-rojo-accion/90' : undefined}>{textoAccion}</BotonPrimario>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
