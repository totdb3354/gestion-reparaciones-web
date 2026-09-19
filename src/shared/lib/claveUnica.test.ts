import { afterEach, describe, expect, it, vi } from 'vitest'
import { claveUnica } from './claveUnica'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

afterEach(() => {
  vi.restoreAllMocks()
  // vi.restoreAllMocks() no deshace vi.stubGlobal: sin esto, el `crypto` con stub de un test seguiría vigente
  // en el siguiente (aquí no importaría, pero en cualquier otro fichero que corra después en el mismo worker sí).
  vi.unstubAllGlobals()
})

describe('claveUnica', () => {
  it('devuelve un UUID v4', () => {
    expect(claveUnica()).toMatch(V4)
  })
  it('dos llamadas dan valores distintos', () => {
    expect(claveUnica()).not.toBe(claveUnica())
  })
  it('sin randomUUID (stub), la compone con getRandomValues y sigue dando un UUID v4', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    expect(claveUnica()).toMatch(V4)
    expect(claveUnica()).not.toBe(claveUnica())
  })
})
