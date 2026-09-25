import { describe, expect, it } from 'vitest'
import { aEuros, etiquetaTasa, totalLinea } from './conversion'

describe('conversión a euros (tasa = divisa por 1 EUR, P3: se divide)', () => {
  it('aEuros divide por la tasa', () => {
    expect(aEuros(10, 1.1367)).toBeCloseTo(8.7974, 4)
    expect(aEuros(10, 1)).toBe(10)
  })
  it('totalLinea = precio / tasa × cantidad; null si falta cualquiera de los tres o la tasa no es positiva', () => {
    expect(totalLinea(10, 1.1367, 2)).toBeCloseTo(17.5948, 4)
    expect(totalLinea(12.5, 1, 3)).toBe(37.5)
    expect(totalLinea(null, 1, 3)).toBeNull()
    expect(totalLinea(12.5, null, 3)).toBeNull()
    expect(totalLinea(12.5, 1, null)).toBeNull()
    expect(totalLinea(12.5, 0, 3)).toBeNull()
  })
  it('etiquetaTasa: dos espacios delante, 1/tasa con 4 decimales y coma (P7); vacía en EUR', () => {
    expect(etiquetaTasa('USD', 1.1367)).toBe('  (1 USD = 0,8797 €)')
    expect(etiquetaTasa('EUR', 1)).toBe('')
  })
})
