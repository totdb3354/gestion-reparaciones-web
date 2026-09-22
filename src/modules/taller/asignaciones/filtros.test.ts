import { describe, expect, it } from 'vitest'
import type { ReparacionResumen } from '@/shared/api/client'
import { FILTROS_VACIOS, SIN_CLIENTE, aplicarFiltros } from './filtros'

const fila = (p: Partial<ReparacionResumen>) =>
  ({ idRep: 'A1', imei: '000000000000001', idTec: 1, cliente: null, esSolicitud: 0, esIncidencia: false, ...p }) as unknown as ReparacionResumen

const ids = (fs: ReparacionResumen[]) => fs.map((f) => f.idRep)

// tipoDe se reexporta desde ./filtros pero se define y se prueba en shared/lib/tipoTrabajo.test.ts;
// no se duplica esa suite aquí.
describe('aplicarFiltros', () => {
  const filas = [
    fila({ idRep: 'A1', imei: '000000000000001', idTec: 1, cliente: 'CLI_A' }),
    fila({ idRep: 'AG2', imei: '000000000000002', idTec: 2, cliente: null }),
    fila({ idRep: 'AP3', imei: '000000000000003', idTec: 1, cliente: 'CLI_B', esSolicitud: 1 }),
    fila({ idRep: 'A4', imei: '000000000000004', idTec: 2, cliente: null, esIncidencia: true }),
  ]

  it('sin filtros devuelve todo', () => {
    expect(ids(aplicarFiltros(filas, FILTROS_VACIOS))).toEqual(['A1', 'AG2', 'AP3', 'A4'])
  })

  it('el IMEI incompleto no filtra', () => {
    expect(ids(aplicarFiltros(filas, { ...FILTROS_VACIOS, imei: '00000' }))).toHaveLength(4)
  })

  it('el IMEI completo filtra a esa fila', () => {
    expect(ids(aplicarFiltros(filas, { ...FILTROS_VACIOS, imei: '000000000000002' }))).toEqual(['AG2'])
  })

  it('admite varios IMEIs separados por comas', () => {
    const f = { ...FILTROS_VACIOS, imei: '000000000000001,000000000000003' }
    expect(ids(aplicarFiltros(filas, f))).toEqual(['A1', 'AP3'])
  })

  it('una lista de técnicos vacía significa no filtrar, no ninguno', () => {
    expect(ids(aplicarFiltros(filas, { ...FILTROS_VACIOS, tecnicos: [] }))).toHaveLength(4)
    expect(ids(aplicarFiltros(filas, { ...FILTROS_VACIOS, tecnicos: [2] }))).toEqual(['AG2', 'A4'])
  })

  it('el cliente admite el centinela de sin cliente', () => {
    const f = { ...FILTROS_VACIOS, clientes: [SIN_CLIENTE] }
    expect(ids(aplicarFiltros(filas, f))).toEqual(['AG2', 'A4'])
  })

  it('filtra por tipo', () => {
    expect(ids(aplicarFiltros(filas, { ...FILTROS_VACIOS, tipos: ['GLASS', 'PULIDO'] }))).toEqual(['AG2', 'AP3'])
  })

  it('los estados se combinan con O y asignación es ni solicitud ni incidencia', () => {
    expect(ids(aplicarFiltros(filas, { ...FILTROS_VACIOS, estados: ['SOLICITUD'] }))).toEqual(['AP3'])
    expect(ids(aplicarFiltros(filas, { ...FILTROS_VACIOS, estados: ['INCIDENCIA'] }))).toEqual(['A4'])
    expect(ids(aplicarFiltros(filas, { ...FILTROS_VACIOS, estados: ['ASIGNACION'] }))).toEqual(['A1', 'AG2'])
    expect(ids(aplicarFiltros(filas, { ...FILTROS_VACIOS, estados: ['SOLICITUD', 'INCIDENCIA'] }))).toEqual(['AP3', 'A4'])
  })

  it('combina filtros de distintos grupos con Y', () => {
    const f = { ...FILTROS_VACIOS, tecnicos: [1], tipos: ['REPARACION' as const] }
    expect(ids(aplicarFiltros(filas, f))).toEqual(['A1'])
  })

  // Desviación (b) del brief: el filtro Estado combina con O, no en cascada excluyente.
  // Una fila puede ser solicitud e incidencia a la vez (calco de pasaTipo / PendientesTecnicoController):
  // debe salir al marcar cualquiera de las dos, y no salir si solo se marca Asignaciones.
  it('una fila que es solicitud e incidencia a la vez sale con cualquiera de las dos casillas, no con Asignaciones', () => {
    const filasConMixta = [...filas, fila({ idRep: 'A5', imei: '000000000000005', idTec: 1, esSolicitud: 1, esIncidencia: true })]

    expect(ids(aplicarFiltros(filasConMixta, { ...FILTROS_VACIOS, estados: ['SOLICITUD'] }))).toEqual(['AP3', 'A5'])
    expect(ids(aplicarFiltros(filasConMixta, { ...FILTROS_VACIOS, estados: ['INCIDENCIA'] }))).toEqual(['A4', 'A5'])
    expect(ids(aplicarFiltros(filasConMixta, { ...FILTROS_VACIOS, estados: ['ASIGNACION'] }))).toEqual(['A1', 'AG2'])
  })
})
