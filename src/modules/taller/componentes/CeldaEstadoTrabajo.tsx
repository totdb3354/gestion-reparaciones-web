import { cn } from '@/shared/lib/utils'
import { CLASES_PILDORA } from '@/shared/ui/pildora'

/** Estado de un trabajo del historial: Incidencia (abierta) / Resuelta / Normal. */
export function CeldaEstadoTrabajo({ esIncidencia, esResuelto }: { esIncidencia: boolean; esResuelto: boolean }) {
  if (esIncidencia && !esResuelto) return <span className={cn(CLASES_PILDORA, 'bg-fila-incidencia-bg text-fila-incidencia-brd')}>Incidencia</span>
  if (esIncidencia) return <span className={cn(CLASES_PILDORA, 'bg-fila-reparado-bg text-fila-reparado-ico')}>Resuelta</span>
  return <span className={cn(CLASES_PILDORA, 'bg-badge-neutro-bg text-azul-gris')}>Normal</span>
}
