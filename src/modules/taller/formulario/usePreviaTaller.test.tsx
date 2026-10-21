import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { PeticionPreviaTaller } from '@/shared/api/client'
import { crearQueryClient } from '@/shared/api/queryClient'
import { SessionProvider } from '@/shared/session/SessionProvider'
import { guardarSesion } from '@/shared/session/storage'
import { onError } from '@/shared/ui/alertas'
import { server } from '@/test/server'
import { SESION_TEC } from '@/test/render'
import { previaTaller } from '../test/fabrica'
import { usePreviaTaller } from './usePreviaTaller'

const IMEI = '355400000000111'
const BATERIA: PeticionPreviaTaller = { imei: IMEI, filas: [{ idRep: null, idCom: 101, reutilizada: false }] }
const CHASIS: PeticionPreviaTaller = { imei: IMEI, filas: [{ idRep: null, idCom: 131, reutilizada: true }] }
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

function envoltorio() {
  guardarSesion(SESION_TEC)
  const qc = crearQueryClient({ retry: false })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><SessionProvider>{children}</SessionProvider></QueryClientProvider>
  )
}

/** Responde con `respuesta` y apunta los cuerpos que llegan. */
function servir(respuesta: () => Response): unknown[] {
  const cuerpos: unknown[] = []
  server.use(http.post('*/api/reparaciones/sku-taller/previsualizar', async ({ request }) => {
    cuerpos.push(await request.json())
    return respuesta()
  }))
  return cuerpos
}

describe('usePreviaTaller (spec 0.9.21 pieza 2 §2.4)', () => {
  it('pide la previa con las filas y devuelve lo que dice el servidor', async () => {
    const cuerpos = servir(() => HttpResponse.json(previaTaller({ despues: { color: 'Azul', grado: 'B100' } })))
    const { result } = renderHook(() => usePreviaTaller(BATERIA, 0), { wrapper: envoltorio() })
    await waitFor(() => expect(result.current?.despues.grado).toBe('B100'))
    expect(cuerpos).toEqual([BATERIA])
  })

  it('sin filas que cuenten no pide nada', async () => {
    const cuerpos = servir(() => HttpResponse.json(previaTaller()))
    const { result } = renderHook(() => usePreviaTaller(null, 0), { wrapper: envoltorio() })
    await esperar(50)
    expect(result.current).toBeNull()
    expect(cuerpos).toEqual([])
  })

  it('un IMEI que NSYS no conoce: tras la primera respuesta deja de pedir', async () => {
    const cuerpos = servir(() => HttpResponse.json(previaTaller({ enNsys: false })))
    const { result, rerender } = renderHook(({ p }) => usePreviaTaller(p, 0), { wrapper: envoltorio(), initialProps: { p: BATERIA } })
    await waitFor(() => expect(cuerpos).toHaveLength(1))
    rerender({ p: CHASIS })
    await esperar(50)
    expect(cuerpos).toHaveLength(1)
    expect(result.current).toBeNull()
  })

  it('si la previa falla (red), no hay previa y no rompe', async () => {
    const cuerpos = servir(() => HttpResponse.error())
    const { result } = renderHook(() => usePreviaTaller(BATERIA, 0), { wrapper: envoltorio() })
    await waitFor(() => expect(cuerpos).toHaveLength(1))
    await esperar(50)
    expect(result.current).toBeNull()
  })

  it('un 500 del servidor no es una previa: sin banda y sin aviso de error', async () => {
    const avisos: string[] = []
    const quitar = onError((m) => avisos.push(m))
    const cuerpos = servir(() => HttpResponse.json({ message: 'boom' }, { status: 500 }))
    const { result } = renderHook(() => usePreviaTaller(BATERIA, 0), { wrapper: envoltorio() })
    await waitFor(() => expect(cuerpos).toHaveLength(1))
    await esperar(50)
    quitar()
    expect(result.current).toBeNull()
    expect(avisos).toEqual([])
  })

  it('reabrir el formulario con las mismas filas vuelve a pedir (la previa depende del estado del servidor)', async () => {
    const cuerpos = servir(() => HttpResponse.json(previaTaller()))
    const wrapper = envoltorio()
    const primera = renderHook(() => usePreviaTaller(BATERIA, 0), { wrapper })
    await waitFor(() => expect(primera.result.current).not.toBeNull())
    primera.unmount()
    await esperar(20) // el formulario estuvo cerrado un rato: gcTime 0 libera la consulta
    const segunda = renderHook(() => usePreviaTaller(BATERIA, 0), { wrapper })
    await waitFor(() => expect(cuerpos).toHaveLength(2))
    segunda.unmount()
  })

  it('espera al retraso: dos cambios seguidos hacen una sola petición, con lo último', async () => {
    const cuerpos = servir(() => HttpResponse.json(previaTaller()))
    const { rerender } = renderHook(({ p }) => usePreviaTaller(p, 100),
      { wrapper: envoltorio(), initialProps: { p: null as PeticionPreviaTaller | null } })
    rerender({ p: BATERIA })
    rerender({ p: CHASIS })
    await waitFor(() => expect(cuerpos).toHaveLength(1))
    await esperar(150)
    expect(cuerpos).toEqual([CHASIS])
  })
})
