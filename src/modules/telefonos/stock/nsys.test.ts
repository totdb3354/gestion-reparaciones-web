import { describe, expect, it } from 'vitest'
import { estadoNsys, importacion } from '../test/fabrica'
import { conHuecos, horaItems, minutosDesde, minutosHabiles, textoBanda, textoCambios, textoHistorico, textoPildora, type FilaLista } from './nsys'

// 16/10/2026 13:43 en Madrid (CEST, UTC+2).
const AHORA = new Date('2026-10-16T11:43:00Z')

describe('aviso de NSYS', () => {
  it('minutos desde una hora de Madrid', () => {
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

  it('una exportación en el futuro no da minutos negativos', () => {
    expect(minutosDesde('2026-10-16T13:50:00', AHORA)).toBe(0)
  })

  it('pasada la medianoche de Madrid, la exportación de ayer no es «de hoy»', () => {
    const despuesDeMedianoche = new Date('2026-10-15T22:10:00Z') // 16/10 00:10 en Madrid
    expect(textoPildora(estadoNsys({ ultimaExportacion: '2026-10-15T23:50:00' }), despuesDeMedianoche))
      .toBe('NSYS: exportación del 15/10 23:50')
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

describe('lista de importaciones de la píldora (spec 0.9.18 §4.11)', () => {
  it('minutos hábiles, de 07:00 a 23:00, como AvisoNsys del servidor', () => {
    expect(minutosHabiles('2026-10-16T15:31:00', '2026-10-16T16:01:00')).toBe(30)
    expect(minutosHabiles('2026-10-16T22:31:00', '2026-10-17T07:01:00')).toBe(30)
    expect(minutosHabiles('2026-10-16T22:31:00', '2026-10-17T08:01:00')).toBe(90)
    expect(minutosHabiles('2026-10-16T16:01:00', '2026-10-16T15:31:00')).toBe(0)
  })

  const items = (...filas: [string, string?][]) => filas.map(([f, resultado = 'OK']) => importacion({ fechaExportacion: f, resultado }))
  const huecos = (filas: FilaLista[]) => filas.flatMap((f) => (f.tipo === 'hueco' ? [`${f.desde.slice(11, 16)}-${f.hasta.slice(11, 16)}`] : []))

  it('30 minutos no es un hueco y 46 dentro de 07-23 sí', () => {
    expect(huecos(conHuecos(items(['2026-10-16T16:01:00'], ['2026-10-16T15:31:00'])))).toEqual([])
    const filas = conHuecos(items(['2026-10-16T16:31:00'], ['2026-10-16T15:45:00']))
    expect(filas.map((f) => f.tipo)).toEqual(['importacion', 'hueco', 'importacion'])
    expect(huecos(filas)).toEqual(['15:45-16:31'])
  })

  it('la noche no cuenta: de 22:31 a 07:01 no hay hueco y de 22:31 a 08:01 sí (29 + 61 minutos hábiles)', () => {
    expect(huecos(conHuecos(items(['2026-10-17T07:01:00'], ['2026-10-16T22:31:00'])))).toEqual([])
    expect(huecos(conHuecos(items(['2026-10-17T08:01:00'], ['2026-10-16T22:31:00'])))).toEqual(['22:31-08:01'])
  })

  it('un RECHAZADO cuenta como exportación que llegó', () => {
    expect(huecos(conHuecos(items(['2026-10-16T16:31:00'], ['2026-10-16T16:01:00', 'RECHAZADO'], ['2026-10-16T15:31:00'])))).toEqual([])
  })

  it('la hora del Items: de hoy, la hora; de otro día, también el día', () => {
    expect(horaItems('2026-10-16T13:31:00', AHORA)).toBe('13:31')
    expect(horaItems('2026-10-15T22:31:00', AHORA)).toBe('15/10 22:31')
    expect(textoCambios(1)).toBe('1 cambio')
    expect(textoCambios(12)).toBe('12 cambios')
  })

  it('la línea del histórico: sin histórico, ninguna; en marcha, hasta dónde va; acabado, terminado', () => {
    expect(textoHistorico({ total: 0, hechos: 0, ultimo: null, hasta: null })).toBeNull()
    expect(textoHistorico({ total: 140, hechos: 138, ultimo: '2025-05-03T22:31:00', hasta: '2026-10-16T14:31:00' }))
      .toBe('Histórico: 138 ficheros hechos, hasta el Items del 03/05/2025; termina en el del 16/10/2026')
    expect(textoHistorico({ total: 2, hechos: 1, ultimo: '2024-01-02T09:01:00', hasta: null })).toBe('Histórico: 1 fichero hecho, hasta el Items del 02/01/2024')
    expect(textoHistorico({ total: 990, hechos: 990, ultimo: '2026-10-16T14:31:00', hasta: '2026-10-16T14:31:00' })).toBe('Histórico: terminado (990 ficheros)')
  })
})
