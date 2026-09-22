import { describe, expect, it } from 'vitest'
import { resumen } from '../test/fabrica'
import { contarTecnicosPorImei } from './conteoTecnicos'

/** Calco del helper `rr` de PendientesSuperTecnicoControllerTest: al conteo solo le importan IMEI e idTec. */
const fila = (imei: string | null, idTec: number) => ({ imei, idTec })

/**
 * Puerto de los seis tests de `contarTecnicosPorImei` de PendientesSuperTecnicoControllerTest (cliente JavaFX),
 * uno a uno y en su orden. IMEIs sintéticos, como allí.
 */
describe('contarTecnicosPorImei (calco de PendientesSuperTecnicoController)', () => {
  it('la lista vacía da un mapa vacío', () => {
    expect(contarTecnicosPorImei([]).size).toBe(0)
  })

  it('un IMEI con un técnico cuenta 1', () => {
    expect(contarTecnicosPorImei([fila('111111111111111', 7)]).get('111111111111111')).toBe(1)
  })

  it('un IMEI con dos técnicos distintos cuenta 2', () => {
    const c = contarTecnicosPorImei([fila('111111111111111', 7), fila('111111111111111', 9)])
    expect(c.get('111111111111111')).toBe(2)
  })

  it('el mismo técnico repetido en un IMEI cuenta 1: cuenta técnicos distintos, no filas', () => {
    const c = contarTecnicosPorImei([fila('111111111111111', 7), fila('111111111111111', 7)])
    expect(c.get('111111111111111')).toBe(1)
  })

  it('varios IMEIs mezclados', () => {
    const c = contarTecnicosPorImei([fila('AAA', 1), fila('AAA', 2), fila('AAA', 2), fila('BBB', 5)])
    expect(c.get('AAA')).toBe(2)
    expect(c.get('BBB')).toBe(1)
    expect(c.size).toBe(2)
  })

  it('la fila con IMEI nulo se ignora', () => {
    const c = contarTecnicosPorImei([fila(null, 3), fila('222222222222222', 3)])
    expect([...c.keys()]).toEqual(['222222222222222'])
    expect(c.get('222222222222222')).toBe(1)
  })

  it('acepta las filas de la tabla tal cual llegan del servidor', () => {
    const c = contarTecnicosPorImei([
      resumen({ idRep: 'A20260922_1', imei: '000000000000001', idTec: 4 }),
      resumen({ idRep: 'AG20260922_1', imei: '000000000000001', idTec: 6 }),
    ])
    expect(c.get('000000000000001')).toBe(2)
  })
})
