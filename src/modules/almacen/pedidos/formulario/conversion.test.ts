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
  it('aEuros: HALF_UP en un empate por encima de 1, donde Number.EPSILON no basta para compensar el redondeo'
    + ' binario (1,74 / 0,8 = 2,175 exacto, pero el double más cercano cae por debajo y Math.round sin más trunca'
    + ' a 2,17 en vez de subir a 2,18, como el BigDecimal HALF_UP del servidor)', () => {
    expect(aEuros(1.74, 0.8)).toBe(2.18)
    expect(aEuros(1.94, 0.8)).toBe(2.43)
    expect(aEuros(2.61, 1.2)).toBe(2.18)
  })
  it('aEuros: en EUR (tasa 1) devuelve el precio SIN redondear, como `ConversionEur.aEuros` del servidor (que ni'
    + ' siquiera consulta la tasa en ese caso); el redondeo a 2 decimales lo hace solo el formateador al pintar', () => {
    expect(aEuros(12.345, 1)).toBe(12.345)
    expect(totalLinea(12.345, 1, 3)).toBeCloseTo(37.035, 4)
  })
})
