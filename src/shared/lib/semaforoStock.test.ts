import { describe, expect, it } from 'vitest'
import { ESTADOS_STOCK, estadoStock } from './semaforoStock'

/** Calco de StockController.estadoComponente (inventario de Stock §4): Desactivado manda; después stock 0; después
 *  stock ≤ mínimo; resto OK. El negativo cae en "Bajo" (calco, diferencia documentada). */
describe('estadoStock', () => {
  it('Desactivado manda sobre el stock', () => {
    expect(estadoStock({ stock: 0, stockMinimo: 5, activo: false })).toBe('Desactivado')
    expect(estadoStock({ stock: 99, stockMinimo: 0, activo: false })).toBe('Desactivado')
  })
  it('Sin stock con stock 0, aunque el mínimo sea 0', () => {
    expect(estadoStock({ stock: 0, stockMinimo: 0, activo: true })).toBe('Sin stock')
    expect(estadoStock({ stock: 0, stockMinimo: 3, activo: true })).toBe('Sin stock')
  })
  it('Bajo con 0 < stock ≤ mínimo', () => {
    expect(estadoStock({ stock: 1, stockMinimo: 1, activo: true })).toBe('Bajo')
    expect(estadoStock({ stock: 2, stockMinimo: 3, activo: true })).toBe('Bajo')
  })
  it('OK con stock > mínimo, también con mínimo 0', () => {
    expect(estadoStock({ stock: 4, stockMinimo: 3, activo: true })).toBe('OK')
    expect(estadoStock({ stock: 1, stockMinimo: 0, activo: true })).toBe('OK')
  })
  it('stock negativo es Bajo (calco)', () => {
    expect(estadoStock({ stock: -2, stockMinimo: 0, activo: true })).toBe('Bajo')
  })
  it('los cuatro estados en el orden del menú "Estado"', () => {
    expect(ESTADOS_STOCK).toEqual(['OK', 'Bajo', 'Sin stock', 'Desactivado'])
  })
})
