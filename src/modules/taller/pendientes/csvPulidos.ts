import type { ReparacionResumen } from '@/shared/api/client'
import { textoForzado } from '@/shared/lib/csv'
import { formatear } from '@/shared/lib/fechas'
import { traducirModelo } from '../lib/modelos'

/** CSV de «Mis pulidos pendientes» (ficha docs/paridad/pendientes.md): las filas visibles. Desde la 0.9.21, con «Capacidad» y
 *  «Color» de NSYS detrás de «Modelo», que sigue siendo el modelo solo. */
export const NOMBRE_CSV_PULIDOS_PENDIENTES = 'pulidos_pendientes'
export const CABECERAS_PULIDOS_PENDIENTES = ['ID', 'IMEI', 'Modelo', 'Capacidad', 'Color', 'Fecha asig.', 'Comentario']

export function filaPulidoPendiente(r: ReparacionResumen): string[] {
  return [
    r.idRep, textoForzado(r.imei), traducirModelo(r.modelo), r.capacidad ?? '', r.color ?? '',
    formatear(r.fechaAsig, 'dd/MM/yyyy HH:mm'), r.comentarioAsignacion ?? '',
  ]
}
