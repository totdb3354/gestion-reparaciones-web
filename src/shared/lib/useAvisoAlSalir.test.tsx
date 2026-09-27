import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { avisaAlSalir } from '@/test/avisoAlSalir'
import { useAvisoAlSalir } from './useAvisoAlSalir'

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
})
