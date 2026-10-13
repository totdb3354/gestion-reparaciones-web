import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLAVE_PLEGADA, guardarPlegada, leerPlegada } from './preferencias'

describe('preferencia de la columna lateral plegada (0.9.10)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sin nada guardado, abierta', () => {
    expect(leerPlegada()).toBe(false)
  })

  it('guarda «si» y «no» y los lee', () => {
    guardarPlegada(true)
    expect(localStorage.getItem(CLAVE_PLEGADA)).toBe('si')
    expect(leerPlegada()).toBe(true)
    guardarPlegada(false)
    expect(localStorage.getItem(CLAVE_PLEGADA)).toBe('no')
    expect(leerPlegada()).toBe(false)
  })

  it('si no se puede leer (modo privado, almacenamiento bloqueado), abierta', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('almacenamiento bloqueado')
    })
    expect(leerPlegada()).toBe(false)
  })

  it('si no se puede guardar, no rompe', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('almacenamiento bloqueado')
    })
    expect(() => guardarPlegada(true)).not.toThrow()
  })
})
