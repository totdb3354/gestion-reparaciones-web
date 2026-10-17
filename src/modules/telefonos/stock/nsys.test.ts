import { describe, expect, it } from 'vitest'
import { estadoNsys } from '../test/fabrica'
import { minutosDesde, textoBanda, textoPildora } from './nsys'

// 16/10/2026 13:43 en Madrid (CEST, UTC+2).
const AHORA = new Date('2026-10-16T11:43:00Z')

describe('aviso de NSYS', () => {
  it('minutos desde una hora de Madrid, sea cual sea la zona del navegador', () => {
    expect(minutosDesde('2026-10-16T13:31:00', AHORA)).toBe(12)
  })

  it('píldora según el nivel', () => {
    expect(textoPildora(estadoNsys(), AHORA)).toBe('NSYS: exportación de hoy 13:31 · hace 12 min')
    expect(textoPildora(estadoNsys({ nivel: 'RETRASO', ultimaExportacion: '2026-10-16T11:31:00' }), AHORA))
      .toBe('NSYS: última exportación hace 2 h 12 min (11:31)')
    expect(textoPildora(estadoNsys({ nivel: 'SIN_DATOS', ultimaExportacion: '2026-10-16T08:31:00' }), AHORA))
      .toBe('NSYS: sin datos nuevos desde hace 5 h')
    expect(textoPildora(estadoNsys({ nivel: 'SIN_DATOS', ultimaExportacion: null }), AHORA)).toBe('NSYS: sin datos todavía')
    expect(textoPildora(estadoNsys({ ultimaExportacion: '2026-10-15T22:31:00' }), AHORA)).toBe('NSYS: exportación del 15/10 22:31')
  })

  it('la banda solo sale sin datos', () => {
    expect(textoBanda(estadoNsys(), AHORA)).toBeNull()
    expect(textoBanda(estadoNsys({ nivel: 'SIN_DATOS', ultimaExportacion: '2026-10-16T08:31:00' }), AHORA)).toBe(
      'No llegan datos nuevos de NSYS desde las 08:31. El PC de producción o Drive pueden estar parados. Se enseñan los últimos datos recibidos.')
    expect(textoBanda(estadoNsys({ nivel: 'SIN_DATOS', ultimaExportacion: '2026-10-15T22:31:00' }), AHORA)).toBe(
      'No llegan datos nuevos de NSYS desde el 15/10 a las 22:31. El PC de producción o Drive pueden estar parados. Se enseñan los últimos datos recibidos.')
    expect(textoBanda(estadoNsys({ nivel: 'SIN_DATOS', ultimaExportacion: null }), AHORA)).toBe('Todavía no ha llegado ningún dato de NSYS.')
  })
})
