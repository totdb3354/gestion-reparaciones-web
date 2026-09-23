import { cn } from '@/shared/lib/utils'
import type { Mensaje } from './estado/tipos'

export function MensajeEscaneo({ mensaje }: { mensaje: Mensaje | null }) {
  return (
    <p role="status" className={cn('min-h-[15px] text-[11px]', mensaje?.tono === 'ok' ? 'text-recibido-text' : 'text-texto-error')}>
      {mensaje?.texto ?? ''}
    </p>
  )
}
