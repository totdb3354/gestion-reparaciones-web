import { cn } from '@/shared/lib/utils'
import { useContadoresPendientes } from '../api'
import { textoBadgeLateral } from '../lib/filtros'

/** Calco de .sidebar-badge: suma rep + glass + pulidos, tope 99+, oculto a cero; blanco sobre el enlace activo, navy en los demás. */
export function BadgePendientes({ activo }: { activo: boolean }) {
  const { data } = useContadoresPendientes()
  const texto = data ? textoBadgeLateral(data.reparaciones + data.glass + data.pulidos) : null
  if (!texto) return null
  return (
    <span className={cn('ml-2 inline-block min-w-[14px] rounded-lg px-[5px] py-px text-center text-[9px] font-bold', activo ? 'bg-superficie text-azul-noche' : 'bg-azul-noche text-superficie')}>
      {texto}
    </span>
  )
}
