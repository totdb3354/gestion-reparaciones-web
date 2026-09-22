import { describe, expect, it } from 'vitest'
import { resumen } from '../test/fabrica'
import {
  SIN_CLIENTE, estadoIncidencia, etiquetaContador, ordenarPendientes, pasaCliente, pasaFechas, pasaImeis, pasaIncidencias,
  pasaPieza, pasaTecnico, pasaTipo, sufijoToggle, textoBadgeLateral,
} from './filtros'

describe('filtros del taller', () => {
  it('filtro Tipo: las tres casillas se evalúan por separado (calco de las checkboxes del JavaFX)', () => {
    expect(pasaTipo(resumen(), new Set())).toBe(true)
    expect(pasaTipo(resumen(), new Set(['asignacion']))).toBe(true)
    expect(pasaTipo(resumen(), new Set(['solicitud']))).toBe(false)
    expect(pasaTipo(resumen({ esSolicitud: 1 }), new Set(['solicitud', 'asignacion']))).toBe(true)
    expect(pasaTipo(resumen({ esIncidencia: true }), new Set(['incidencia']))).toBe(true)
    // una solicitud con incidencia sale bajo cualquiera de las dos, y nunca bajo "Asignaciones"
    const ambas = resumen({ esSolicitud: 1, esIncidencia: true })
    expect(pasaTipo(ambas, new Set(['solicitud']))).toBe(true)
    expect(pasaTipo(ambas, new Set(['incidencia']))).toBe(true)
    expect(pasaTipo(ambas, new Set(['asignacion']))).toBe(false)
  })
  it('estado de incidencia y filtro Incidencias', () => {
    expect(estadoIncidencia(resumen({ esIncidencia: true }))).toBe('abiertas')
    expect(estadoIncidencia(resumen({ esIncidencia: true, esResuelto: true }))).toBe('cerradas')
    expect(estadoIncidencia(resumen())).toBe('sin')
    expect(pasaIncidencias(resumen(), new Set())).toBe(true)
    expect(pasaIncidencias(resumen(), new Set(['abiertas']))).toBe(false)
    expect(pasaIncidencias(resumen({ esIncidencia: true }), new Set(['abiertas', 'sin']))).toBe(true)
  })
  it('fechas por fecha de fin en Madrid, extremos incluidos; sin fin y con rango → fuera', () => {
    const r = resumen({ fechaFin: '2026-08-28T22:30:00' })   // 29/08 00:30 en Madrid
    expect(pasaFechas(r, '', '')).toBe(true)
    expect(pasaFechas(r, '2026-08-29', '')).toBe(true)
    expect(pasaFechas(r, '2026-08-30', '')).toBe(false)
    expect(pasaFechas(r, '', '2026-08-28')).toBe(false)
    expect(pasaFechas(r, '2026-08-29', '2026-08-29')).toBe(true)
    expect(pasaFechas(resumen({ fechaFin: null }), '2026-08-01', '')).toBe(false)
    expect(pasaFechas(resumen({ fechaFin: null }), '', '')).toBe(true)
  })
  it('IMEIs, cliente con "(Sin cliente)", pieza por categoría y técnico', () => {
    expect(pasaImeis('355400000000111', new Set())).toBe(true)
    expect(pasaImeis('355400000000111', new Set(['1']))).toBe(false)
    expect(pasaCliente(null, new Set([SIN_CLIENTE]))).toBe(true)
    expect(pasaCliente('WEB', new Set([SIN_CLIENTE]))).toBe(false)
    expect(pasaCliente('WEB', new Set(['WEB']))).toBe(true)
    expect(pasaPieza('bati13', new Set(['Batería']))).toBe(true)
    expect(pasaPieza('lcdi13', new Set(['Batería']))).toBe(false)
    expect(pasaPieza(null, new Set())).toBe(true)
    expect(pasaTecnico(4, new Set([4, 5]))).toBe(true)
    expect(pasaTecnico(9, new Set([4]))).toBe(false)
  })
  it('orden de pendientes: urgentes, con cliente, resto; estable', () => {
    const lista = [
      resumen({ idRep: 'A1', cliente: null }), resumen({ idRep: 'A2', urgente: true, cliente: null }),
      resumen({ idRep: 'A3', cliente: 'WEB' }), resumen({ idRep: 'A4', cliente: null }), resumen({ idRep: 'A5', urgente: true, cliente: 'WEB' }),
    ]
    expect(ordenarPendientes(lista).map((r) => r.idRep)).toEqual(['A2', 'A5', 'A3', 'A1', 'A4'])
  })
  it('orden de pendientes: el cliente vacío cuenta como sin cliente', () => {
    const lista = [resumen({ idRep: 'A1', cliente: '' }), resumen({ idRep: 'A2', cliente: 'WEB' })]
    expect(ordenarPendientes(lista).map((r) => r.idRep)).toEqual(['A2', 'A1'])
  })
  it('orden de pendientes: no muta la lista recibida', () => {
    const lista = [resumen({ idRep: 'A1', cliente: null }), resumen({ idRep: 'A2', urgente: true, cliente: null })]
    ordenarPendientes(lista)
    expect(lista.map((r) => r.idRep)).toEqual(['A1', 'A2'])
  })
  it('contadores y sufijos', () => {
    expect(etiquetaContador(1, 'pendiente', 'pendientes', 999)).toBe('1 pendiente')
    expect(etiquetaContador(10, 'pendiente', 'pendientes', 999)).toBe('10 pendientes')
    expect(etiquetaContador(1200, 'pendiente', 'pendientes', 999)).toBe('999+ pendientes')
    expect(etiquetaContador(1314, 'reparación', 'reparaciones')).toBe('1314 reparaciones')
    expect(sufijoToggle(0)).toBe('(0)')
    expect(sufijoToggle(150)).toBe('(99+)')
    expect(textoBadgeLateral(0)).toBeNull()
    expect(textoBadgeLateral(10)).toBe('10')
    expect(textoBadgeLateral(100)).toBe('99+')
  })
})
