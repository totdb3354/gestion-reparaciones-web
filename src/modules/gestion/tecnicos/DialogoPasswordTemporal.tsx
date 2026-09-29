import { Button } from '@/shared/ui/button'
import { copiarAlPortapapeles } from '@/shared/ui/copiar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { TITULO_PASSWORD_ENTREGADA, textoPasswordEntregada } from './textos'

type Props = {
  /** Contraseña entregada por el servidor, o null con el diálogo cerrado. Vive solo aquí, en memoria, hasta cerrar. */
  password: string | null
  nombreTecnico: string
  onCerrar: () => void
}

/**
 * Entrega de una contraseña temporal (spec sp7b §5.4): se muestra una sola vez, con un botón para copiarla. Al cerrar, la
 * página la olvida y no queda en ninguna parte: ni en el almacenamiento del navegador, ni en la caché de consultas, ni en
 * la tabla. Para volver a tenerla hay que entregar otra.
 */
export function DialogoPasswordTemporal({ password, nombreTecnico, onCerrar }: Props) {
  return (
    <Dialog open={password !== null} onOpenChange={(o) => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-[min(420px,calc(100%-2rem))] gap-2.5 bg-crema p-5">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-bold text-azul-medio">{TITULO_PASSWORD_ENTREGADA}</DialogTitle>
          <DialogDescription className="whitespace-pre-line text-[12px] text-azul-gris">{textoPasswordEntregada(nombreTecnico)}</DialogDescription>
        </DialogHeader>
        {/* De solo lectura y seleccionable, como el popup de texto expandible: se copia con el botón o a mano. */}
        <input
          readOnly
          value={password ?? ''}
          aria-label="Contraseña temporal"
          className="w-full rounded border border-fila-sep bg-superficie p-2 text-center font-mono text-[15px] tracking-wider text-azul-medio"
        />
        <Button
          className="h-auto w-full rounded bg-azul-medio py-2 text-[12px] text-crema hover:bg-azul-medio/90"
          onClick={() => { void copiarAlPortapapeles(password ?? '') }}
        >
          Copiar
        </Button>
      </DialogContent>
    </Dialog>
  )
}
