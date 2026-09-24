import { describe, expect, it } from 'vitest'
import type { Componente } from '@/shared/api/client'
import { aplicarFiltrosStock, FILTROS_STOCK_VACIOS, nombreComponente, ordenarStock, textoDesactivados } from './filtros'

const base: Componente = { idCom: 1, tipo: 'lcd-x', fechaRegistro: '2026-09-01T10:00:00', stock: 5, stockMinimo: 2, activo: true, updatedAt: '2026-09-01T10:00:00', enCamino: 0, ultimoPedido: null, idComMaster: null }
const c = (o: Partial<Componente>): Componente => ({ ...base, ...o })
const ok = c({ idCom: 1, tipo: 'lcd-x' })
const bajo = c({ idCom: 2, tipo: 'bat-x', stock: 2 })
const sinStock = c({ idCom: 3, tipo: 'cam-x', stock: 0 })
const desactivado = c({ idCom: 4, tipo: 'mc-x', activo: false })

describe('ordenarStock', () => {
  it('activos primero, desactivados al final, sin reordenar dentro de cada grupo (calco :477)', () => {
    expect(ordenarStock([desactivado, bajo, ok, sinStock]).map((x) => x.idCom)).toEqual([2, 1, 3, 4])
  })
})

describe('aplicarFiltrosStock', () => {
  const todos = [ok, bajo, sinStock, desactivado]
  it('sin ningún estado marcado muestra todos', () => {
    expect(aplicarFiltrosStock(todos, FILTROS_STOCK_VACIOS)).toHaveLength(4)
  })
  it('varios estados se combinan con O', () => {
    const f = { ...FILTROS_STOCK_VACIOS, estados: new Set(['Bajo', 'Sin stock'] as const) }
    expect(aplicarFiltrosStock(todos, f).map((x) => x.tipo)).toEqual(['bat-x', 'cam-x'])
  })
  it('el buscador es "contiene", sin mayúsculas, recortado y sobre el tipo sin el sufijo (compartido)', () => {
    const compartido = c({ idCom: 5, tipo: 'lcd-y', idComMaster: 1 })
    expect(aplicarFiltrosStock([...todos, compartido], { ...FILTROS_STOCK_VACIOS, buscador: '  LCD ' }).map((x) => x.tipo)).toEqual(['lcd-x', 'lcd-y'])
    expect(aplicarFiltrosStock([compartido], { ...FILTROS_STOCK_VACIOS, buscador: 'compartido' })).toHaveLength(0)
  })
  it('estado y buscador se combinan con Y', () => {
    const f = { estados: new Set(['OK'] as const), buscador: 'bat' }
    expect(aplicarFiltrosStock(todos, f)).toHaveLength(0)
  })
})

describe('textos', () => {
  it('pie de desactivados: nada con 0, singular con 1, plural con más', () => {
    expect(textoDesactivados(0)).toBeNull()
    expect(textoDesactivados(1)).toBe('1 desactivado')
    expect(textoDesactivados(3)).toBe('3 desactivados')
  })
  it('nombre con el sufijo "(compartido)" de dos espacios', () => {
    expect(nombreComponente({ tipo: 'lcd-y', idComMaster: 1 })).toBe('lcd-y  (compartido)')
    expect(nombreComponente({ tipo: 'lcd-x', idComMaster: null })).toBe('lcd-x')
  })
})
