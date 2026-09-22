import { cn } from '@/shared/lib/utils'
import { textoBadgeLateral } from '../lib/filtros'

/** Calco de .sidebar-badge y del setBadge del JavaFX: oculto a cero (o sin dato), tope 99+; blanco sobre el enlace
 *  activo, navy en los demás. Lo comparten los badges de Pendientes y de Asignaciones; cada uno pone su total. */
export function BadgeLateral({ total, activo }: { total: number | undefined; activo: boolean }) {
  const texto = total === undefined ? null : textoBadgeLateral(total)
  if (!texto) return null
  return (
    <span className={cn('ml-2 inline-block min-w-[14px] rounded-lg px-[5px] py-px text-center text-[9px] font-bold', activo ? 'bg-superficie text-azul-noche' : 'bg-azul-noche text-superficie')}>
      {texto}
    </span>
  )
}
