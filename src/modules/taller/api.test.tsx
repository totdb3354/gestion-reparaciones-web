import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { crearQueryClient } from '@/shared/api/queryClient'
import { SessionProvider } from '@/shared/session/SessionProvider'
import { guardarSesion } from '@/shared/session/storage'
import { server } from '@/test/server'
import { SESION_SUPER, SESION_TEC } from '@/test/render'
import { useAsignaciones, useContadoresPendientes, usePorCerrar } from './api'

function envoltorio(sesion: typeof SESION_TEC) {
  guardarSesion(sesion)
  const qc = crearQueryClient({ retry: false })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><SessionProvider>{children}</SessionProvider></QueryClientProvider>
  )
}

describe('api del taller', () => {
  it('el técnico pide sus asignaciones sin ?tecnico= y el supertécnico con su idTec', async () => {
    const urls: string[] = []
    server.use(http.get('*/api/glass/asignaciones', ({ request }) => { urls.push(new URL(request.url).search); return HttpResponse.json([]) }))
    const tec = renderHook(() => useAsignaciones('GLASS'), { wrapper: envoltorio(SESION_TEC) })
    await waitFor(() => expect(tec.result.current.isSuccess).toBe(true))
    const sup = renderHook(() => useAsignaciones('GLASS'), { wrapper: envoltorio(SESION_SUPER) })
    await waitFor(() => expect(sup.result.current.isSuccess).toBe(true))
    expect(urls).toEqual(['', '?tecnico=3'])
  })
  it('una acción de Pendientes invalida la lista y los contadores', async () => {
    let contadores = 0
    server.use(
      http.get('*/api/reparaciones/asignaciones', () => HttpResponse.json([])),
      http.get('*/api/reparaciones/pendientes/contadores', () => { contadores++; return HttpResponse.json({ reparaciones: 1, glass: 0, pulidos: 0 }) }),
      http.patch('*/api/reparaciones/asignaciones/A1/por-cerrar', () => new HttpResponse(null, { status: 204 })),
    )
    const wrapper = envoltorio(SESION_TEC)
    const c = renderHook(() => useContadoresPendientes(), { wrapper })
    await waitFor(() => expect(c.result.current.isSuccess).toBe(true))
    const m = renderHook(() => usePorCerrar(), { wrapper })
    await m.result.current.mutateAsync({ idRep: 'A1', porCerrar: true })
    await waitFor(() => expect(contadores).toBe(2))
  })
})
