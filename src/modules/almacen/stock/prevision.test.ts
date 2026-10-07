import { describe, expect, it } from 'vitest'
import { formatearConsumo, formatearPedir } from './prevision'

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
