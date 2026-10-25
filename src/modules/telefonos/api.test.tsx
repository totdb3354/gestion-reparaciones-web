import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { crearQueryClient } from '@/shared/api/queryClient'
import { SessionProvider } from '@/shared/session/SessionProvider'
import { guardarSesion } from '@/shared/session/storage'
import { server } from '@/test/server'
import { SESION_SUPER } from '@/test/render'
import { useBuscarMoviles } from '@/shared/api/nsys'
import {
  useComprobarImeis, useDescargarPlantilla, useDeshacerHecho, useEstadoNsys, useImportacionesNsys, useMarcarHecho, usePorPasarNsys,
  usePorPasarTarjetas, useRevisarAviso, useStockTelefonos,
} from './api'
import { estadoNsys, filaGrado, filaPorPasar, listaImportaciones, movil, movilComprobado, tarjetas } from './test/fabrica'

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

  it('las tarjetas y lo que mandan «Hecho», «deshacer» y «Revisado» (spec 0.9.22 §3)', async () => {
    const pedidos: unknown[] = []
    server.use(
      http.get('*/api/stock-telefonos/por-pasar/tarjetas', () => HttpResponse.json(tarjetas({ grado: [filaGrado()] }))),
      http.put('*/api/stock-telefonos/por-pasar/hecho', async ({ request }) => {
        pedidos.push(['PUT', await request.json()])
        return new HttpResponse(null, { status: 204 })
      }),
      http.delete('*/api/stock-telefonos/por-pasar/hecho', async ({ request }) => {
        pedidos.push(['DELETE', await request.json()])
        return new HttpResponse(null, { status: 204 })
      }),
      http.post('*/api/stock-telefonos/por-pasar/avisos/:idAviso/revisado', ({ params }) => {
        pedidos.push(['POST', params.idAviso])
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const lista = renderHook(() => usePorPasarTarjetas(), { wrapper: envoltorio() })
    await waitFor(() => expect(lista.result.current.data?.grado).toHaveLength(1))
    const wrapper = envoltorio()
    const marcar = renderHook(() => useMarcarHecho(), { wrapper })
    await marcar.result.current.mutateAsync({ tarjeta: 'GRADO', imeis: ['350000000000022'] })
    const deshacer = renderHook(() => useDeshacerHecho(), { wrapper })
    await deshacer.result.current.mutateAsync({ tarjeta: 'GRADO', imeiSn: '350000000000022' })
    const revisar = renderHook(() => useRevisarAviso(), { wrapper })
    await revisar.result.current.mutateAsync(1)
    expect(pedidos).toEqual([
      ['PUT', { tarjeta: 'GRADO', imeis: ['350000000000022'] }],
      ['DELETE', { tarjeta: 'GRADO', imeiSn: '350000000000022' }],
      ['POST', '1'],
    ])
  })

  it('la plantilla se guarda con el nombre del servidor y dice cuántos móviles lleva (spec 0.9.22 §4)', async () => {
    const crear = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    server.use(http.get('*/api/stock-telefonos/por-pasar/plantilla-color', () => new HttpResponse(new Blob(['PK']), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="NSYS_color_2026-10-25.xlsx"',
        'X-Filas': '2',
      },
    })))
    const descarga = renderHook(() => useDescargarPlantilla(), { wrapper: envoltorio() })
    await expect(descarga.result.current.mutateAsync('color')).resolves.toEqual({ nombre: 'NSYS_color_2026-10-25.xlsx', filas: 2 })
    expect(crear).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })
})
