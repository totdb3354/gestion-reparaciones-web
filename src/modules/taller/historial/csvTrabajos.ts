import type { ReparacionResumen } from '@/shared/api/client'
import { textoForzado } from '@/shared/lib/csv'
import { formatear } from '@/shared/lib/fechas'
import { traducirModelo } from '../lib/modelos'

const FMT = 'dd/MM/yyyy HH:mm'

/** Cabeceras del CSV del Historial: el técnico exporta sin "Técnico"; supertécnico y admin con ella. */
export function cabecerasHistorial(conTecnico: boolean): string[] {
  return ['ID Reparación', 'IMEI', 'Cliente', ...(conTecnico ? ['Técnico'] : []), 'Fecha asig.', 'Fecha fin', 'Componente', 'Reutilizado', 'Observaciones', 'Incidencia', 'Resuelto', 'ID Rep. anterior']
}

export function filaHistorial(r: ReparacionResumen, conTecnico: boolean): string[] {
  return [
    r.idRep, textoForzado(r.imei), r.cliente ?? '', ...(conTecnico ? [r.nombreTecnico ?? ''] : []),
    formatear(r.fechaAsig, FMT), formatear(r.fechaFin, FMT), r.tipoComponente ?? '', r.esReutilizado ? 'Sí' : 'No',
    r.observaciones ?? '', r.esIncidencia ? (r.incidencia ?? 'Sí') : 'No', r.esResuelto ? 'Sí' : 'No', r.idRepAnterior ?? '',
  ]
}

/** CSV `historial_pulidos` con las filas visibles: «Técnico» solo para supertécnico y admin. Desde la 0.9.21, con «Capacidad» y
 *  «Color» de NSYS detrás de «Modelo», que sigue siendo el modelo solo. */
export function cabecerasHistorialPulidos(conTecnico: boolean): string[] {
  return ['ID', 'IMEI', 'Modelo', 'Capacidad', 'Color', ...(conTecnico ? ['Técnico'] : []), 'Fecha inicio', 'Fecha fin', 'Comentario']
}

export function filaHistorialPulido(r: ReparacionResumen, conTecnico: boolean): string[] {
  return [
    r.idRep, textoForzado(r.imei), traducirModelo(r.modelo), r.capacidad ?? '', r.color ?? '', ...(conTecnico ? [r.nombreTecnico ?? ''] : []),
    formatear(r.fechaAsig, FMT), formatear(r.fechaFin, FMT), r.comentarioAsignacion ?? '',
  ]
}
