import type { ReparacionResumen } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { CLASES_PILDORA } from '@/shared/ui/pildora'
import { badgesEstado } from '../lib/estadoPendiente'

export function BadgesEstadoPendiente({ rep, hoy }: { rep: ReparacionResumen; hoy: string }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      {badgesEstado(rep, hoy).map((b) => (
        // max-w-full: la sub-etiqueta (los tipos de la solicitud) se corta con "…" dentro del ancho de la celda, como su Label.
        <span key={b.texto} title={b.tooltip} className="flex max-w-full flex-col items-start">
          <span className={cn(CLASES_PILDORA, b.clases)}>{b.texto}</span>
          {b.sub && <span className="max-w-full truncate text-[10px] text-azul-gris">{b.sub}</span>}
        </span>
      ))}
    </div>
  )
}
