import type { ReparacionResumen } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { CLASES_PILDORA } from '@/shared/ui/pildora'
import { badgesEstado } from '../lib/estadoPendiente'

export function BadgesEstadoPendiente({ rep, hoy }: { rep: ReparacionResumen; hoy: string }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      {badgesEstado(rep, hoy).map((b) => (
        <span key={b.texto} title={b.tooltip} className="flex flex-col items-start">
          <span className={cn(CLASES_PILDORA, b.clases)}>{b.texto}</span>
          {b.sub && <span className="text-[10px] text-azul-gris">{b.sub}</span>}
        </span>
      ))}
    </div>
  )
}
