import { cn } from '@/shared/lib/utils'
import { llevaAviso, type Pedido } from './reglas'

const NEUTRO = 'bg-badge-neutro-bg text-azul-gris'
/** En camino normal, azul (0.9.9): el gris neutro del JavaFX se confundía con el de cancelado. */
const EN_CAMINO = 'bg-badge-en-camino-bg text-badge-en-camino-text'
const CLASES: Record<string, string> = {
  pendiente: 'bg-badge-pendiente-bg text-badge-pendiente-text',
  recibido: 'bg-fila-recibido-bg text-fila-recibido-brd',
  parcial: 'bg-fila-parcial-bg text-fila-parcial-brd',
  cancelado: 'bg-fila-cancelado-bg text-fila-cancelado-text',
}

function clasesBadge(p: Pedido): string {
  if (p.estado === 'en_camino') return p.esUrgente ? 'bg-fila-solicitud-bg text-fila-solicitud-brd' : EN_CAMINO
  return CLASES[p.estado] ?? NEUTRO
}

/** Chip de un estado en la cabecera de un bloque (0.9.9): los colores del badge, con «en camino» siempre azul (el
 *  aviso de urgente va aparte, en el ⚠ de la cabecera). */
export function clasesEstado(estado: string): string {
  return estado === 'en_camino' ? EN_CAMINO : CLASES[estado] ?? NEUTRO
}

/** Calco del badge de cpEstado (StockController :885-919), salvo el azul de en camino: el estado tal cual (`en_camino`
 *  con guion bajo), radio 12, padding 3 10, 11 px negrita; "⚠" de 13 px a 6 px a la derecha si es urgente y está en
 *  camino o parcial. Conserva sus colores en la fila seleccionada, como en el JavaFX. */
export function BadgeEstadoPedido({ pedido }: { pedido: Pedido }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block rounded-[12px] px-2.5 py-[3px] text-[11px] font-bold', clasesBadge(pedido))}>{pedido.estado}</span>
      {llevaAviso(pedido) && <span className="text-[13px] text-fila-solicitud-brd">⚠</span>}
    </span>
  )
}
