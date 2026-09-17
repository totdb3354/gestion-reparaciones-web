import type { ReparacionResumen } from '@/shared/api/client'
import { imeisValidos } from '@/shared/lib/filtroImei'
import type { FiltrosImeis } from '../estado'
import { SIN_CLIENTE, pasaCliente, pasaFechas, pasaImeis, pasaIncidencias, pasaTecnico, type EstadoIncidencia } from '../lib/filtros'
import { agruparPorImei, ordenarPorActividad, type GrupoImei } from '../lib/grupoImei'

/** Maestro: "Incidencia" = alguna abierta, "Normal" = ninguna. "cerradas" solo existe en el detalle y aquí no cuenta. */
export function pasaIncidenciasGrupo(g: GrupoImei, marcados: Set<EstadoIncidencia>): boolean {
  const incidencia = marcados.has('abiertas')
  const normal = marcados.has('sin')
  if (!incidencia && !normal) return true
  return (incidencia && g.incAbiertas > 0) || (normal && g.incAbiertas === 0)
}

/** Calco de AgrupadoController.cargar(): IMEI, fechas y cliente filtran los trabajos antes de agrupar; un grupo se
 *  muestra si ALGUNO de sus trabajos pasa el filtro de técnico (y conserva todos sus trabajos); orden por actividad. */
export function agruparVisibles(trabajos: ReparacionResumen[], f: FiltrosImeis): GrupoImei[] {
  const imeis = imeisValidos(f.imei)
  const previos = trabajos.filter((t) => pasaImeis(t.imei, imeis) && pasaFechas(t, f.desde, f.hasta) && pasaCliente(t.cliente, f.clientes))
  const grupos = agruparPorImei(previos).filter((g) => g.trabajos.some((t) => pasaTecnico(t.idTec, f.tecnicos)) && pasaIncidenciasGrupo(g, f.incidencias))
  return ordenarPorActividad(grupos)
}

/** Clientes presentes en los trabajos cargados, alfabéticos, con "(Sin cliente)" delante si hay trabajos sin cliente. */
export function opcionesCliente(trabajos: ReparacionResumen[]): string[] {
  const nombres = new Set<string>()
  let sinCliente = false
  for (const t of trabajos) {
    if (t.cliente) nombres.add(t.cliente)
    else sinCliente = true
  }
  const lista = [...nombres].sort((a, b) => a.localeCompare(b, 'es'))
  return sinCliente ? [SIN_CLIENTE, ...lista] : lista
}

export type FilasDetalle = { filas: ReparacionResumen[]; deFiltrados: number; deOtros: number }

/** ISO del servidor: el orden lexicográfico es el cronológico. */
function porAsignacion(a: ReparacionResumen, b: ReparacionResumen): number {
  return a.fechaAsig === b.fechaAsig ? 0 : a.fechaAsig < b.fechaAsig ? -1 : 1
}

/** Ajeno al filtro de técnico (la vista lo atenúa); sin filtro nadie es ajeno. */
export function esAjeno(t: ReparacionResumen, f: FiltrosImeis): boolean {
  return f.tecnicos.size > 0 && !pasaTecnico(t.idTec, f.tecnicos)
}

/** Detalle: trabajos del IMEI que pasan fechas e incidencias, por fecha de asignación ascendente;
 *  con filtro de técnico, primero los de los marcados y después los ajenos. */
export function filasDetalle(trabajos: ReparacionResumen[], imei: string, f: FiltrosImeis): FilasDetalle {
  const ordenados = trabajos.filter((t) => t.imei === imei && pasaFechas(t, f.desde, f.hasta) && pasaIncidencias(t, f.incidencias)).sort(porAsignacion)
  const propios = ordenados.filter((t) => !esAjeno(t, f))
  const ajenos = ordenados.filter((t) => esAjeno(t, f))
  return { filas: [...propios, ...ajenos], deFiltrados: propios.length, deOtros: ajenos.length }
}

/** "• N trabajos" / "• 1 trabajo"; con filtro de técnico "• X de filtrados + Y de otros" (o solo "• X de filtrados"). */
export function textoTrabajos(d: FilasDetalle, conFiltroTecnico: boolean): string {
  if (!conFiltroTecnico) return `• ${d.filas.length} ${d.filas.length === 1 ? 'trabajo' : 'trabajos'}`
  return d.deOtros === 0 ? `• ${d.deFiltrados} de filtrados` : `• ${d.deFiltrados} de filtrados + ${d.deOtros} de otros`
}
