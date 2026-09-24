import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { crearQueryClient } from '@/shared/api/queryClient'
import { server } from '@/test/server'
import { guardarModelo, pedirClienteBd, pedirLookup, pedirPrediccion, useGuardarLote } from './api'

const IMEI = '111111111111111'

/** Calco de envoltorioConQc de asignaciones/api.test.tsx (misma firma: { qc, Wrapper }). */
function envoltorioConQc() {
  const qc = crearQueryClient({ retry: false })
  return { qc, Wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> }
}

describe('ejecutores de efectos', () => {
  it('lookup: modelo y cliente de BD (solo si el cliente existe en la lista)', async () => {
    server.use(
      http.get('*/api/telefonos/:imei/modelo', () => HttpResponse.json({ value: '12' })),
      http.get('*/api/telefonos/:imei/cliente', () => HttpResponse.json({ value: '5' })),
    )
    expect(await pedirLookup(IMEI, true, new Set([5]))).toEqual({ modelo: '12', idCliBd: 5 })
    expect(await pedirLookup(IMEI, true, new Set([9]))).toEqual({ modelo: '12', idCliBd: null })
  })

  it('lookup: vacíos y errores se tragan; sin buscarModelo no pide el modelo', async () => {
    let pidioModelo = false
    server.use(
      http.get('*/api/telefonos/:imei/modelo', () => {
        pidioModelo = true
        return HttpResponse.json({ value: '' })
      }),
      http.get('*/api/telefonos/:imei/cliente', () => new HttpResponse(null, { status: 500 })),
    )
    expect(await pedirLookup(IMEI, false, new Set())).toEqual({ modelo: null, idCliBd: null })
    expect(pidioModelo).toBe(false)
    expect(await pedirLookup(IMEI, true, new Set())).toEqual({ modelo: null, idCliBd: null })
  })

  it('cliente de BD vacío es null', async () => {
    server.use(http.get('*/api/telefonos/:imei/cliente', () => HttpResponse.json({ value: '' })))
    expect(await pedirClienteBd(IMEI, new Set([0]))).toBeNull()
  })

  it('guardar el modelo manda imei y modelo y no lanza si falla', async () => {
    let cuerpo: unknown
    server.use(
      http.post('*/api/telefonos', async ({ request }) => {
        cuerpo = await request.json()
        return new HttpResponse(null, { status: 500 })
      }),
    )
    await expect(guardarModelo(IMEI, '14pro')).resolves.toBeUndefined()
    expect(cuerpo).toMatchObject({ imei: IMEI, modelo: '14pro' })
  })

  it('predicción: idTec o null; los errores se propagan para marcarla fallida', async () => {
    server.use(http.post('*/api/glass/prediccion', () => HttpResponse.json({ idTec: 4, nombre: 'Técnico G' })))
    expect(await pedirPrediccion({ imei: IMEI, conCliente: true, verdes: [] })).toBe(4)
    server.use(http.post('*/api/glass/prediccion', () => new HttpResponse(null, { status: 500 })))
    await expect(pedirPrediccion({ imei: IMEI, conCliente: true, verdes: [] })).rejects.toBeTruthy()
  })
})

describe('useGuardarLote', () => {
  it('manda la clave en la cabecera e invalida asignaciones, carga y contadores', async () => {
    let clave: string | null = null
    server.use(
      http.post('*/api/asignaciones/lote', ({ request }) => {
        clave = request.headers.get('Idempotency-Key')
        return HttpResponse.json({ creadas: [], conflictos: [] })
      }),
    )
    const { qc, Wrapper } = envoltorioConQc()
    const invalidadas: (readonly unknown[])[] = []
    const original = qc.invalidateQueries.bind(qc)
    qc.invalidateQueries = ((f: { queryKey: readonly unknown[] }) => {
      invalidadas.push(f.queryKey)
      return original(f)
    }) as typeof qc.invalidateQueries
    const { result } = renderHook(() => useGuardarLote(), { wrapper: Wrapper })
    await result.current.mutateAsync({ cuerpo: { telefonos: [], asignaciones: [] }, clave: 'k-1' })
    expect(clave).toBe('k-1')
    await waitFor(() =>
      expect(invalidadas).toEqual(
        expect.arrayContaining([['asignaciones', 'todas'], ['carga-tecnicos'], ['asignaciones'], ['pendientes', 'contadores']]),
      ),
    )
  })
})
