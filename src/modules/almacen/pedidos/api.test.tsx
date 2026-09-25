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
  useCompras, useComprasOtros, useEditarCompra, useEditarOtro, useGuardarLoteCompras, useGuardarLoteOtros, useRecargaPedidos,
  useTransicionPedido, type AccionTransicion,
} from './api'

const U = '2026-09-19T08:00:00'
const compra = (o: Partial<CompraComponente> = {}): CompraComponente => ({
  idCompra: 2, idCom: 12, tipoComponente: 'bat-x', idProv: 2, nombreProveedor: 'Proveedor B', cantidad: 5, cantidadRecibida: null,
  esUrgente: false, fechaPedido: U, fechaLlegada: null, precioUnidadPedido: 10, divisa: 'USD', precioEur: 8.8, estado: 'en_camino',
  updatedAt: U, ...o,
})
const otro = (o: Partial<CompraOtro> = {}): CompraOtro => ({
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
    const { result } = renderHook(() => useTransicionPedido('componentes'), { wrapper })
    await result.current.mutateAsync({ accion: accion as AccionTransicion, pedido: compra(), cantidad })
    expect(peticiones).toEqual([{ metodo, ruta, cuerpo, clave: null }])
  })
  it('en otros va a /api/compras-otros/{id}/…', async () => {
    const peticiones = registrar('*/api/compras-otros/*')
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useTransicionPedido('otros'), { wrapper })
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
    const { result } = renderHook(() => useTransicionPedido('componentes'), { wrapper })
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
    await result.current.mutateAsync({ idCompra: 2, cuerpo })
    expect(peticiones).toEqual([{ metodo: 'PUT', ruta: '/api/compras/2', cuerpo: { ...cuerpo, precioEur: null }, clave: null }])
    expect(qc.getQueryState(['compras', 'componentes'])?.isInvalidated).toBe(true)
  })
  it('useEditarOtro manda también el concepto a /api/compras-otros/{id}', async () => {
    const peticiones = registrar('*/api/compras-otros/*')
    const { wrapper } = envoltorio()
    const { result } = renderHook(() => useEditarOtro(), { wrapper })
    await result.current.mutateAsync({ idCompraOtro: 7, cuerpo: { ...cuerpo, concepto: 'Cinta de embalar' } })
    expect(peticiones).toEqual([{ metodo: 'PUT', ruta: '/api/compras-otros/7', cuerpo: { ...cuerpo, concepto: 'Cinta de embalar', precioEur: null }, clave: null }])
  })
})

describe('lotes (spec 4b P5)', () => {
  it('useGuardarLoteCompras: POST /api/compras/lote con Idempotency-Key, devuelve los ids creados y recarga', async () => {
    const peticiones = registrar('*/api/compras/lote', () => HttpResponse.json({ idsCreados: [21, 22] }))
    const { qc, wrapper } = envoltorio()
    qc.setQueryData(['notificaciones', 'solicitudes'], {})
    const { result } = renderHook(() => useGuardarLoteCompras(), { wrapper })
    const cuerpo = {
      lineas: [
        { idCom: 11, idProv: 1, cantidad: 2, esUrgente: false, precioUnidad: 12.5 },
        { idCom: 12, idProv: 2, cantidad: 1, esUrgente: true, precioUnidad: 10 },
      ],
      solicitudes: { urgentes: [31], preventivas: [41] },
    }
    expect(await result.current.mutateAsync({ cuerpo, clave: 'clave-1' })).toEqual({ idsCreados: [21, 22] })
    expect(peticiones).toEqual([{ metodo: 'POST', ruta: '/api/compras/lote', cuerpo, clave: 'clave-1' }])
    expect(qc.getQueryState(['notificaciones', 'solicitudes'])?.isInvalidated).toBe(true)
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
