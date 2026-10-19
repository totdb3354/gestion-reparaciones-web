import { describe, expect, it } from 'vitest'
import { clasesGrado, familiaGrado } from './grado'

describe('grado con color por familias (spec 0.9.18 §4.8)', () => {
  it('familias', () => {
    expect(['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'MsA+', 'MsA', 'Ms', 'MsB', 'ID', 'n/a', '', 'X'].map(familiaGrado))
      .toEqual(['A', 'A', 'A', 'B', 'B', 'B', 'C', 'MS', 'MS', 'MS', 'MS', 'ID', 'NA', 'OTRO', 'OTRO'])
    expect(familiaGrado(null)).toBe('OTRO')
  })

  it('borde de color sobre blanco, para no confundirse con las ubicaciones; n/a con borde discontinuo', () => {
    expect(clasesGrado('A')).toContain('border-tipo-reparacion-text')
    expect(clasesGrado('A')).toContain('bg-superficie')
    expect(clasesGrado('B-')).toContain('border-tipo-pulido-text')
    expect(clasesGrado('C')).toContain('border-aviso-conflicto-text')
    expect(clasesGrado('MsB')).toContain('border-tipo-glass-text')
    expect(clasesGrado('ID')).toContain('border-fila-incidencia-brd')
    expect(clasesGrado('n/a')).toContain('border-dashed')
    expect(clasesGrado(null)).toContain('border-pill-borde')
  })
})
