import { describe, expect, it } from 'vitest'
import type { Componente } from '@/shared/api/client'
import { colorBarraStock, conteosDonut, ticksEjeY } from './graficos'

const base: Componente = { idCom: 1, tipo: 'lcd-x', fechaRegistro: '2026-09-01T10:00:00', stock: 5, stockMinimo: 2, activo: true, updatedAt: '2026-09-01T10:00:00', enCamino: 0, ultimoPedido: null, idComMaster: null }
const c = (o: Partial<Componente>): Componente => ({ ...base, ...o })

describe('conteosDonut', () => {
  it('cuenta OK, Bajo y Sin stock sobre los activos; excluye desactivados y negativos (calco :495-501)', () => {
    const conteos = conteosDonut([
      c({ idCom: 1, stock: 5 }), c({ idCom: 2, stock: 2 }), c({ idCom: 3, stock: 0 }),
      c({ idCom: 4, stock: 0, activo: false }), c({ idCom: 5, stock: -1 }),
    ])
    expect(conteos).toEqual({ ok: 1, bajo: 1, sinStock: 1, total: 3 })
  })
  it('un grupo compartido cuenta cada fila (calco)', () => {
    expect(conteosDonut([c({ idCom: 1, stock: 0 }), c({ idCom: 2, stock: 0, idComMaster: 1 })]).sinStock).toBe(2)
  })
  it('color de la barra Stock según el semáforo', () => {
    expect(colorBarraStock('Sin stock')).toBe('#B03040')
    expect(colorBarraStock('Bajo')).toBe('#C77A00')
    expect(colorBarraStock('OK')).toBe('#3A7D44')
  })
  it('ticks del eje Y: calco de NumberAxis con tickUnit = max(1, max / 5) entero, de 0 al máximo (1 si es 0) y el máximo siempre', () => {
    expect(ticksEjeY(0)).toEqual([0, 1])
    expect(ticksEjeY(1)).toEqual([0, 1])
    expect(ticksEjeY(3)).toEqual([0, 1, 2, 3])
    expect(ticksEjeY(10)).toEqual([0, 2, 4, 6, 8, 10])
    expect(ticksEjeY(30)).toEqual([0, 6, 12, 18, 24, 30])
    expect(ticksEjeY(101)).toEqual([0, 20, 40, 60, 80, 100, 101])
  })
})
