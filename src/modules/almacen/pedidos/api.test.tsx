import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { CompraComponente, CompraOtro } from '@/shared/api/client'
import { ReglaNegocioError, StaleDataError } from '@/shared/api/errors'
import { crearQueryClient } from '@/shared/api/queryClient'
import { server } from '@/test/server'
import {
  useAccionBloque, useCompras, useComprasOtros, useEditarCompra, useEditarOtro, useGuardarLoteCompras, useGuardarLoteOtros, useJuntarBloque, useLineasPedido,
  useMoverLinea, useNotaBloque, useRecargaPedidos, useSepararBloque, useTransicionPedido, vistaDe, type AccionTransicion,
} from './api'
import { BLOQUE_PRUEBA } from './formulario/datosPrueba'
import { esCompra } from './reglas'

const U = '2026-09-19T08:00:00'
const compra = (o: Partial<CompraComponente> = {}): CompraComponente => ({
  ...BLOQUE_PRUEBA,
  idCompra: 2, idCom: 12, tipoComponente: 'bat-x', idProv: 2, nombreProveedor: 'Proveedor B', cantidad: 5, cantidadRecibida: null,
  esUrgente: false, fechaPedido: U, fechaLlegada: null, precioUnidadPedido: 10, divisa: 'USD', precioEur: 8.8, estado: 'en_camino',
  updatedAt: U, ...o,
})
const otro = (o: Partial<CompraOtro> = {}): CompraOtro => ({
  ...BLOQUE_PRUEBA,
  idCompraOtro: 7, idProv: 1, nombreProveedor: 'Proveedor A', concepto: 'Cinta de embalar', cantidad: 3, cantidadRecibida: null,
  esUrgente: false, fechaPedido: U, fechaLlegada: null, precioUnidadPedido: 2, divisa: 'EUR', precioEur: 2, estado: 'en_camino',
  updatedAt: U, ...o,
})

function envoltorio() {
  const qc = crearQueryClient({ retry: false })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}

type Peticion = { metodo: string; ruta: string; cuerpo: unknown; clave: string | null }
/** Registra método, ruta, cuerpo JSON (null sin cuerpo) y cabecera Idempotency-Key de cada petición que casa con `patron`. */
function registrar(patron: string, respuesta: () => Response = () => new HttpResponse(null, { status: 200 })) {
  const peticiones: Peticion[] = []
  server.use(
    http.all(patron, async ({ request }) => {
      const texto = await request.text()
      peticiones.push({ metodo: request.method, ruta: new URL(request.url).pathname, cuerpo: texto ? JSON.parse(texto) : null, clave: request.headers.get('Idempotency-Key') })
      return respuesta()
    }),
  )
  return peticiones
}

describe('consultas', () => {
  it('useCompras lee GET /api/compras y lleva los cancelados al final', async () => {
    server.use(http.get('*/api/compras', () => HttpResponse.json([compra({ idCompra: 9, estado: 'cancelado' }), compra({ idCompra: 2 })])))
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useCompras({ activo: true }), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.map((p) => p.idCompra)).toEqual([2, 9])
  })
  it('useComprasOtros lee GET /api/compras-otros; con habilitada: false no pide nada', async () => {
    let peticiones = 0
    server.use(http.get('*/api/compras-otros', () => { peticiones += 1; return HttpResponse.json([otro({ idCompraOtro: 8, estado: 'cancelado' }), otro()]) }))
    const { wrapper } = envoltorio()
    const { result: apagada } = renderHook(() => useComprasOtros({ activo: false, habilitada: false }), { wrapper })
    expect(apagada.current.fetchStatus).toBe('idle')
    const { result } = renderHook(() => useComprasOtros({ activo: true }), { wrapper })
    await waitFor(() => expect(result.current.data?.map((p) => p.idCompraOtro)).toEqual([7, 8]))
    expect(peticiones).toBe(1)
  })
  it('useLineasPedido (0.9.15): junta las dos listas (fecha descendente, cancelados al final) y solo da datos con las dos', async () => {
    let otrosPedidos = 0
    server.use(
      http.get('*/api/compras', () => HttpResponse.json([compra({ idCompra: 2 }), compra({ idCompra: 9, estado: 'cancelado', fechaPedido: '2026-09-21T08:00:00' })])),
      http.get('*/api/compras-otros', () => { otrosPedidos += 1; return HttpResponse.json([otro({ idCompraOtro: 7, fechaPedido: '2026-09-20T08:00:00' })]) }),
    )
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useLineasPedido({ activo: true }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((p) => (esCompra(p) ? `p-${p.idCompra}` : `o-${p.idCompraOtro}`))).toEqual(['o-7', 'p-2', 'p-9'])
    expect(result.current.dataUpdatedAt).toBeGreaterThan(0)
    const recargadas = await result.current.refetch()
    expect(recargadas).toHaveLength(3)
    expect(otrosPedidos).toBe(2)
  })
})

