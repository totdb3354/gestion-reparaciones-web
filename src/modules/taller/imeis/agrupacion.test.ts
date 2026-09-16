import { describe, expect, it } from 'vitest'
import { FILTROS_IMEIS_VACIOS, type FiltrosImeis } from '../estado'
import { SIN_CLIENTE, type EstadoIncidencia } from '../lib/filtros'
import { resumen } from '../test/fabrica'
import { agruparVisibles, esAjeno, filasDetalle, opcionesCliente, textoTrabajos } from './agrupacion'

const inc = (...v: EstadoIncidencia[]) => new Set<EstadoIncidencia>(v)

const A = '111111111111111', B = '222222222222222', C = '333333333333333'
const trabajos = [
  resumen({ idRep: 'R20260901_1', imei: A, idTec: 5, cliente: 'WEB', fechaAsig: '2026-09-01T08:00:00', fechaFin: '2026-09-01T09:00:00' }),
  resumen({ idRep: 'G20260910_1', imei: A, idTec: 6, cliente: 'WEB', fechaAsig: '2026-09-10T08:00:00', fechaFin: '2026-09-10T09:00:00', esIncidencia: true }),
  resumen({ idRep: 'P20260905_1', imei: B, idTec: 5, cliente: null, fechaAsig: '2026-09-05T08:00:00', fechaFin: '2026-09-05T09:00:00' }),
  resumen({ idRep: 'R20260812_1', imei: C, idTec: 6, cliente: 'AMAZON', fechaAsig: '2026-08-12T08:00:00', fechaFin: '2026-08-12T09:00:00', esIncidencia: true, esResuelto: true }),
]
const f = (extra: Partial<FiltrosImeis>): FiltrosImeis => ({ ...FILTROS_IMEIS_VACIOS, ...extra })

describe('agrupación del maestro (calco de AgrupadoController.cargar)', () => {
  it('sin filtros: un grupo por IMEI ordenado por actividad más reciente', () => {
    expect(agruparVisibles(trabajos, FILTROS_IMEIS_VACIOS).map((g) => g.imei)).toEqual([A, B, C])
  })
  it('el filtro de técnico deja los grupos en los que ALGUNO de los marcados trabajó, con todos sus trabajos', () => {
    const grupos = agruparVisibles(trabajos, f({ tecnicos: new Set([6]) }))
    expect(grupos.map((g) => g.imei)).toEqual([A, C])
    expect(grupos[0].trabajos).toHaveLength(2)
  })
  it('IMEI, fechas y cliente filtran los trabajos antes de agrupar', () => {
    expect(agruparVisibles(trabajos, f({ imei: B })).map((g) => g.imei)).toEqual([B])
    expect(agruparVisibles(trabajos, f({ desde: '2026-09-02', hasta: '2026-09-30' })).map((g) => g.imei)).toEqual([A, B])
    expect(agruparVisibles(trabajos, f({ desde: '2026-09-02', hasta: '2026-09-30' }))[0].trabajos).toHaveLength(1)
    expect(agruparVisibles(trabajos, f({ clientes: new Set([SIN_CLIENTE]) })).map((g) => g.imei)).toEqual([B])
    expect(agruparVisibles(trabajos, f({ clientes: new Set(['AMAZON', 'WEB']) })).map((g) => g.imei)).toEqual([A, C])
  })
  it('Incidencia = alguna abierta, Normal = ninguna; "cerradas" no cuenta en el maestro', () => {
    expect(agruparVisibles(trabajos, f({ incidencias: inc('abiertas') })).map((g) => g.imei)).toEqual([A])
    expect(agruparVisibles(trabajos, f({ incidencias: inc('sin') })).map((g) => g.imei)).toEqual([B, C])
    expect(agruparVisibles(trabajos, f({ incidencias: inc('cerradas') })).map((g) => g.imei)).toEqual([A, B, C])
  })
  it('opcionesCliente: alfabético con "(Sin cliente)" delante solo si hay trabajos sin cliente', () => {
    expect(opcionesCliente(trabajos)).toEqual([SIN_CLIENTE, 'AMAZON', 'WEB'])
    expect(opcionesCliente(trabajos.filter((t) => t.cliente))).toEqual(['AMAZON', 'WEB'])
  })
})

describe('detalle de un IMEI', () => {
  const del = [
    resumen({ idRep: 'R20260901_1', imei: A, idTec: 5, fechaAsig: '2026-09-01T08:00:00', fechaFin: '2026-09-01T09:00:00' }),
    resumen({ idRep: 'G20260910_1', imei: A, idTec: 6, fechaAsig: '2026-09-10T08:00:00', fechaFin: '2026-09-10T09:00:00', esIncidencia: true }),
    resumen({ idRep: 'R20260815_1', imei: A, idTec: 6, fechaAsig: '2026-08-15T08:00:00', fechaFin: '2026-08-15T09:00:00' }),
    resumen({ idRep: 'P20260905_1', imei: B, idTec: 5 }),
  ]
  it('solo los trabajos del IMEI, por fecha de asignación ascendente', () => {
    const d = filasDetalle(del, A, FILTROS_IMEIS_VACIOS)
    expect(d.filas.map((t) => t.idRep)).toEqual(['R20260815_1', 'R20260901_1', 'G20260910_1'])
    expect(d).toMatchObject({ deFiltrados: 3, deOtros: 0 })
    expect(textoTrabajos(d, false)).toBe('• 3 trabajos')
    expect(textoTrabajos(filasDetalle(del, B, FILTROS_IMEIS_VACIOS), false)).toBe('• 1 trabajo')
  })
  it('con filtro de técnico: primero los suyos, después los ajenos (atenuados), y el texto "X de filtrados + Y de otros"', () => {
    const filtros = f({ tecnicos: new Set([6]) })
    const d = filasDetalle(del, A, filtros)
    expect(d.filas.map((t) => t.idRep)).toEqual(['R20260815_1', 'G20260910_1', 'R20260901_1'])
    expect(esAjeno(d.filas[2], filtros)).toBe(true)
    expect(esAjeno(d.filas[0], filtros)).toBe(false)
    expect(textoTrabajos(d, true)).toBe('• 2 de filtrados + 1 de otros')
    expect(textoTrabajos(filasDetalle(del, A, f({ tecnicos: new Set([5, 6]) })), true)).toBe('• 3 de filtrados')
  })
  it('fechas e incidencias filtran las filas del detalle', () => {
    expect(filasDetalle(del, A, f({ incidencias: inc('abiertas') })).filas.map((t) => t.idRep)).toEqual(['G20260910_1'])
    expect(filasDetalle(del, A, f({ desde: '2026-09-05', hasta: '' })).filas.map((t) => t.idRep)).toEqual(['G20260910_1'])
  })
})
