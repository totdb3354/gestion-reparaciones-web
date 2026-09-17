import { cn } from '@/shared/lib/utils'
import { useAlerta } from './AlertaProvider'

type Props = { titulo: string; texto: string | null | undefined; className?: string }

/** Calco de labelExpandible: texto con elipsis y cursor de mano; el clic abre el popup de ConfirmDialog.mostrarTexto
 *  (título, texto completo de solo lectura y "Copiar", que copia y cierra), que pinta AlertaProvider fuera de la tabla
 *  (ver allí por qué). Sin texto no pinta nada. */
export function TextoExpandible({ titulo, texto, className }: Props) {
  const { mostrarTexto } = useAlerta()
  if (!texto) return null
  return (
    <button type="button" onClick={() => mostrarTexto(titulo, texto)} className={cn('block w-full cursor-pointer truncate text-left', className)}>
      {texto}
    </button>
  )
}
