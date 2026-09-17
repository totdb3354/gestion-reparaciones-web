import { useLayoutEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog'
import { Button } from './button'

type Props = {
  abierto: boolean
  titulo: string
  descripcion: string
  textoAccion: string
  textoCancelar?: string
  /** Popup con textarea de motivo (borrados con justificación); el botón de acción no se habilita hasta escribir. */
  conMotivo?: boolean
  onConfirmar: (motivo?: string) => void
  onCancelar: () => void
}

/** Calco de ConfirmDialog.mostrar(titulo, descripcion, textoAccion, "Cancelar", onConfirm): contenedor de
 *  400 px, título rojo con la "✕" a la derecha (la pone DialogContent) y los dos botones apilados a ancho
 *  completo, la acción encima de Cancelar. El JavaFX no tiene hover en Cancelar, de ahí los hover: neutros. */
export function ConfirmDialog({ abierto, titulo, descripcion, textoAccion, textoCancelar = 'Cancelar', conMotivo, onConfirmar, onCancelar }: Props) {
  const cancelarRef = useRef<HTMLButtonElement>(null)
  const [motivo, setMotivo] = useState('')
  const motivoRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el motivo al reabrir
    if (abierto) setMotivo('')
  }, [abierto])
  const listo = !conMotivo || motivo.trim() !== ''
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCancelar()}>
      {/* El ancho usa min() para no comerse el margen de 2rem de DialogContent en pantallas estrechas, y el
          sm: lo repite porque si no el sm:max-w-lg que trae DialogContent (y que tailwind-merge no puede
          descartar, al no colisionar con la utilidad sin modificador) ganaría a partir de 640 px. */}
      <DialogContent
        className="max-w-[min(400px,calc(100%-2rem))] gap-2.5 p-6 sm:max-w-[min(400px,calc(100%-2rem))]"
        // La acción va primero en el DOM (es el orden visual del JavaFX), así que el autofocus de Radix
        // dejaría el foco en el botón destructivo y un Enter despistado confirmaría: lo llevamos a Cancelar.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          ;(conMotivo ? motivoRef.current : cancelarRef.current)?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-[18px] font-bold text-texto-error">{titulo}</DialogTitle>
          <DialogDescription className="text-[13px] text-azul-medio">{descripcion}</DialogDescription>
        </DialogHeader>
        {conMotivo && (
          <textarea
            ref={motivoRef}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Escribe el motivo del borrado..."
            rows={3}
            className="w-full resize-none rounded border border-fila-sep bg-superficie p-2 text-[13px] text-azul-medio"
          />
        )}
        <DialogFooter className="flex-col gap-2.5 sm:flex-col">
          {/* h-auto porque el h-9 del Button fijaría la altura y anularía el py-2.5 (padding 10 del JavaFX) */}
          <Button
            disabled={!listo}
            className="h-auto w-full rounded bg-rojo-accion py-2.5 text-[12px] text-crema hover:bg-rojo-accion/90 disabled:opacity-60"
            onClick={() => onConfirmar(conMotivo ? motivo.trim() : undefined)}
          >
            {textoAccion}
          </Button>
          {/* shadow-none: el botón del JavaFX es plano y el variant outline del Button trae sombra */}
          <Button ref={cancelarRef} variant="outline" className="h-auto w-full rounded border-azul-gris bg-crema py-2.5 text-[12px] text-azul-gris shadow-none hover:bg-crema hover:text-azul-gris" onClick={onCancelar}>{textoCancelar}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