describe('useTransicionPedido', () => {
  it.each([
    ['confirmar', undefined, 'PATCH', '/api/compras/2/confirmar', { updatedAt: U }],
    ['confirmar-recibido', undefined, 'PATCH', '/api/compras/2/confirmar-recibido', { updatedAt: U }],
    ['confirmar-parcial', 1, 'PATCH', '/api/compras/2/confirmar-parcial', { cantidadRecibida: 1, updatedAt: U }],
    ['recibir-resto', 4, 'PATCH', '/api/compras/2/recibir-resto', { cantidadExtra: 4, updatedAt: U }],
    ['confirmar-alterado', undefined, 'PATCH', '/api/compras/2/confirmar-alterado', { updatedAt: U }],
    ['cancelar', undefined, 'PATCH', '/api/compras/2/cancelar', { updatedAt: U }],
    ['desrecibir', undefined, 'PATCH', '/api/compras/2/desrecibir', { updatedAt: U }],
    ['borrar', undefined, 'DELETE', '/api/compras/2', null],
  ] as const)('%s de componentes: %s → %s %s con el cuerpo de hoy', async (accion, cantidad, metodo, ruta, cuerpo) => {
    const peticiones = registrar('*/api/compras/*')
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useTransicionPedido(), { wrapper })
    await result.current.mutateAsync({ accion: accion as AccionTransicion, pedido: compra(), cantidad })
    expect(peticiones).toEqual([{ metodo, ruta, cuerpo, clave: null }])
  })
  it('un otro va a /api/compras-otros/{id}/… (decide el tipo de la línea, 0.9.15)', async () => {
    const peticiones = registrar('*/api/compras-otros/*')
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useTransicionPedido(), { wrapper })
    await result.current.mutateAsync({ accion: 'recibir-resto', pedido: otro({ estado: 'parcial', cantidadRecibida: 1 }), cantidad: 2 })
    await result.current.mutateAsync({ accion: 'borrar', pedido: otro({ estado: 'pendiente' }) })
    expect(peticiones).toEqual([
      { metodo: 'PATCH', ruta: '/api/compras-otros/7/recibir-resto', cuerpo: { cantidadExtra: 2, updatedAt: U }, clave: null },
      { metodo: 'DELETE', ruta: '/api/compras-otros/7', cuerpo: null, clave: null },
    ])
  })
  it('también con error (409) recarga compras, componentes y campana', async () => {
    registrar('*/api/compras/*', () => HttpResponse.json({ message: 'El pedido ya no está pendiente' }, { status: 409 }))
    const { qc, wrapper } = envoltorio()
    qc.setQueryData(['compras', 'componentes'], [])
    qc.setQueryData(['componentes', 'gestionados'], [])
    qc.setQueryData(['notificaciones', 'contador'], 0)
    qc.setQueryData(['proveedores', 'COMPONENTES'], [])
    const { result } = renderHook(() => useTransicionPedido(), { wrapper })
    await expect(result.current.mutateAsync({ accion: 'confirmar', pedido: compra({ estado: 'pendiente' }) })).rejects.toBeInstanceOf(StaleDataError)
    expect(qc.getQueryState(['compras', 'componentes'])?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['componentes', 'gestionados'])?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['notificaciones', 'contador'])?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['proveedores', 'COMPONENTES'])?.isInvalidated).toBe(false)
  })
})

describe('editar (PUT, spec 4b §6 y P3)', () => {
  const cuerpo = { idProv: 2, cantidad: 3, esUrgente: true, precioUnidad: 10, divisa: 'USD', updatedAt: U }
  it('useEditarCompra manda el cuerpo con precioEur: null (lo calcula el servidor) y recarga', async () => {
    const peticiones = registrar('*/api/compras/*')
    const { qc, wrapper } = envoltorio()
    qc.setQueryData(['compras', 'componentes'], [])
    const { result } = renderHook(() => useEditarCompra(), { wrapper })
    await result.current.mutateAsync({ idCompra: 2, cuerpo: { ...cuerpo, destino: null } })
    expect(peticiones).toEqual([{ metodo: 'PUT', ruta: '/api/compras/2', cuerpo: { ...cuerpo, destino: null, precioEur: null }, clave: null }])
    expect(qc.getQueryState(['compras', 'componentes'])?.isInvalidated).toBe(true)
  })
  it('useEditarOtro manda también el concepto y el destino (0.9.15) a /api/compras-otros/{id}', async () => {
    const peticiones = registrar('*/api/compras-otros/*')
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useEditarOtro(), { wrapper })
    await result.current.mutateAsync({ idCompraOtro: 7, cuerpo: { ...cuerpo, concepto: 'Cinta de embalar', destino: { idBloque: 60 } } })
    expect(peticiones).toEqual([{
      metodo: 'PUT', ruta: '/api/compras-otros/7', cuerpo: { ...cuerpo, concepto: 'Cinta de embalar', destino: { idBloque: 60 }, precioEur: null }, clave: null,
    }])
  })
})

