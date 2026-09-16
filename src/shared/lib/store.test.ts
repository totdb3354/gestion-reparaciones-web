import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { crearStore, useStore } from './store'

describe('crearStore', () => {
  it('guarda, notifica y reinicia', () => {
    const s = crearStore('')
    let avisos = 0
    const off = s.subscribe(() => avisos++)
    s.set('35')
    expect(s.get()).toBe('35')
    s.set((prev) => prev + '2')
    expect(s.get()).toBe('352')
    expect(avisos).toBe(2)
    s.reset()
    expect(s.get()).toBe('')
    off()
    s.set('x')
    expect(avisos).toBe(3)
  })
  it('useStore sigue el valor y expone el setter', () => {
    const s = crearStore(new Set<string>())
    const { result } = renderHook(() => useStore(s))
    expect(result.current[0].size).toBe(0)
    act(() => result.current[1](new Set(['a'])))
    expect(result.current[0].has('a')).toBe(true)
  })
})
