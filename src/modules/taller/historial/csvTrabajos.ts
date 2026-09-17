import type { ReparacionResumen } from '@/shared/api/client'
import { textoForzado } from '@/shared/lib/csv'
import { formatear } from '@/shared/lib/fechas'

const FMT = 'dd/MM/yyyy HH:mm'

/** Cabeceras del CSV del Historial: el técnico exporta sin "Técnico"; supertécnico y admin con ella. */
export function cabecerasHistorial(conTecnico: boolean): string[] {
  return ['ID Reparación', 'IMEI', ...(conTecnico ? ['Técnico'] : []), 'Fecha asig.', 'Fecha fin', 'Componente', 'Reutilizado', 'Observaciones', 'Incidencia', 'Resuelto', 'ID Rep. anterior']
}

export function filaHistorial(r: ReparacionResumen, conTecnico: boolean): string[] {
  return [
    r.idRep, textoForzado(r.imei), ...(conTecnico ? [r.nombreTecnico ?? ''] : []),
    formatear(r.fechaAsig, FMT), formatear(r.fechaFin, FMT), r.tipoComponente ?? '', r.esReutilizado ? 'Sí' : 'No',
    r.observaciones ?? '', r.esIncidencia ? (r.incidencia ?? 'Sí') : 'No', r.esResuelto ? 'Sí' : 'No', r.idRepAnterior ?? '',
  ]
}
