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
import { opcionesTaller } from '../test/fabrica'
import { useCorregirTaller, useOpcionesTaller, useVolverANsys } from './apiNsys'

const IMEI = '350000000000001'

function envoltorio() {
  guardarSesion(SESION_SUPER)
  const qc = crearQueryClient({ retry: false })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><SessionProvider>{children}</SessionProvider></QueryClientProvider>
  )
}

describe('api de la ficha: SKU del taller (spec 0.9.21 §2.3)', () => {
  it('las opciones del diálogo salen de /colores y solo con el diálogo abierto', async () => {
    let pedidas = 0
    server.use(http.get('*/api/stock-telefonos/:imeiSn/colores', () => {
      pedidas++
      return HttpResponse.json(opcionesTaller())
    }))
    const cerrado = renderHook(() => useOpcionesTaller(IMEI, false), { wrapper: envoltorio() })
    expect(cerrado.result.current.fetchStatus).toBe('idle')
    const abierto = renderHook(() => useOpcionesTaller(IMEI, true), { wrapper: envoltorio() })
    await waitFor(() => expect(abierto.result.current.data?.colores).toHaveLength(2))
    expect(pedidas).toBe(1)
  })

  it('corregir manda color, grado y motivo por PUT; volver, el motivo por DELETE', async () => {
    const peticiones: unknown[] = []
    server.use(
      http.put('*/api/stock-telefonos/:imeiSn/taller', async ({ request, params }) => {
        peticiones.push(['PUT', params.imeiSn, await request.json()])
        return new HttpResponse(null, { status: 204 })
      }),
      http.delete('*/api/stock-telefonos/:imeiSn/taller', async ({ request, params }) => {
        peticiones.push(['DELETE', params.imeiSn, await request.json()])
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const corregir = renderHook(() => useCorregirTaller(IMEI), { wrapper: envoltorio() })
    await corregir.result.current.mutateAsync({ color: null, grado: 'A100', motivo: 'batería nueva' })
    const volver = renderHook(() => useVolverANsys(IMEI), { wrapper: envoltorio() })
    await volver.result.current.mutateAsync(null)
    expect(peticiones).toEqual([
      ['PUT', IMEI, { color: null, grado: 'A100', motivo: 'batería nueva' }],
      ['DELETE', IMEI, { motivo: null }],
    ])
  })
})
