import { describe, expect, it } from 'vitest'
import { formatearConsumo, formatearPedir, leerPesos, sumaPesos } from './prevision'

describe('formato de la previsión', () => {
  it('consumo con dos decimales y coma; sin previsión, "—"', () => {
    expect(formatearConsumo(0.31)).toBe('0,31')
    expect(formatearConsumo(0)).toBe('0,00')
    expect(formatearConsumo(1.5)).toBe('1,50')
    expect(formatearConsumo(null)).toBe('—')
    expect(formatearConsumo(undefined)).toBe('—')
  })
  it('pedir: el número; sin previsión, "—"', () => {
    expect(formatearPedir(7)).toBe('7')
    expect(formatearPedir(0)).toBe('0')
    expect(formatearPedir(null)).toBe('—')
  })
})

describe('pesos de la previsión', () => {
  it('tres enteros de 0 a 100 que suman 100', () => {
    expect(leerPesos(['50', '30', '20'])).toEqual({ peso1: 50, peso2: 30, peso3: 20 })
    expect(leerPesos([' 100 ', '0', '0'])).toEqual({ peso1: 100, peso2: 0, peso3: 0 })
    expect(leerPesos(['50', '30', '30'])).toBeNull()
    expect(leerPesos(['50', '30', ''])).toBeNull()
    expect(leerPesos(['50', '30', '2.5'])).toBeNull()
    expect(leerPesos(['150', '-30', '-20'])).toBeNull()
  })
  it('suma en vivo; null si algún campo no es un entero de 0 a 100', () => {
    expect(sumaPesos(['50', '30', '30'])).toBe(110)
    expect(sumaPesos(['50', '', '20'])).toBeNull()
  })
})
