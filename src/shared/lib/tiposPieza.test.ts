import { describe, expect, it } from 'vitest'
import { nombreTipoPieza } from './tiposPieza'

describe('nombreTipoPieza (spec 2026-10-12 §5.1)', () => {
  it('nombra los siete tipos y deja el prefijo desconocido tal cual', () => {
    expect(['bat', 'cha', 'tapa', 'g', 'mc', 'lcd', 'cam'].map(nombreTipoPieza))
      .toEqual(['Batería', 'Chasis', 'Tapa trasera', 'Glass', 'Marco', 'Pantalla', 'Cámara'])
    expect(nombreTipoPieza('flex')).toBe('flex')
  })
})
