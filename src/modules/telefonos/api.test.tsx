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
import { useBuscarMoviles } from '@/shared/api/nsys'
import { useComprobarImeis, useEstadoNsys, useImportacionesNsys, usePorPasarNsys, useStockTelefonos } from './api'
import { estadoNsys, filaPorPasar, listaImportaciones, movil, movilComprobado } from './test/fabrica'

function envoltorio() {
  guardarSesion(SESION_SUPER)
  const qc = crearQueryClient({ retry: false })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><SessionProvider>{children}</SessionProvider></QueryClientProvider>
  )
}

describe('api del stock de teléfonos', () => {
  it('pide el stock y el estado de NSYS', async () => {
    server.use(
      http.get('*/api/stock-telefonos', () => HttpResponse.json([movil()])),
      http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    )
    const stock = renderHook(() => useStockTelefonos(), { wrapper: envoltorio() })
    await waitFor(() => expect(stock.result.current.data).toHaveLength(1))
    const estado = renderHook(() => useEstadoNsys(), { wrapper: envoltorio() })
    await waitFor(() => expect(estado.result.current.data?.nivel).toBe('OK'))
  })

  it('el buscador no pregunta con menos de 4 caracteres y manda el texto sin espacios', async () => {
    const pedidas: string[] = []
    server.use(http.get('*/api/stock-telefonos/buscar', ({ request }) => {
      pedidas.push(new URL(request.url).searchParams.get('imei') ?? '')
      return HttpResponse.json([])
    }))
    const corto = renderHook(() => useBuscarMoviles('350'), { wrapper: envoltorio() })
    expect(corto.result.current.fetchStatus).toBe('idle')
    const largo = renderHook(() => useBuscarMoviles(' 3500 '), { wrapper: envoltorio() })
    await waitFor(() => expect(largo.result.current.isSuccess).toBe(true))
    expect(pedidas).toEqual(['3500'])
  })

  it('el estado de NSYS no pregunta si no está activo (el técnico)', () => {
    let pedidas = 0
    server.use(http.get('*/api/stock-telefonos/estado', () => {
      pedidas++
      return HttpResponse.json(estadoNsys())
    }))
    const estado = renderHook(() => useEstadoNsys(false), { wrapper: envoltorio() })
    expect(estado.result.current.fetchStatus).toBe('idle')
    expect(pedidas).toBe(0)
  })

  it('la lista de importaciones pide las últimas 20', async () => {
    const limites: (string | null)[] = []
    server.use(http.get('*/api/stock-telefonos/importaciones', ({ request }) => {
      limites.push(new URL(request.url).searchParams.get('limite'))
      return HttpResponse.json(listaImportaciones())
    }))
    const lista = renderHook(() => useImportacionesNsys(), { wrapper: envoltorio() })
    await waitFor(() => expect(lista.result.current.data?.importaciones).toHaveLength(1))
    expect(limites).toEqual(['20'])
  })

  it('comprobar manda los IMEIs en el cuerpo y sin IMEIs no pregunta', async () => {
    const cuerpos: unknown[] = []
    server.use(http.post('*/api/stock-telefonos/comprobar', async ({ request }) => {
      cuerpos.push(await request.json())
      return HttpResponse.json([movilComprobado()])
    }))
    const vacio = renderHook(() => useComprobarImeis([]), { wrapper: envoltorio() })
    expect(vacio.result.current.fetchStatus).toBe('idle')
    const lleno = renderHook(() => useComprobarImeis(['350000000000001']), { wrapper: envoltorio() })
    await waitFor(() => expect(lleno.result.current.data).toHaveLength(1))
    expect(cuerpos).toEqual([{ imeis: ['350000000000001'] }])
  })

  it('pide la lista «Por pasar a NSYS» (0.9.21)', async () => {
    server.use(http.get('*/api/stock-telefonos/por-pasar', () => HttpResponse.json([filaPorPasar()])))
    const lista = renderHook(() => usePorPasarNsys(), { wrapper: envoltorio() })
    await waitFor(() => expect(lista.result.current.data).toHaveLength(1))
  })
})
