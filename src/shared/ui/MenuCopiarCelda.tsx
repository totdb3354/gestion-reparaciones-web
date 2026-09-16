import { ContextMenuItem } from './context-menu'
import type { CeldaPulsada } from './DataTable'
import { copiarAlPortapapeles } from './copiar'

export const TEXTO_COPIAR_CELDA = '📋  Copiar celda'

/** "📋  Copiar celda" del JavaFX: copia el texto de la columna pulsada y resalta la celda; con texto nulo o vacío
 *  (columna no copiable) no hace nada. */
export function MenuCopiarCelda({ texto, celda }: { texto: string | null | undefined; celda: CeldaPulsada }) {
  return (
    <ContextMenuItem
      onSelect={() => {
        if (!texto) return
        void copiarAlPortapapeles(texto)
        celda.resaltar()
      }}
    >
      {TEXTO_COPIAR_CELDA}
    </ContextMenuItem>
  )
}
