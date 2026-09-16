import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { reportarExito, reportarFallo } from './conexion'
import { INTERVALO_CONECTADO_MS, INTERVALO_DESCONECTADO_MS, useIntervaloRefresco } from './refresco'

describe('useIntervaloRefresco (calco de Poller.java)', () => {
  it('60 s conectado, 5 s con el banner activo, false si la vista no sondea', () => {
    reportarExito()
    const { result } = renderHook(() => useIntervaloRefresco())
    expect(result.current).toBe(INTERVALO_CONECTADO_MS)
    expect(INTERVALO_CONECTADO_MS).toBe(60_000)
    act(() => reportarFallo())
    expect(result.current).toBe(INTERVALO_DESCONECTADO_MS)
    expect(INTERVALO_DESCONECTADO_MS).toBe(5_000)
    act(() => reportarExito())
    const sinSondeo = renderHook(() => useIntervaloRefresco(false))
    expect(sinSondeo.result.current).toBe(false)
  })
})
