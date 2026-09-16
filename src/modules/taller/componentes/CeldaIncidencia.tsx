import type { ReparacionResumen } from '@/shared/api/client'
import { TextoExpandible } from '@/shared/ui/TextoExpandible'

/** "Sin incidencia" en cursiva gris; el texto en negro si está abierta o en gris sobre verde claro si está resuelta (clic → popup). */
export function CeldaIncidencia({ rep }: { rep: ReparacionResumen }) {
  if (!rep.esIncidencia) return <span className="text-[12px] italic text-texto-vacio">Sin incidencia</span>
  return (
    <div className={rep.esResuelto ? '-m-2 bg-fila-reparado-bg p-2' : undefined}>
      <TextoExpandible titulo="Incidencia" texto={rep.incidencia} className={rep.esResuelto ? 'text-gris-borde' : 'text-black'} />
    </div>
  )
}
