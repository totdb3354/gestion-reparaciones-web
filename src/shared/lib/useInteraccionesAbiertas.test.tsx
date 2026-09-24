import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useInteraccionesAbiertas } from './useInteraccionesAbiertas'

describe('useInteraccionesAbiertas', () => {
  it('empieza sin ninguna abierta', () => {
    const { result } = renderHook(() => useInteraccionesAbiertas())
    expect(result.current.hayAlguna).toBe(false)
  })

  it('marcar(true) dos veces y marcar(false) una deja una abierta', () => {
    const { result } = renderHook(() => useInteraccionesAbiertas())
    act(() => {
      result.current.marcar(true)
      result.current.marcar(true)
    })
    expect(result.current.hayAlguna).toBe(true)
    // Es un contador, no un booleano: con un menú y un diálogo abiertos a la vez, cerrar uno NO descongela el
    // sondeo, porque el otro sigue abierto y la recarga le movería la fila bajo el cursor igual.
    act(() => result.current.marcar(false))
    expect(result.current.hayAlguna).toBe(true)
    act(() => result.current.marcar(false))
    expect(result.current.hayAlguna).toBe(false)
  })

  it('nunca baja de cero', () => {
    const { result } = renderHook(() => useInteraccionesAbiertas())
    act(() => {
      result.current.marcar(false)
      result.current.marcar(false)
    })
    expect(result.current.hayAlguna).toBe(false)
    // Lo que protege el suelo: si hubiera quedado en -2, la siguiente apertura real no llegaría a congelar nada.
    act(() => result.current.marcar(true))
    expect(result.current.hayAlguna).toBe(true)
  })

  it('marcar no cambia de identidad entre renders ni al cambiar el contador', () => {
    const { result, rerender } = renderHook(() => useInteraccionesAbiertas())
    const primera = result.current.marcar
    rerender()
    expect(result.current.marcar).toBe(primera)
    // El caso que de verdad importa: subir el contador re-renderiza la página, y varios consumidores
    // (BarraFiltros, MenuAsignacion, useEditores, el diálogo de borrado) llevan `onInteraccion` en las
    // dependencias de su efecto. Si cambiara de identidad, el efecto se rearmaría y el aviso parpadearía.
    act(() => result.current.marcar(true))
    expect(result.current.hayAlguna).toBe(true)
    expect(result.current.marcar).toBe(primera)
  })
})
