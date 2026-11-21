import { describe, expect, it } from 'vitest'
import { comoDesplazar, dondeQueda, filasNuevas, scrollParaCentrar } from './volver'

const vista = { scrollTop: 1000, clientHeight: 400, cabecera: 30 }

describe('dondeQueda', () => {
  it('sin fila seleccionada no hay nada que enseñar', () => {
    expect(dondeQueda(null, vista)).toBeNull()
  })
  it('encima si queda tapada por la cabecera o por arriba, debajo si no llega a verse, null si se ve', () => {
    expect(dondeQueda({ top: 900, bottom: 932 }, vista)).toBe('arriba')
    expect(dondeQueda({ top: 1000, bottom: 1032 }, vista)).toBe('arriba') // debajo de la cabecera fija
    expect(dondeQueda({ top: 1040, bottom: 1072 }, vista)).toBeNull()
    expect(dondeQueda({ top: 1380, bottom: 1412 }, vista)).toBeNull() // asoma por abajo
    expect(dondeQueda({ top: 1400, bottom: 1432 }, vista)).toBe('abajo')
  })
})

describe('scrollParaCentrar', () => {
  it('deja la fila en el centro del hueco bajo la cabecera', () => {
    // Centro de la fila 5016; hueco de 370 px desde la cabecera: 5016 - 30 - 185.
    expect(scrollParaCentrar({ top: 5000, bottom: 5032 }, { ...vista, scrollHeight: 20000 })).toBe(4801)
  })
  it('no se pasa de los extremos', () => {
    expect(scrollParaCentrar({ top: 40, bottom: 72 }, { ...vista, scrollHeight: 20000 })).toBe(0)
    expect(scrollParaCentrar({ top: 19960, bottom: 19992 }, { ...vista, scrollHeight: 20000 })).toBe(19600)
  })
})

describe('comoDesplazar', () => {
  it('suave a menos de dos pantallas, directo más lejos', () => {
    expect(comoDesplazar(1000, 1700, 400)).toBe('smooth')
    expect(comoDesplazar(1000, 1800, 400)).toBe('auto')
    expect(comoDesplazar(9000, 0, 400)).toBe('auto')
  })
})

describe('filasNuevas', () => {
  const visto = (ids: number[], recibidas = ids.length) => ({ ids: new Set(ids), max: Math.max(...ids), recibidas })
  it('la primera vez no cuenta nada', () => {
    expect(filasNuevas(null, [1, 2, 3], 3)).toBe(0)
  })
  it('cuenta las que llegan con id mayor que todas las vistas', () => {
    expect(filasNuevas(visto([1, 2, 3]), [1, 2, 3, 4, 5], 5)).toBe(2)
  })
  it('ampliar el periodo hacia atrás trae ids menores: no son nuevas', () => {
    expect(filasNuevas(visto([10, 11, 12]), [4, 5, 10, 11, 12], 5)).toBe(0)
  })
  it('si falta alguna de las de antes es otra consulta: empieza de cero', () => {
    expect(filasNuevas(visto([1, 2, 3]), [2, 3, 4, 5], 4)).toBeNull()
  })
  it('un filtro de columna (no llegan filas) no cuenta, y menos recibidas empieza de cero', () => {
    expect(filasNuevas(visto([1, 2, 3], 10), [1, 2, 3, 9], 10)).toBe(0)
    expect(filasNuevas(visto([1, 2, 3], 10), [1, 2], 8)).toBeNull()
  })
  it('solo cuenta las nuevas que se ven (las que pasan los filtros de columna)', () => {
    expect(filasNuevas(visto([1, 3], 3), [1, 3, 5], 6)).toBe(1)
  })
})
