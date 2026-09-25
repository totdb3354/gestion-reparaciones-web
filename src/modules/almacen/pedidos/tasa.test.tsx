import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { crearQueryClient } from '@/shared/api/queryClient'
import { server } from '@/test/server'
import { useTasa, useTasas } from './tasa'

function envoltorio() {
  const qc = crearQueryClient({ retry: false })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}

describe('tasa de cambio (GET /api/tipo-cambio/{divisa}, spec 4b §5)', () => {
  it('EUR: tasa 1 al momento, sin consulta ni petición', () => {
    const { qc, wrapper } = envoltorio()
    const { result } = renderHook(() => useTasas(['EUR']), { wrapper })
    expect(result.current).toEqual({ EUR: { tasa: 1, cargando: false, error: false } })
    expect(qc.getQueryCache().findAll({ queryKey: ['tipo-cambio'] })).toHaveLength(0)
  })
  it('USD: lee `value` con una sola petición aunque la divisa se repita', async () => {
    let peticiones = 0
    server.use(http.get('*/api/tipo-cambio/USD', () => { peticiones += 1; return HttpResponse.json({ value: 1.1367 }) }))
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useTasas(['USD', 'EUR', 'USD']), { wrapper })
    expect(result.current.USD).toEqual({ tasa: null, cargando: true, error: false })
    await waitFor(() => expect(result.current.USD).toEqual({ tasa: 1.1367, cargando: false, error: false }))
    expect(result.current.EUR).toEqual({ tasa: 1, cargando: false, error: false })
    expect(peticiones).toBe(1)
  })
  it('si falla (503 del servidor), error: true y sin tasa; no reintenta', async () => {
    let peticiones = 0
    server.use(http.get('*/api/tipo-cambio/USD', () => { peticiones += 1; return HttpResponse.json({ message: 'No se pudo obtener el tipo de cambio de USD. Inténtalo de nuevo.' }, { status: 503 }) }))
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useTasas(['USD']), { wrapper })
    await waitFor(() => expect(result.current.USD).toEqual({ tasa: null, cargando: false, error: true }))
    expect(peticiones).toBe(1)
  })
  it('useTasa: null cuenta como EUR; con divisa, el estado de esa divisa', async () => {
    server.use(http.get('*/api/tipo-cambio/USD', () => HttpResponse.json({ value: 1.1367 })))
    const { wrapper } = envoltorio()
    const { result: sinDivisa } = renderHook(() => useTasa(null), { wrapper })
    expect(sinDivisa.current).toEqual({ tasa: 1, cargando: false, error: false })
    const { result: usd } = renderHook(() => useTasa('USD'), { wrapper })
    await waitFor(() => expect(usd.current.tasa).toBe(1.1367))
  })
})
