import { afterEach, describe, expect, it, vi } from 'vitest'
import { conEntorno, esPreproduccion } from './entorno'

afterEach(() => vi.unstubAllEnvs())

describe('entorno', () => {
  it('sin VITE_ENTORNO no es preproducción y el título no cambia', () => {
    vi.stubEnv('VITE_ENTORNO', '')
    expect(esPreproduccion()).toBe(false)
    expect(conEntorno('FSGR')).toBe('FSGR')
  })

  it('con otro valor tampoco es preproducción', () => {
    vi.stubEnv('VITE_ENTORNO', 'produccion')
    expect(esPreproduccion()).toBe(false)
    expect(conEntorno('FSGR')).toBe('FSGR')
  })

  it('con "preproduccion" antepone "[PRE] " al título, una sola vez', () => {
    vi.stubEnv('VITE_ENTORNO', 'preproduccion')
    expect(esPreproduccion()).toBe(true)
    expect(conEntorno('FSGR')).toBe('[PRE] FSGR')
    expect(conEntorno('[PRE] FSGR')).toBe('[PRE] FSGR')
  })
})
