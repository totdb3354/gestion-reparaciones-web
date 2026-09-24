import type { EstadoStock } from '@/shared/lib/semaforoStock'
import { cn } from '@/shared/lib/utils'

const CLASES_BADGE: Record<EstadoStock, string> = {
  OK: 'bg-badge-neutro-bg text-azul-gris',
  Bajo: 'bg-fila-solicitud-bg text-fila-solicitud-brd',
  'Sin stock': 'bg-badge-sin-stock-bg text-rojo-sin-stock',
  Desactivado: 'bg-fila-cancelado-bg text-fila-cancelado-text',
}

/** Calco del badge de colEstado (:335-351): radio 10, padding 2 10, 11 px negrita. Conserva su color en la fila azul. */
export function BadgeEstadoStock({ estado }: { estado: EstadoStock }) {
  return <span className={cn('inline-block rounded-[10px] px-2.5 py-0.5 text-[11px] font-bold', CLASES_BADGE[estado])}>{estado}</span>
}
