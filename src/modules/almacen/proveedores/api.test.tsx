import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { crearQueryClient } from '@/shared/api/queryClient'
import { guardarSesion } from '@/shared/session/storage'
import { SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { useGuardarPiezasProveedor, usePiezasProveedor } from './api'

function envoltorio({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={crearQueryClient({ retry: false })}>{children}</QueryClientProvider>
}

describe('api de Proveedores', () => {
  it('usePiezasProveedor lee los tipos del proveedor', async () => {
    guardarSesion(SESION_SUPER)
    server.use(http.get('*/api/proveedores/:id/piezas', ({ params }) => {
      expect(params.id).toBe('5')
      return HttpResponse.json([{ prefijo: 'bat', vende: true, modelos: ['12'], excluidos: [] }])
    }))
    const { result } = renderHook(() => usePiezasProveedor(5), { wrapper: envoltorio })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ prefijo: 'bat', vende: true, modelos: ['12'], excluidos: [] }])
  })

  it('useGuardarPiezasProveedor manda los tipos con PUT', async () => {
    guardarSesion(SESION_SUPER)
    let cuerpo: unknown = null
    server.use(http.put('*/api/proveedores/:id/piezas', async ({ request, params }) => {
      expect(params.id).toBe('5')
      cuerpo = await request.json()
      return new HttpResponse(null, { status: 204 })
    }))
    const { result } = renderHook(() => useGuardarPiezasProveedor(), { wrapper: envoltorio })
    await act(() => result.current.mutateAsync({ idProv: 5, cuerpo: { tipos: [{ prefijo: 'g', excluidos: ['12mini'] }] } }))
    expect(cuerpo).toEqual({ tipos: [{ prefijo: 'g', excluidos: ['12mini'] }] })
  })
})
