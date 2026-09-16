import { describe, expect, it } from 'vitest'
import { canonicalizarImei, estadoFiltroImei, imeisValidos } from './filtroImei'

describe('filtroImei (calco de FiltroImei)', () => {
  it('parte un blob concatenado cada 15', () => {
    expect(canonicalizarImei('352600000000071354700000000091')).toBe('352600000000071, 354700000000091, ')
  })
  it('un IMEI completo añade separador', () => {
    expect(canonicalizarImei('352600000000071')).toBe('352600000000071, ')
  })
  it('un blob con resto deja el resto como token', () => {
    expect(canonicalizarImei('35260000000007135470000000009112')).toBe('352600000000071, 354700000000091, 12')
  })
  it('quita no dígitos y normaliza separadores', () => {
    expect(canonicalizarImei('352-600-000-000-071')).toBe('352600000000071, ')
  })
  it('es idempotente', () => {
    for (const e of ['', '3526', '352600000000071', '352600000000071354700000000091', '35260000000007135470000000009112']) {
      const una = canonicalizarImei(e)
      expect(canonicalizarImei(una)).toBe(una)
    }
  })
  it('vacío o nulo', () => {
    expect(canonicalizarImei('')).toBe('')
    expect(canonicalizarImei(null)).toBe('')
  })
  it('imeisValidos solo los de 15', () => {
    expect(imeisValidos('352600000000071, 354700000000091, 12')).toEqual(new Set(['352600000000071', '354700000000091']))
    expect(imeisValidos('').size).toBe(0)
    expect(imeisValidos('12, 34').size).toBe(0)
  })
  it('estado clasifica', () => {
    expect(estadoFiltroImei('')).toBe('vacio')
    expect(estadoFiltroImei('   ')).toBe('vacio')
    expect(estadoFiltroImei('3526')).toBe('incompleto')
    expect(estadoFiltroImei('352600000000071, 12')).toBe('incompleto')
    expect(estadoFiltroImei('352600000000071, ')).toBe('valido')
    expect(estadoFiltroImei('352600000000071, 354700000000091, ')).toBe('valido')
  })
})
