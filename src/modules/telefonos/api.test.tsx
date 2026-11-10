import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearQueryClient } from '@/shared/api/queryClient'
import { SessionProvider } from '@/shared/session/SessionProvider'
import { guardarSesion } from '@/shared/session/storage'
import { server } from '@/test/server'
import { SESION_SUPER } from '@/test/render'
import { useBuscarMoviles } from '@/shared/api/nsys'
import {
  useComprobarImeis, useDescargarExcel, useDescargarPlantilla, useDescartarAlta, useDeshacerDescarte, useDeshacerHecho, useEstadoNsys, useImportacionesNsys,
  useFilas, useFuentesPedidos, useMarcarHecho, usePonerImei, usePorPasarTarjetas, useRecomendados, useRevisarAviso, useStockTelefonos,
} from './api'
import { candidato, estadoNsys, fila, filaGrado, fuente, listaImportaciones, movil, movilComprobado, tarjetas } from './test/fabrica'

function envoltorio() {
  guardarSesion(SESION_SUPER)
  const qc = crearQueryClient({ retry: false })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><SessionProvider>{children}</SessionProvider></QueryClientProvider>
  )
}

describe('api del stock de teléfonos', () => {
  afterEach(() => { vi.restoreAllMocks() })

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
    await expect(descarga.result.current.mutateAsync({ cual: 'color', destino: null }))
      .resolves.toEqual({ nombre: 'NSYS_color_2026-10-25.xlsx', filas: 2 })
    expect(crear).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })

  it('«descartar» y su «deshacer» mandan el IMEI y el motivo (spec 0.9.22 pieza 3)', async () => {
    const pedidos: unknown[] = []
    server.use(
      http.put('*/api/stock-telefonos/por-pasar/descarte', async ({ request }) => {
        pedidos.push(['PUT', await request.json()])
        return new HttpResponse(null, { status: 204 })
      }),
      http.delete('*/api/stock-telefonos/por-pasar/descarte', async ({ request }) => {
        pedidos.push(['DELETE', await request.json()])
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const wrapper = envoltorio()
    const descartar = renderHook(() => useDescartarAlta(), { wrapper })
    await descartar.result.current.mutateAsync({ imeiSn: 'SIN-IMEI-CAM', motivo: 'no es un móvil' })
    const deshacer = renderHook(() => useDeshacerDescarte(), { wrapper })
    await deshacer.result.current.mutateAsync({ imeiSn: 'SIN-IMEI-CAM' })
    expect(pedidos).toEqual([
      ['PUT', { imeiSn: 'SIN-IMEI-CAM', motivo: 'no es un móvil' }],
      ['DELETE', { imeiSn: 'SIN-IMEI-CAM' }],
    ])
  })

  it('el Excel de «Qué revisar» manda la hoja y guarda el xlsx que vuelve (spec 0.9.25 §10.3)', async () => {
    const crear = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const cuerpos: unknown[] = []
    server.use(http.post('*/api/stock-telefonos/que-revisar/excel', async ({ request }) => {
      cuerpos.push(await request.json())
      return new HttpResponse(new Blob(['PK']), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } })
    }))
    const hoja = { hoja: 'Revisar sin grado', columnas: ['Modelo', 'IMEI'], filas: [['iPhone 13', '350000000000001']] }
    const descarga = renderHook(() => useDescargarExcel(), { wrapper: envoltorio() })
    await expect(descarga.result.current.mutateAsync({ hoja, nombre: 'Que_revisar_sin_grado_2026-11-04.xlsx', destino: null }))
      .resolves.toBe('Que_revisar_sin_grado_2026-11-04.xlsx')
    expect(cuerpos).toEqual([hoja])
    expect(crear).toHaveBeenCalledTimes(1)
    expect((clic.mock.instances[0] as HTMLAnchorElement).download).toBe('Que_revisar_sin_grado_2026-11-04.xlsx')
  })

  it('«Pedidos como la hoja»: las filas van con el intervalo de fechas y la búsqueda', async () => {
    const urls: URL[] = []
    server.use(http.get('*/api/pedidos/filas', ({ request }) => {
      urls.push(new URL(request.url))
      return HttpResponse.json({ filas: [fila()], hayMas: true })
    }))
    const filas = renderHook(() => useFilas({ desde: '2026-10-10', hasta: '2026-11-10', buscar: '3500' }), { wrapper: envoltorio() })
    await waitFor(() => expect(filas.result.current.data?.filas).toHaveLength(1))
    expect(filas.result.current.data?.hayMas).toBe(true)
    expect(urls[0].searchParams.get('desde')).toBe('2026-10-10')
    expect(urls[0].searchParams.get('hasta')).toBe('2026-11-10')
    expect(urls[0].searchParams.get('buscar')).toBe('3500')
  })

  it('los recomendados de una fila: no pregunta sin fila y pide los de su id', async () => {
    const rutas: string[] = []
    server.use(http.get('*/api/pedidos/filas/:id/recomendados', ({ params }) => {
      rutas.push(String(params.id))
      return HttpResponse.json([candidato()])
    }))
    const wrapper = envoltorio()
    const sin = renderHook(() => useRecomendados(null), { wrapper })
    expect(sin.result.current.fetchStatus).toBe('idle')
    const con = renderHook(() => useRecomendados(7), { wrapper })
    await waitFor(() => expect(con.result.current.data).toHaveLength(1))
    expect(rutas).toEqual(['7'])
    expect(con.result.current.data?.[0].imei).toBe('350000000000001')
  })

  it('poner el IMEI manda {imei} a la fila y recarga la lista de filas', async () => {
    const puestos: unknown[] = []
    let listas = 0
    server.use(
      http.put('*/api/pedidos/filas/:id/imei', async ({ request, params }) => {
        puestos.push([params.id, await request.json()])
        return HttpResponse.json(fila({ idFila: 7, imei: '350000000000001' }))
      }),
      http.get('*/api/pedidos/filas', () => {
        listas++
        return HttpResponse.json({ filas: [fila()], hayMas: false })
      }),
    )
    const wrapper = envoltorio()
    const filas = renderHook(() => useFilas({ desde: '2026-10-10', hasta: '2026-11-10', buscar: '' }), { wrapper })
    await waitFor(() => expect(filas.result.current.isSuccess).toBe(true))
    const poner = renderHook(() => usePonerImei(), { wrapper })
    const devuelta = await poner.result.current.mutateAsync({ idFila: 7, imei: '350000000000001' })
    expect(devuelta.imei).toBe('350000000000001')
    expect(puestos).toEqual([['7', { imei: '350000000000001' }]])
    await waitFor(() => expect(listas).toBe(2))
    await poner.result.current.mutateAsync({ idFila: 7, imei: null })
    expect(puestos[1]).toEqual(['7', { imei: null }])
  })

  it('las fuentes de pedidos vienen de /api/pedidos/fuentes', async () => {
    server.use(http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente()])))
    const fuentes = renderHook(() => useFuentesPedidos(), { wrapper: envoltorio() })
    await waitFor(() => expect(fuentes.result.current.data).toHaveLength(1))
  })
})
