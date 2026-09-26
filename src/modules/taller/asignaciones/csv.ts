import type { ReparacionResumen } from '@/shared/api/client'
import { textoForzado } from '@/shared/lib/csv'
import { formatear } from '@/shared/lib/fechas'
import { TIPO_TRABAJO, tipoDe } from '@/shared/lib/tipoTrabajo'
import { textoCsvEntrega } from '../lib/entregaGlass'
import { traducirModelo } from '../lib/modelos'

/** Calco de ReparacionControllerSuperTecnico.exportarCSV con la tabla de asignaciones visible (hotfix 0.16.3, :1170-1186):
 *  fichero `reparaciones_pendientes`, las filas visibles tras los filtros y estas 14 columnas (spec SP6 §6.5, G7). */
export const NOMBRE_CSV_ASIGNACIONES = 'reparaciones_pendientes'

export const CABECERAS_ASIGNACIONES = [
  'ID', 'Tipo', 'Técnico', 'IMEI', 'Modelo', 'Fecha asignación', 'Comentario', 'Cliente', 'Asignado por', 'Urgente', 'Chasis',
  'Por cerrar', 'Entregado', 'En espera de pieza',
]

const siNo = (valor: boolean) => (valor ? 'Sí' : 'No')

/** Mismo criterio que CargaTecnicos.enEsperaDePieza: solicitud activa y aún no recibida (gestionada y con stock). */
function enEsperaDePieza(r: ReparacionResumen): boolean {
  return r.esSolicitud > 0 && !(r.estadoSolicitud === 'GESTIONADA' && r.stockSolicitud > 0)
}

/** Calco de filaAsignacion (hotfix 0.16.3, :1242-1266). */
export function filaAsignacionCsv(r: ReparacionResumen): string[] {
  return [
    r.idRep,
    TIPO_TRABAJO[tipoDe(r.idRep)].etiqueta,
    r.nombreTecnico ?? '',
    textoForzado(r.imei),
    traducirModelo(r.modelo),
    formatear(r.fechaAsig, 'dd/MM/yyyy HH:mm'),
    r.comentarioAsignacion ?? '',
    r.cliente ?? '',
    r.nombreTecnicoAsigna ?? '—',
    siNo(r.urgente),
    siNo(r.esChasis),
    siNo(r.porCerrar),
    textoCsvEntrega(r),
    siNo(enEsperaDePieza(r)),
  ]
}