describe('lotes (spec 4b P5)', () => {
  it('useGuardarLoteCompras: POST /api/compras/lote con Idempotency-Key, piezas y otros; devuelve los ids de los dos y recarga', async () => {
    const peticiones = registrar('*/api/compras/lote', () => HttpResponse.json({ idsCreados: [21, 22], idsOtrosCreados: [31] }))
    const { qc, wrapper } = envoltorio()
    qc.setQueryData(['notificaciones', 'solicitudes'], {})
    const { result } = renderHook(() => useGuardarLoteCompras(), { wrapper })
    const cuerpo = {
      lineas: [
        { idCom: 11, idProv: 1, cantidad: 2, esUrgente: false, precioUnidad: 12.5 },
        { idCom: 12, idProv: 2, cantidad: 1, esUrgente: true, precioUnidad: 10 },
      ],
      solicitudes: { urgentes: [31], preventivas: [41] },
      destinos: null,
      otros: [{ idProv: 1, concepto: 'Cinta de embalar', cantidad: 3, esUrgente: false, precioUnidad: 2 }],
    }
    expect(await result.current.mutateAsync({ cuerpo, clave: 'clave-1' })).toEqual({ idsCreados: [21, 22], idsOtrosCreados: [31] })
    expect(peticiones).toEqual([{ metodo: 'POST', ruta: '/api/compras/lote', cuerpo, clave: 'clave-1' }])
    expect(qc.getQueryState(['notificaciones', 'solicitudes'])?.isInvalidated).toBe(true)
  })
  it('useGuardarLoteCompras: una respuesta sin idsOtrosCreados da la lista vacía', async () => {
    registrar('*/api/compras/lote', () => HttpResponse.json({ idsCreados: [21] }))
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useGuardarLoteCompras(), { wrapper })
    const cuerpo = { lineas: [{ idCom: 11, idProv: 1, cantidad: 1, esUrgente: false, precioUnidad: 0 }], solicitudes: { urgentes: [], preventivas: [] }, destinos: null, otros: [] }
    expect(await result.current.mutateAsync({ cuerpo, clave: 'clave-4' })).toEqual({ idsCreados: [21], idsOtrosCreados: [] })
  })
  it('useGuardarLoteOtros: POST /api/compras-otros/lote con Idempotency-Key', async () => {
    const peticiones = registrar('*/api/compras-otros/lote', () => HttpResponse.json({ idsCreados: [31] }))
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useGuardarLoteOtros(), { wrapper })
    const cuerpo = { lineas: [{ idProv: 1, concepto: 'Cinta de embalar', cantidad: 3, esUrgente: false, precioUnidad: 2 }] }
    expect(await result.current.mutateAsync({ cuerpo, clave: 'clave-2' })).toEqual({ idsCreados: [31] })
    expect(peticiones).toEqual([{ metodo: 'POST', ruta: '/api/compras-otros/lote', cuerpo, clave: 'clave-2' }])
  })
  it('un lote rechazado (422) no recarga: el formulario sigue abierto con su error', async () => {
    registrar('*/api/compras-otros/lote', () => HttpResponse.json({ message: 'Línea 1: el proveedor está desactivado.' }, { status: 422 }))
    const { qc, wrapper } = envoltorio()
    qc.setQueryData(['compras', 'otros'], [])
    const { result } = renderHook(() => useGuardarLoteOtros(), { wrapper })
    const cuerpo = { lineas: [{ idProv: 3, concepto: 'Bolsas', cantidad: 1, esUrgente: false, precioUnidad: 0 }] }
    await expect(result.current.mutateAsync({ cuerpo, clave: 'clave-3' })).rejects.toBeInstanceOf(ReglaNegocioError)
    expect(qc.getQueryState(['compras', 'otros'])?.isInvalidated).toBe(false)
  })
})

describe('useRecargaPedidos', () => {
  it('invalida compras, componentes y campana; no toca proveedores', () => {
    const { qc, wrapper } = envoltorio()
    qc.setQueryData(['compras', 'otros'], [])
    qc.setQueryData(['componentes', 'gestionados'], [])
    qc.setQueryData(['notificaciones', 'componentes'], [])
    qc.setQueryData(['proveedores', 'COMPONENTES'], [])
    const { result } = renderHook(() => useRecargaPedidos(), { wrapper })
    result.current()
    expect(qc.getQueryState(['compras', 'otros'])?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['componentes', 'gestionados'])?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['notificaciones', 'componentes'])?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['proveedores', 'COMPONENTES'])?.isInvalidated).toBe(false)
  })
})

