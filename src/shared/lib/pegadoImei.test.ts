import { describe, expect, it } from 'vitest'
import { parsearPegadoImeis } from './pegadoImei'

describe('parsearPegadoImeis (port de ImeiUtils)', () => {
  it('incompleto si menos de 15', () => {
    expect(parsearPegadoImeis('12345')).toEqual({ tipo: 'INCOMPLETO', imeis: [] })
  })
  it('único si exactamente 15', () => {
    expect(parsearPegadoImeis('111111111111111')).toEqual({ tipo: 'UNICO', imeis: ['111111111111111'] })
  })
  it('lote si múltiplo de 15', () => {
    expect(parsearPegadoImeis('111111111111111222222222222222')).toEqual({
      tipo: 'LOTE', imeis: ['111111111111111', '222222222222222'],
    })
  })
  it('corrupto si mayor de 15 y no múltiplo', () => {
    expect(parsearPegadoImeis('1111111111111113').tipo).toBe('CORRUPTO')
    expect(parsearPegadoImeis('3'.repeat(31)).tipo).toBe('CORRUPTO')
    expect(parsearPegadoImeis('3'.repeat(16)).imeis).toEqual([])
  })
  it('quita separadores y no dígitos', () => {
    const r = parsearPegadoImeis('111111111111111\n222222222222222')
    expect(r.tipo).toBe('LOTE')
    expect(r.imeis).toHaveLength(2)
  })
  it('vacío o null es incompleto', () => {
    expect(parsearPegadoImeis('').tipo).toBe('INCOMPLETO')
    expect(parsearPegadoImeis(null).tipo).toBe('INCOMPLETO')
  })
})
