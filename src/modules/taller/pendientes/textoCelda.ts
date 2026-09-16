import type { ReparacionResumen } from '@/shared/api/client'
import { formatear } from '@/shared/lib/fechas'
import { traducirModelo } from '../lib/modelos'

export const FMT_PENDIENTES = 'yyyy/MM/dd HH:mm' as const

/** Texto de "Copiar celda" por columna (calco de textoDeCelda); null = columna no copiable. */
export function textoCeldaPendiente(rep: ReparacionResumen, columna: string): string | null {
  switch (columna) {
    case 'id': return rep.idRep
    case 'imei': return rep.imei
    case 'modelo': return traducirModelo(rep.modelo)
    case 'fecha': return formatear(rep.fechaAsig, FMT_PENDIENTES)
    case 'comentario': return rep.comentarioAsignacion ?? ''
    default: return null
  }
}
