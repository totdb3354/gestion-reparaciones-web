import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { ReglaNegocioError } from '@/shared/api/errors'
import { crearQueryClient } from '@/shared/api/queryClient'
import { server } from '@/test/server'
import { useCambiarPassword } from './api'

function envoltorio() {
  const qc = crearQueryClient({ retry: false })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}

describe('useCambiarPassword (PATCH /api/auth/cambiar-password)', () => {
  it('manda {passwordActual, passwordNueva} y un 204 es éxito', async () => {
    const peticiones: { metodo: string; cuerpo: unknown }[] = []
    server.use(
      http.patch('*/api/auth/cambiar-password', async ({ request }) => {
        peticiones.push({ metodo: request.method, cuerpo: await request.json() })
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useCambiarPassword(), { wrapper })
    result.current.mutate({ passwordActual: 'secreta1', passwordNueva: 'nueva123' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(peticiones).toEqual([{ metodo: 'PATCH', cuerpo: { passwordActual: 'secreta1', passwordNueva: 'nueva123' } }])
  })
  it('un 422 llega como ReglaNegocioError con el message del servidor y la mutación va silenciada', async () => {
    server.use(http.patch('*/api/auth/cambiar-password', () => HttpResponse.json({ message: 'Contraseña actual incorrecta.' }, { status: 422 })))
    const { qc, wrapper } = envoltorio()
    const { result } = renderHook(() => useCambiarPassword(), { wrapper })
    result.current.mutate({ passwordActual: 'mala123', passwordNueva: 'nueva123' })
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ReglaNegocioError))
    expect(result.current.error?.message).toBe('Contraseña actual incorrecta.')
    expect(qc.getMutationCache().getAll()[0].meta).toEqual({ silenciarError: true })
  })
})
