import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { crearQueryClient } from '@/shared/api/queryClient'
import { guardarSesion } from '@/shared/session/storage'
import { SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { pedirCantidadEnCamino, useComponentesStock, useEditarStock } from './api'

const base = { fechaRegistro: '2026-09-01T10:00:00', stockMinimo: 2, updatedAt: '2026-09-01T10:00:00', enCamino: 0, ultimoPedido: null, idComMaster: null }

function envoltorio() {
  const qc = crearQueryClient({ retry: false })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}

describe('api de Stock', () => {
  it('useComponentesStock devuelve los gestionados con los activos primero', async () => {
    guardarSesion(SESION_SUPER)
    server.use(http.get('*/api/componentes/gestionados', () => HttpResponse.json([
      { ...base, idCom: 4, tipo: 'mc-x', stock: 1, activo: false },
      { ...base, idCom: 1, tipo: 'lcd-x', stock: 5, activo: true },
    ])))
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useComponentesStock({ activo: true }), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.map((c) => c.idCom)).toEqual([1, 4])
  })
  it('pedirCantidadEnCamino lee el value tipado', async () => {
    guardarSesion(SESION_SUPER)
    server.use(http.get('*/api/compras/cantidad-en-camino/12', () => HttpResponse.json({ value: 7 })))
    expect(await pedirCantidadEnCamino(12)).toBe(7)
  })
  it('useEditarStock manda tipo, stock, stockMinimo y updatedAt tal cual, e invalida los componentes y la campana', async () => {
    guardarSesion(SESION_SUPER)
    let cuerpo: unknown = null
    server.use(http.put('*/api/componentes/1', async ({ request }) => { cuerpo = await request.json(); return new HttpResponse(null, { status: 200 }) }))
    const { qc, wrapper } = envoltorio()
    qc.setQueryData(['componentes', 'gestionados'], [])
    qc.setQueryData(['notificaciones', 'componentes'], [])
    const { result } = renderHook(() => useEditarStock(), { wrapper })
    const c = { ...base, idCom: 1, tipo: 'lcd-x', stock: 5, activo: true }
    await result.current.mutateAsync({ c, stock: 9 })
    expect(cuerpo).toEqual({ tipo: 'lcd-x', stock: 9, stockMinimo: 2, updatedAt: '2026-09-01T10:00:00' })
    expect(qc.getQueryState(['componentes', 'gestionados'])?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['notificaciones', 'componentes'])?.isInvalidated).toBe(true)
  })
})
