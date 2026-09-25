import { describe, expect, it } from 'vitest'
import { aEuros, etiquetaTasa, totalLinea } from './conversion'

describe('conversión a euros (tasa = divisa por 1 EUR, P3: se divide)', () => {
  it('aEuros divide por la tasa y redondea a 2 decimales HALF_UP, como el servidor (C40)', () => {
    expect(aEuros(10, 1.1367)).toBeCloseTo(8.8, 4)
    expect(aEuros(10, 1)).toBe(10)
  })
  it('totalLinea = precio / tasa × cantidad; null si falta cualquiera de los tres o la tasa no es positiva', () => {
    expect(totalLinea(10, 1.1367, 2)).toBeCloseTo(17.6, 4)
    expect(totalLinea(12.5, 1, 3)).toBe(37.5)
    expect(totalLinea(null, 1, 3)).toBeNull()
    expect(totalLinea(12.5, null, 3)).toBeNull()
    expect(totalLinea(12.5, 1, null)).toBeNull()
    expect(totalLinea(12.5, 0, 3)).toBeNull()
  })
  it('aEuros redondea el unitario a 2 decimales (HALF_UP como el servidor) ANTES de multiplicar por la cantidad (C40):'
    + ' #90, 3 × 12,70 $ a 1 USD = 1,1367 € da 33,51 € (el unitario 11,17), no 33,52 € (3 × 12,70 × 0,8797 sin redondear)', () => {
    expect(aEuros(12.7, 1.1367)).toBeCloseTo(11.17, 4)
    expect(totalLinea(12.7, 1.1367, 3)).toBeCloseTo(33.51, 4)
  })
  it('etiquetaTasa: dos espacios delante, 1/tasa con 4 decimales y coma (P7); vacía en EUR', () => {
    expect(etiquetaTasa('USD', 1.1367)).toBe('  (1 USD = 0,8797 €)')
    expect(etiquetaTasa('EUR', 1)).toBe('')
  })
})
