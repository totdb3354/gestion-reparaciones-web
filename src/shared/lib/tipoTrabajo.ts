/** Calco de TipoTrabajo: los tres tipos comparten la tabla Reparacion y se distinguen por el prefijo del ID
 *  (asignaciones A/AG/AP, historial R/G/P). */
export type TipoTrabajo = 'REPARACION' | 'GLASS' | 'PULIDO'

export const TIPO_TRABAJO: Record<TipoTrabajo, { etiqueta: string; clases: string }> = {
  REPARACION: { etiqueta: 'Reparación', clases: 'bg-tipo-reparacion-bg text-tipo-reparacion-text' },
  GLASS: { etiqueta: 'Glass', clases: 'bg-tipo-glass-bg text-tipo-glass-text' },
  PULIDO: { etiqueta: 'Pulido', clases: 'bg-tipo-pulido-bg text-tipo-pulido-text' },
}

export function tipoDe(idRep: string | null | undefined): TipoTrabajo {
  if (!idRep) return 'REPARACION'
  if (idRep.startsWith('AG') || idRep.startsWith('G')) return 'GLASS'
  if (idRep.startsWith('AP') || idRep.startsWith('P')) return 'PULIDO'
  return 'REPARACION'
}
