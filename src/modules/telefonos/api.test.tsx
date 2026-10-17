import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { crearQueryClient } from '@/shared/api/queryClient'
import { SessionProvider } from '@/shared/session/SessionProvider'
import { guardarSesion } from '@/shared/session/storage'
import { server } from '@/test/server'
import { SESION_SUPER } from '@/test/render'
import { useBuscarMoviles } from '@/shared/api/nsys'
import { useEstadoNsys, useStockTelefonos } from './api'
import { estadoNsys, movil } from './test/fabrica'

function envoltorio() {
  guardarSesion(SESION_SUPER)
  const qc = crearQueryClient({ retry: false })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><SessionProvider>{children}</SessionProvider></QueryClientProvider>
  )
}

describe('api del stock de teléfonos', () => {
  it('pide el stock y el estado de NSYS', async () => {
    server.use(
      http.get('*/api/stock-telefonos', () => HttpResponse.json([movil()])),
      http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    )
    const stock = renderHook(() => useStockTelefonos(), { wrapper: envoltorio() })
    await waitFor(() => expect(stock.result.current.data).toHaveLength(1))
    const estado = renderHook(() => useEstadoNsys(), { wrapper: envoltorio() })
    await waitFor(() => expect(estado.result.current.data?.nivel).toBe('OK'))
  })

  it('el buscador no pregunta con menos de 4 caracteres y manda el texto sin espacios', async () => {
    const pedidas: string[] = []
    server.use(http.get('*/api/stock-telefonos/buscar', ({ request }) => {
      pedidas.push(new URL(request.url).searchParams.get('imei') ?? '')
      return HttpResponse.json([])
    }))
    const corto = renderHook(() => useBuscarMoviles('350'), { wrapper: envoltorio() })
    expect(corto.result.current.fetchStatus).toBe('idle')
    const largo = renderHook(() => useBuscarMoviles(' 3500 '), { wrapper: envoltorio() })
    await waitFor(() => expect(largo.result.current.isSuccess).toBe(true))
    expect(pedidas).toEqual(['3500'])
  })
})
