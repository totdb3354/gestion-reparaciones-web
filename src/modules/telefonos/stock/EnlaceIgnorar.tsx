import { cn } from '@/shared/lib/utils'
import { TITULO_IGNORAR } from './porPasar'

/** El enlace «ignorar» de las filas ámbar de Color, Grado y Revisar (0.9.27 §5.1). */
export function EnlaceIgnorar({ imeiSn, ocupado, onIgnorar, className }: { imeiSn: string; ocupado: boolean; onIgnorar: () => void; className?: string }) {
  return (
    <button type="button" disabled={ocupado} aria-label={`Ignorar ${imeiSn}`} title={TITULO_IGNORAR} onClick={onIgnorar}
      className={cn('cursor-pointer text-[11px] text-texto-suave hover:text-fila-urgente-brd disabled:cursor-not-allowed disabled:opacity-40', className)}>
      ignorar
    </button>
  )
}
