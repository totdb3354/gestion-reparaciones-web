import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { crearQueryClient } from '@/shared/api/queryClient'
import { guardarSesion } from '@/shared/session/storage'
import { SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { useGuardarPiezasProveedor } from './api'

function envoltorio({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={crearQueryClient({ retry: false })}>{children}</QueryClientProvider>
}

describe('api de Proveedores', () => {
  it('useGuardarPiezasProveedor manda la lista entera con PUT', async () => {
    guardarSesion(SESION_SUPER)
    let cuerpo: unknown = null
    server.use(http.put('*/api/proveedores/:id/componentes', async ({ request, params }) => {
      expect(params.id).toBe('5')
      cuerpo = await request.json()
      return new HttpResponse(null, { status: 204 })
    }))
    const { result } = renderHook(() => useGuardarPiezasProveedor(), { wrapper: envoltorio })
    await act(() => result.current.mutateAsync({ idProv: 5, idsCom: [1, 2] }))
    expect(cuerpo).toEqual({ idsCom: [1, 2] })
  })
})
