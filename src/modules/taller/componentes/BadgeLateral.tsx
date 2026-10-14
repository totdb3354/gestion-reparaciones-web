import { cn } from '@/shared/lib/utils'
import { textoBadgeLateral } from '../lib/filtros'

/** Calco de .sidebar-badge y del setBadge del JavaFX: oculto a cero (o sin dato), tope 99+; blanco sobre el enlace
 *  activo, navy en los demás. Lo comparten los badges de Pendientes y de Asignaciones; cada uno pone su total.
 *  `compacto` (0.9.10, columna plegada): más pequeño y en la esquina superior derecha del icono, con los mismos colores. */
export function BadgeLateral({ total, activo, compacto = false }: { total: number | undefined; activo: boolean; compacto?: boolean }) {
  const texto = total === undefined ? null : textoBadgeLateral(total)
  if (!texto) return null
  return (
    <span
      className={cn(
        'inline-block rounded-lg text-center font-bold',
        compacto ? 'absolute top-px right-[3px] min-w-[13px] px-1 text-[8.5px]' : 'ml-2 min-w-[14px] px-[5px] py-px text-[9px]',
        activo ? 'bg-superficie text-azul-noche' : 'bg-azul-noche text-superficie',
      )}
    >
      {texto}
    </span>
  )
}
