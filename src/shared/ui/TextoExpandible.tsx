import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { Button } from './button'
import { copiarAlPortapapeles } from './copiar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'

type Props = { titulo: string; texto: string | null | undefined; className?: string }

/** Calco de labelExpandible + ConfirmDialog.mostrarTexto: texto con elipsis y cursor de mano; el clic abre el popup
 *  con el título, el texto completo de solo lectura y "Copiar" (copia y cierra). Sin texto no pinta nada. */
export function TextoExpandible({ titulo, texto, className }: Props) {
  const [abierto, setAbierto] = useState(false)
  if (!texto) return null
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={cn('block w-full cursor-pointer truncate text-left', className)}>
        {texto}
      </button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent aria-describedby={undefined} className="max-w-[420px] gap-2.5 bg-crema p-5">
          <DialogHeader>
            <DialogTitle className="text-[14px] font-bold text-azul-medio">{titulo}</DialogTitle>
          </DialogHeader>
          <textarea readOnly value={texto} rows={6} className="w-full resize-none rounded border border-fila-sep bg-superficie p-2 text-[13px] text-azul-medio" />
          <Button
            className="h-auto w-full rounded bg-azul-medio py-2 text-[12px] text-crema hover:bg-azul-medio/90"
            onClick={() => {
              void copiarAlPortapapeles(texto)
              setAbierto(false)
            }}
          >
            Copiar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
