import type { ReparacionResumen } from '@/shared/api/client'
import { SIN_CLIENTE, pasaCliente, pasaImeis, pasaTecnico, pasaTipo, type TipoPendiente } from '../lib/filtros'
import { imeisValidos } from '@/shared/lib/filtroImei'
import { tipoDe, type TipoTrabajo } from '@/shared/lib/tipoTrabajo'

// Re-exportado por comodidad de los consumidores (Tasks 6-9); la definición sigue viviendo en lib/filtros.
export { SIN_CLIENTE }

// Re-exportadas por comodidad de los consumidores (Task 6 importa tipoDe desde aquí); la definición
// sigue viviendo en shared/lib/tipoTrabajo (ya en producción en Historial y en el detalle de IMEIs).
export { tipoDe, type TipoTrabajo }

export type EstadoAsignacion = 'SOLICITUD' | 'INCIDENCIA' | 'ASIGNACION'

export type EstadoFiltros = {
  imei: string
  tecnicos: number[]
  clientes: string[]
  tipos: TipoTrabajo[]
  estados: EstadoAsignacion[]
}

export const FILTROS_VACIOS: EstadoFiltros = { imei: '', tecnicos: [], clientes: [], tipos: [], estados: [] }

// Traduce EstadoAsignacion (API pública de este módulo, en mayúsculas) a TipoPendiente
// (el vocabulario de pasaTipo en lib/filtros, en minúsculas). 'ASIGNACION' no tiene
// equivalente en marcados: pasaTipo ya la trata como "ni solicitud ni incidencia".
const A_TIPO_PENDIENTE: Record<Exclude<EstadoAsignacion, 'ASIGNACION'>, TipoPendiente> = {
  SOLICITUD: 'solicitud',
  INCIDENCIA: 'incidencia',
}

function marcadosPendiente(estados: EstadoAsignacion[]): Set<TipoPendiente> {
  const marcados = new Set<TipoPendiente>()
  for (const e of estados) {
    if (e === 'ASIGNACION') marcados.add('asignacion')
    else marcados.add(A_TIPO_PENDIENTE[e])
  }
  return marcados
}

/**
 * Aplica los cinco filtros en memoria (spec 3a §9). Dentro de cada grupo los valores se
 * combinan con O; entre grupos, con Y. Un grupo vacío NO filtra.
 *
 * Compone los helpers puros de lib/filtros.ts (ya en producción en Pendientes del técnico) y
 * el multi-IMEI de shared/lib/filtroImei.ts, en vez de reimplementarlos.
 */
export function aplicarFiltros(filas: ReparacionResumen[], f: EstadoFiltros): ReparacionResumen[] {
  const imeis = imeisValidos(f.imei)
  const tecnicos = new Set(f.tecnicos)
  const clientes = new Set(f.clientes)
  const tipos = new Set(f.tipos)
  const estados = marcadosPendiente(f.estados)

  return filas.filter(
    (r) =>
      pasaImeis(r.imei ?? '', imeis) &&
      pasaTecnico(r.idTec, tecnicos) &&
      pasaCliente(r.cliente, clientes) &&
      (tipos.size === 0 || tipos.has(tipoDe(r.idRep))) &&
      pasaTipo(r, estados),
  )
}
