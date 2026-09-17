import { describe, expect, it } from 'vitest'
import { MODELOS_ORDENADOS, traducirModelo } from './modelos'

describe('modelos (calco de MODELOS_ORDENADOS y traducirModelo)', () => {
  it('traduce numéricos con variante, especiales y aire', () => {
    expect(traducirModelo('12promax')).toBe('iPhone 12 Pro Max')
    expect(traducirModelo('14plus')).toBe('iPhone 14 Plus')
    expect(traducirModelo('13mini')).toBe('iPhone 13 Mini')
    expect(traducirModelo('16e')).toBe('iPhone 16e')
    expect(traducirModelo('15')).toBe('iPhone 15')
    expect(traducirModelo('se2020')).toBe('iPhone SE 2020')
    expect(traducirModelo('xsmax')).toBe('iPhone XS Max')
    expect(traducirModelo('6splus')).toBe('iPhone 6S Plus')
    expect(traducirModelo('air')).toBe('iPhone Air')
    expect(traducirModelo('')).toBe('')
    expect(traducirModelo(null)).toBe('')
  })
  it('el catálogo va en orden de tienda y empieza y acaba como el JavaFX', () => {
    expect(MODELOS_ORDENADOS[0]).toBe('6s')
    expect(MODELOS_ORDENADOS.at(-1)).toBe('17promax')
    expect(MODELOS_ORDENADOS).toHaveLength(39)
    expect(new Set(MODELOS_ORDENADOS).size).toBe(MODELOS_ORDENADOS.length)
  })
})
