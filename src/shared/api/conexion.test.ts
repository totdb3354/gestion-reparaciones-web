import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { estaConectado, intervaloRefresco, reportarExito, reportarFallo, useConexion } from './conexion'

describe('estado de conexión', () => {
  beforeEach(() => reportarExito())
  it('empieza conectado y el intervalo es de 60 s', () => {
    expect(estaConectado()).toBe(true)
    expect(intervaloRefresco()).toBe(60_000)
  })
  it('un fallo lo pone desconectado (5 s) y un éxito lo autocura', () => {
    reportarFallo()
    expect(estaConectado()).toBe(false)
    expect(intervaloRefresco()).toBe(5_000)
    reportarExito()
    expect(estaConectado()).toBe(true)
  })
  it('useConexion se actualiza al cambiar el estado', () => {
    const { result } = renderHook(() => useConexion())
    expect(result.current).toBe(true)
    act(() => reportarFallo())
    expect(result.current).toBe(false)
  })
})
