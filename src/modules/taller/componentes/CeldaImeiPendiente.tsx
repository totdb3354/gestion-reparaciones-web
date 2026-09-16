import type { ReparacionResumen } from '@/shared/api/client'
import { TIPO_TRABAJO } from '@/shared/lib/tipoTrabajo'
import { cn } from '@/shared/lib/utils'
import { CLASES_MINI_PILDORA } from '@/shared/ui/pildora'
import { etiquetaGlassPendiente, etiquetaRepAbierta, tooltipGlassPendiente, tooltipRepAbierta } from '../lib/entregaGlass'

/** IMEI con la mini-píldora "Glass: X" (fila de reparación con glass sin entregar) o "Rep: X" (fila de glass con reparación abierta). */
export function CeldaImeiPendiente({ rep }: { rep: ReparacionResumen }) {
  const glassPendiente = etiquetaGlassPendiente(rep)
  const repAbierta = etiquetaRepAbierta(rep)
  return (
    <div className="flex flex-col items-start gap-px">
      <span className="text-[12px]">{rep.imei}</span>
      {glassPendiente && <span title={tooltipGlassPendiente(rep) ?? undefined} className={cn(CLASES_MINI_PILDORA, TIPO_TRABAJO.GLASS.clases)}>{glassPendiente}</span>}
      {!glassPendiente && repAbierta && <span title={tooltipRepAbierta(rep) ?? undefined} className={cn(CLASES_MINI_PILDORA, TIPO_TRABAJO.REPARACION.clases)}>{repAbierta}</span>}
    </div>
  )
}
