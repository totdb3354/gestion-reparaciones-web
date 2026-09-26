import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLAVE_TEXTO, aplicarTextoGuardado, useTextoGrande } from './useTextoGrande'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  delete document.documentElement.dataset.texto
})

describe('useTextoGrande', () => {
  it('marcar pone data-texto="grande" en <html> y lo guarda; desmarcar quita ambos', () => {
    const { result } = renderHook(() => useTextoGrande())
    expect(result.current[0]).toBe(false)
    act(() => result.current[1](true))
    expect(result.current[0]).toBe(true)
    expect(document.documentElement).toHaveAttribute('data-texto', 'grande')
    expect(localStorage.getItem(CLAVE_TEXTO)).toBe('grande')
    expect(CLAVE_TEXTO).toBe('fsgr.texto')
    act(() => result.current[1](false))
    expect(result.current[0]).toBe(false)
    expect(document.documentElement).not.toHaveAttribute('data-texto')
    expect(localStorage.getItem(CLAVE_TEXTO)).toBeNull()
  })

  it('arranca con el estado del atributo de <html> (ya aplicado al arrancar la app)', () => {
    document.documentElement.dataset.texto = 'grande'
    const { result } = renderHook(() => useTextoGrande())
    expect(result.current[0]).toBe(true)
  })

  it('un storage roto no rompe: el cambio se aplica igual en la sesión', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('bloqueado') })
    const { result } = renderHook(() => useTextoGrande())
    act(() => result.current[1](true))
    expect(result.current[0]).toBe(true)
    expect(document.documentElement).toHaveAttribute('data-texto', 'grande')
    act(() => result.current[1](false))
    expect(document.documentElement).not.toHaveAttribute('data-texto')
  })
})

describe('aplicarTextoGuardado', () => {
  it('aplica lo guardado al arrancar', () => {
    localStorage.setItem(CLAVE_TEXTO, 'grande')
    aplicarTextoGuardado()
    expect(document.documentElement).toHaveAttribute('data-texto', 'grande')
  })

  it('sin nada guardado no pone el atributo', () => {
    aplicarTextoGuardado()
    expect(document.documentElement).not.toHaveAttribute('data-texto')
  })

  it('con el storage roto no lanza y no pone el atributo', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado') })
    expect(() => aplicarTextoGuardado()).not.toThrow()
    expect(document.documentElement).not.toHaveAttribute('data-texto')
  })
})
