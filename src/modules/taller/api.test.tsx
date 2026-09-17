import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { StaleDataError } from '@/shared/api/errors'
import { crearQueryClient } from '@/shared/api/queryClient'
import { SessionProvider } from '@/shared/session/SessionProvider'
import { guardarSesion } from '@/shared/session/storage'
import { server } from '@/test/server'
import { SESION_SUPER, SESION_TEC } from '@/test/render'
import { useAsignaciones, useContadoresPendientes, useEditarObservacionTelefono, useHistorial, usePorCerrar } from './api'

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
  it('los contadores piden sin ?tecnico= para el técnico y con su idTec para el supertécnico', async () => {
    const urls: string[] = []
    server.use(
      http.get('*/api/reparaciones/pendientes/contadores', ({ request }) => {
        urls.push(new URL(request.url).search)
        return HttpResponse.json({ reparaciones: 0, glass: 0, pulidos: 0 })
      }),
    )
    const tec = renderHook(() => useContadoresPendientes(), { wrapper: envoltorio(SESION_TEC) })
    await waitFor(() => expect(tec.result.current.isSuccess).toBe(true))
    const sup = renderHook(() => useContadoresPendientes(), { wrapper: envoltorio(SESION_SUPER) })
    await waitFor(() => expect(sup.result.current.isSuccess).toBe(true))
    expect(urls).toEqual(['', '?tecnico=3'])
  })
  it('una acción de Pendientes invalida la lista y los contadores', async () => {
    let contadores = 0
    let lista = 0
    server.use(
      http.get('*/api/reparaciones/asignaciones', () => { lista++; return HttpResponse.json([]) }),
      http.get('*/api/reparaciones/pendientes/contadores', () => { contadores++; return HttpResponse.json({ reparaciones: 1, glass: 0, pulidos: 0 }) }),
      http.patch('*/api/reparaciones/asignaciones/A1/por-cerrar', () => new HttpResponse(null, { status: 204 })),
    )
    const wrapper = envoltorio(SESION_TEC)
    const a = renderHook(() => useAsignaciones('REPARACION'), { wrapper })
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true))
    const c = renderHook(() => useContadoresPendientes(), { wrapper })
    await waitFor(() => expect(c.result.current.isSuccess).toBe(true))
    const m = renderHook(() => usePorCerrar(), { wrapper })
    await m.result.current.mutateAsync({ idRep: 'A1', porCerrar: true })
    await waitFor(() => expect(contadores).toBe(2))
    await waitFor(() => expect(lista).toBe(2))
  })
  it('el aviso de un guardado fallido (el onError de mutate) no espera a que se recarguen los historiales', async () => {
    let peticiones = 0
    let soltarRecarga!: () => void
    const recargaRetenida = new Promise<void>((resolver) => { soltarRecarga = resolver })
    server.use(
      // La primera carga responde en el acto; la recarga que lanza la mutación se queda colgada hasta el final del test.
      http.get('*/api/reparaciones/historial', async () => { peticiones++; if (peticiones > 1) await recargaRetenida; return HttpResponse.json([]) }),
      http.patch('*/api/telefonos/350000000000011/observacion', () => HttpResponse.json({ message: 'modificado' }, { status: 409 })),
    )
    const wrapper = envoltorio(SESION_SUPER)
    const historial = renderHook(() => useHistorial('REPARACION'), { wrapper })
    await waitFor(() => expect(historial.result.current.isSuccess).toBe(true))
    const editar = renderHook(() => useEditarObservacionTelefono(), { wrapper })
    const alFallar = vi.fn()
    act(() => editar.result.current.mutate({ imei: '350000000000011', observacion: 'nota', updatedAt: '2026-01-01T09:00:00' }, { onError: alFallar }))
    // La recarga no puede terminar hasta soltarRecarga(): si el aviso llega antes, no la ha esperado.
    await waitFor(() => expect(alFallar).toHaveBeenCalledTimes(1))
    expect(alFallar.mock.calls[0][0]).toBeInstanceOf(StaleDataError)
    // Y la recarga sí se lanzó (si no, el test pasaría sin probar nada).
    await waitFor(() => expect(peticiones).toBe(2))
    soltarRecarga()
    await waitFor(() => expect(historial.result.current.isFetching).toBe(false))
  })
})
