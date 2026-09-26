import { focusManager, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { LogActividad } from '@/shared/api/client'
import { PermisoError } from '@/shared/api/errors'
import { crearQueryClient } from '@/shared/api/queryClient'
import { server } from '@/test/server'
import { CLAVE_ACCIONES_LOG, CLAVE_LOGS, useAccionesLog, useLogs } from './api'
import type { QueryLogs } from './filtros'

const LOG: LogActividad = {
  idLog: 1, fecha: '2026-09-25T08:15:30', nombreUsuario: 'usuario-a', accion: 'LOGIN', detalle: '', motivo: null,
}

function envoltorio() {
  const qc = crearQueryClient({ retry: false })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}

/** Parámetros de cada GET /api/logs, como objeto plano (en el orden en que llegan). */
function registrarLogs(respuesta: () => Response = () => HttpResponse.json([LOG])) {
  const peticiones: Record<string, string>[] = []
  server.use(
    http.get('*/api/logs', ({ request }) => {
      // Sin `Object.fromEntries(searchParams)`: el `lib` de tsconfig.app.json no trae DOM.Iterable (tsc -b daría TS2769).
      const params: Record<string, string> = {}
      new URL(request.url).searchParams.forEach((valor, clave) => { params[clave] = valor })
      peticiones.push(params)
      return respuesta()
    }),
  )
  return peticiones
}

afterEach(() => {
  focusManager.setFocused(undefined)
})

describe('useLogs (GET /api/logs, contrato getAll_6)', () => {
  it('manda limite, accion, tecnico, desde y hasta con los nombres del contrato', async () => {
    const peticiones = registrarLogs()
    const { wrapper } = envoltorio()
    const q: QueryLogs = { limite: 1000, accion: 'LOGIN', tecnico: 'usuario-a', desde: '2026-09-01', hasta: '2026-09-26' }
    const { result } = renderHook(() => useLogs(q), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual([LOG]))
    expect(peticiones).toEqual([{ limite: '1000', accion: 'LOGIN', tecnico: 'usuario-a', desde: '2026-09-01', hasta: '2026-09-26' }])
  })
  it('sin filtros solo manda el límite; cambiar un filtro cambia la clave y relanza la carga', async () => {
    const peticiones = registrarLogs()
    const { qc, wrapper } = envoltorio()
    const { result, rerender } = renderHook(({ q }: { q: QueryLogs }) => useLogs(q), { wrapper, initialProps: { q: { limite: 1000 } as QueryLogs } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    rerender({ q: { limite: 1000, accion: 'LOGIN' } })
    await waitFor(() => expect(peticiones).toHaveLength(2))
    expect(peticiones).toEqual([{ limite: '1000' }, { limite: '1000', accion: 'LOGIN' }])
    expect(qc.getQueryCache().find({ queryKey: [...CLAVE_LOGS, { limite: 1000, accion: 'LOGIN' }] })).toBeDefined()
  })
  it('un error queda en la consulta sin diálogo genérico (la página pone su propio texto)', async () => {
    registrarLogs(() => new HttpResponse(null, { status: 403 }))
    const { qc, wrapper } = envoltorio()
    const { result } = renderHook(() => useLogs({ limite: 1000 }), { wrapper })
    await waitFor(() => expect(result.current.error).toBeInstanceOf(PermisoError))
    expect(qc.getQueryCache().find({ queryKey: [...CLAVE_LOGS, { limite: 1000 }] })?.meta).toEqual({ silenciarError: true })
  })
  it('no recarga al volver a la pestaña (sin refresco automático, spec §7)', async () => {
    const peticiones = registrarLogs()
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useLogs({ limite: 1000 }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await new Promise((r) => setTimeout(r, 30))
    expect(peticiones).toHaveLength(1)
  })
})

describe('useAccionesLog (GET /api/logs/acciones, G4)', () => {
  it('lee la lista de acciones del servidor tal cual, bajo su propia clave y silenciada', async () => {
    let pedidas = 0
    server.use(http.get('*/api/logs/acciones', () => { pedidas++; return HttpResponse.json(['CREAR_ASIGNACION', 'LOGIN']) }))
    const { qc, wrapper } = envoltorio()
    const { result } = renderHook(() => useAccionesLog(), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual(['CREAR_ASIGNACION', 'LOGIN']))
    expect(pedidas).toBe(1)
    expect(qc.getQueryCache().find({ queryKey: CLAVE_ACCIONES_LOG })?.meta).toEqual({ silenciarError: true })
  })
})