describe('bloques (0.9.9; con otros, 0.9.15)', () => {
  it('useMoverLinea: PATCH /api/compras/{id}/bloque con el destino y el updatedAt de la línea', async () => {
    const peticiones = registrar('*/api/compras/:id/bloque')
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useMoverLinea(), { wrapper })
    await result.current.mutateAsync({ pedido: compra({ idCompra: 2 }), idBloque: null })
    expect(peticiones).toEqual([{ metodo: 'PATCH', ruta: '/api/compras/2/bloque', cuerpo: { idBloque: null, updatedAt: U }, clave: null }])
  })

  it('useMoverLinea de un otro: PATCH /api/compras-otros/{id}/bloque', async () => {
    const peticiones = registrar('*/api/compras-otros/:id/bloque')
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useMoverLinea(), { wrapper })
    await result.current.mutateAsync({ pedido: otro({ idCompraOtro: 7 }), idBloque: 40 })
    expect(peticiones).toEqual([{ metodo: 'PATCH', ruta: '/api/compras-otros/7/bloque', cuerpo: { idBloque: 40, updatedAt: U }, clave: null }])
  })

  it('vistaDe lleva el id en su tabla y el tipo de la línea', () => {
    expect(vistaDe(compra({ idCompra: 2 }))).toEqual({ idCompra: 2, updatedAt: U, tipo: 'PIEZA' })
    expect(vistaDe(otro({ idCompraOtro: 2 }))).toEqual({ idCompra: 2, updatedAt: U, tipo: 'OTRO' })
  })

  it.each([
    ['confirmar', '/api/bloques-compra/41/confirmar'],
    ['recibir', '/api/bloques-compra/41/recibir'],
    ['cancelar', '/api/bloques-compra/41/cancelar'],
    ['borrar', '/api/bloques-compra/41/borrar'],
  ] as const)('useAccionBloque %s: POST %s con las líneas vistas y su tipo', async (accion, ruta) => {
    const peticiones = registrar('*/api/bloques-compra/:id/:accion')
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useAccionBloque(), { wrapper })
    await result.current.mutateAsync({ idBloque: 41, accion, lineas: [vistaDe(compra({ idCompra: 2 })), vistaDe(otro({ idCompraOtro: 2 }))] })
    expect(peticiones).toEqual([{
      metodo: 'POST', ruta, cuerpo: { lineas: [{ idCompra: 2, updatedAt: U, tipo: 'PIEZA' }, { idCompra: 2, updatedAt: U, tipo: 'OTRO' }] }, clave: null,
    }])
  })

  it('useSepararBloque devuelve el número del bloque nuevo', async () => {
    registrar('*/api/bloques-compra/:id/separar', () => HttpResponse.json({ idBloque: 90 }))
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useSepararBloque(), { wrapper })
    expect(await result.current.mutateAsync({ idBloque: 41, lineas: [{ idCompra: 2, updatedAt: U, tipo: 'PIEZA' }] })).toEqual({ idBloque: 90 })
  })

  it('useJuntarBloque y useNotaBloque mandan su cuerpo', async () => {
    const peticiones = registrar('*/api/bloques-compra/:id/:accion')
    const { wrapper } = envoltorio()
    const juntar = renderHook(() => useJuntarBloque(), { wrapper }).result
    const nota = renderHook(() => useNotaBloque(), { wrapper }).result
    await juntar.current.mutateAsync({ idBloque: 41, destino: 40, lineas: [{ idCompra: 2, updatedAt: U, tipo: 'OTRO' }] })
    await nota.current.mutateAsync({ idBloque: 41, nota: 'Ped. 123', updatedAt: U })
    expect(peticiones).toEqual([
      { metodo: 'POST', ruta: '/api/bloques-compra/41/juntar', cuerpo: { destino: 40, lineas: [{ idCompra: 2, updatedAt: U, tipo: 'OTRO' }] }, clave: null },
      { metodo: 'PATCH', ruta: '/api/bloques-compra/41/nota', cuerpo: { nota: 'Ped. 123', updatedAt: U }, clave: null },
    ])
  })

  it('un 409 de una acción de bloque llega como StaleDataError', async () => {
    registrar('*/api/bloques-compra/:id/:accion', () => HttpResponse.json({ message: 'Este bloque fue modificado por otro usuario.' }, { status: 409 }))
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useAccionBloque(), { wrapper })
    await expect(result.current.mutateAsync({ idBloque: 41, accion: 'recibir', lineas: [] })).rejects.toBeInstanceOf(StaleDataError)
  })
})
