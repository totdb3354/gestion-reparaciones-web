import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dispararSesionExpirada, onSesionExpirada } from '@/shared/session/expiracion'
import { borrarSesion, guardarSesion } from '@/shared/session/storage'
import { avisaAlSalir } from '@/test/avisoAlSalir'
import { useAvisoAlSalir } from './useAvisoAlSalir'

beforeEach(() => {
  guardarSesion({ idUsu: 1, nombreUsuario: 'usuario-a', rol: 'TECNICO', idTec: 1, token: 'jwt' })
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAvisoAlSalir', () => {
  it('sin cambios no registra nada y salir no pregunta', () => {
    const alta = vi.spyOn(window, 'addEventListener')
    renderHook(() => useAvisoAlSalir(false))
    expect(alta.mock.calls.filter(([tipo]) => tipo === 'beforeunload')).toHaveLength(0)
    expect(avisaAlSalir()).toBe(false)
  })

  it('con cambios registra el listener y salir pregunta', () => {
    renderHook(() => useAvisoAlSalir(true))
    expect(avisaAlSalir()).toBe(true)
  })

  it('al quedarse sin cambios, y al desmontar, retira el listener', () => {
    const baja = vi.spyOn(window, 'removeEventListener')
    const { rerender, unmount } = renderHook(({ hay }) => useAvisoAlSalir(hay), { initialProps: { hay: true } })
    expect(avisaAlSalir()).toBe(true)
    rerender({ hay: false })
    expect(baja.mock.calls.filter(([tipo]) => tipo === 'beforeunload')).toHaveLength(1)
    expect(avisaAlSalir()).toBe(false)
    rerender({ hay: true })
    expect(avisaAlSalir()).toBe(true)
    unmount()
    expect(avisaAlSalir()).toBe(false)
  })

  it('la salida por sesión caducada no se para en el aviso aunque haya cambios', () => {
    const assign = vi.fn()
    // El mismo handler que registra main.tsx: borra la sesión y sale a /login. La salida se simula con el beforeunload.
    const quitar = onSesionExpirada(() => {
      borrarSesion()
      assign('/login')
    })
    renderHook(() => useAvisoAlSalir(true))
    expect(avisaAlSalir()).toBe(true)
    dispararSesionExpirada()
    expect(assign).toHaveBeenCalledWith('/login')
    expect(avisaAlSalir()).toBe(false)
    quitar()
  })

  it('si la sesión se cierra en otra pestaña (se borra la sesión compartida), salir no pregunta', () => {
    renderHook(() => useAvisoAlSalir(true))
    expect(avisaAlSalir()).toBe(true)
    localStorage.removeItem('fsgr.sesion')
    expect(avisaAlSalir()).toBe(false)
  })
})
