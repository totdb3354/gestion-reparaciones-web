import { cn } from '@/shared/lib/utils'
import type { Reparto } from './modelo'

/** Barra listos / taller / revisión (verde, azul y ámbar, los colores del rastro). Cada trozo, a proporción. */
export function BarraReparto({ reparto, className }: { reparto: Reparto; className?: string }) {
  return (
    <span aria-hidden className={cn('flex overflow-hidden bg-pill-bg', className)}>
      <i className="block h-full bg-fila-recibido-brd" style={{ flexGrow: reparto.listos }} />
      <i className="block h-full bg-tipo-reparacion-text" style={{ flexGrow: reparto.taller }} />
      <i className="block h-full bg-ambar" style={{ flexGrow: reparto.revision }} />
    </span>
  )
}
