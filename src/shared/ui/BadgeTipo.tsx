import { TIPO_TRABAJO, tipoDe } from '@/shared/lib/tipoTrabajo'
import { cn } from '@/shared/lib/utils'
import { CLASES_PILDORA } from './pildora'

/** Calco de TipoTrabajo.celdaTipoConChasis: píldora del tipo y "Chasis" debajo solo en reparaciones con chasis. */
export function BadgeTipo({ idRep, esChasis = false }: { idRep: string; esChasis?: boolean }) {
  const tipo = tipoDe(idRep)
  return (
    <div className="flex flex-col items-start gap-px">
      <span className={cn(CLASES_PILDORA, TIPO_TRABAJO[tipo].clases)}>{TIPO_TRABAJO[tipo].etiqueta}</span>
      {esChasis && tipo === 'REPARACION' && <span className="text-[10px] text-texto-sub">Chasis</span>}
    </div>
  )
}
