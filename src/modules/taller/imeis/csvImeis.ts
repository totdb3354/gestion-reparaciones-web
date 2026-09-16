import type { ReparacionResumen } from '@/shared/api/client'
import { textoForzado } from '@/shared/lib/csv'
import { formatear } from '@/shared/lib/fechas'
import { tipoDe } from '@/shared/lib/tipoTrabajo'
import type { GrupoImei } from '../lib/grupoImei'
import { traducirModelo } from '../lib/modelos'

/** CSV del maestro (agrupado_resumen), sin "Revisión logística" (diferencia aceptada). */
export const CABECERAS_RESUMEN = ['IMEI', 'Modelo', 'Primera', 'Última', 'Reparaciones', 'Glass', 'Pulidos', 'Inc. abiertas', 'Observación', 'Cliente']
export function filaResumen(g: GrupoImei): string[] {
  return [
    textoForzado(g.imei), traducirModelo(g.modelo), formatear(g.fechaMasAntigua, 'dd/MM/yyyy'), formatear(g.fechaMasReciente, 'dd/MM/yyyy'),
    String(g.countRep), String(g.countGlass), String(g.countPul), String(g.incAbiertas), g.observacion ?? '', g.cliente ?? '',
  ]
}

/** CSV del detalle (agrupado_<imei>): recorrido cronológico del IMEI con columna Tipo; "ID Rep. anterior" vacío en pulidos. */
export const CABECERAS_DETALLE = ['Tipo', 'ID', 'IMEI', 'Técnico', 'Fecha asig.', 'Fecha fin', 'Componente', 'Reutilizado', 'Observaciones', 'Incidencia', 'Resuelto', 'ID Rep. anterior']
export function filaDetalle(r: ReparacionResumen): string[] {
  const tipo = tipoDe(r.idRep)
  const etiqueta = tipo === 'GLASS' ? 'Glass' : tipo === 'PULIDO' ? 'Pulido' : 'Reparación'
  return [
    etiqueta, r.idRep, textoForzado(r.imei), r.nombreTecnico ?? '', formatear(r.fechaAsig, 'dd/MM/yyyy HH:mm'), formatear(r.fechaFin, 'dd/MM/yyyy HH:mm'),
    r.tipoComponente ?? '', r.esReutilizado ? 'Sí' : 'No', r.observaciones ?? '', r.esIncidencia ? (r.incidencia ?? 'Sí') : 'No', r.esResuelto ? 'Sí' : 'No',
    tipo === 'PULIDO' ? '' : (r.idRepAnterior ?? ''),
  ]
}
