import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompraComponente, Proveedor } from '@/shared/api/client'
import { INTERVALO_CONECTADO_MS } from '@/shared/api/refresco'
import type { Sesion } from '@/shared/session/storage'
import { renderConRouter, SESION_ADMIN, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { lineaDePrueba as l } from './bloques/datosPrueba'
import { FILTROS_PEDIDOS_VACIOS, filtrosDesdeStock, firmaFiltros } from './filtros'
import { filtrosPedidos, plegadoBloques } from './estado'
import { PedidosPage } from './PedidosPage'

const U = '2026-10-09T10:00:00'
const B41 = { idBloque: 41, fechaBloque: '2026-10-09T10:00:00' }
const B40 = { idBloque: 40, fechaBloque: '2026-10-08T10:00:00' }
const B39 = { idBloque: 39, fechaBloque: '2026-10-07T10:00:00' }
/** 41 en curso (pendiente + en camino), 40 abierto, 39 terminado. */
const compras: CompraComponente[] = [
  l({ idCompra: 1, ...B41, tipoComponente: 'lcd-x-negro' }),
  l({ idCompra: 2, ...B41, tipoComponente: 'bat-x', estado: 'en_camino' }),
  l({ idCompra: 3, ...B40, tipoComponente: 'mc-x' }),
  l({ idCompra: 4, ...B39, tipoComponente: 'lcd-y', estado: 'recibido', cantidadRecibida: 2 }),
]
const proveedores: Proveedor[] = [{ idProv: 1, nombre: 'Proveedor A', activo: true, divisa: 'EUR', comentario: '', tipo: 'COMPONENTES' }]
let escrituras: string[]
let cargasCompras = 0

beforeEach(() => {
  escrituras = []
  cargasCompras = 0
  localStorage.removeItem('pedidos.agruparPorBloque')
  server.use(
    http.get('*/api/compras', () => { cargasCompras += 1; return HttpResponse.json(compras) }),
    http.get('*/api/proveedores', () => HttpResponse.json(proveedores)),
    http.patch('*/api/compras/:id/bloque', async ({ params, request }) => {
      escrituras.push(`PATCH ${String(params.id)} ${JSON.stringify(await request.json())}`)
      return new HttpResponse(null, { status: 200 })
    }),
    http.post('*/api/bloques-compra/:id/:accion', async ({ params, request }) => {
      escrituras.push(`POST ${String(params.id)} ${String(params.accion)} ${JSON.stringify(await request.json())}`)
      return new HttpResponse(null, { status: 200 })
    }),
  )
})
afterEach(() => {
  vi.useRealTimers()
  localStorage.removeItem('pedidos.agruparPorBloque')
})

function montar(sesion: Sesion = SESION_SUPER, ruta = '/stock/pedidos') {
  return renderConRouter([{ path: '/stock/pedidos', element: <PedidosPage tipo="componentes" /> }], { sesion, ruta })
}
const filas = () => screen.getAllByRole('row').slice(1).map((r) => r.textContent ?? '')
const abrirMenu = (texto: string) => userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText(texto).closest('tr') as HTMLElement })

describe('Pedidos agrupados por bloques (0.9.9)', () => {
  it('por defecto agrupa: del más reciente al más antiguo, vivos desplegados y terminados plegados, sin columna Proveedor', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    const t = filas()
    expect(t).toHaveLength(6)
    expect(t[0]).toContain('Bloque 41')
    expect(t[1]).toContain('lcd-x-negro')
    expect(t[2]).toContain('bat-x')
    expect(t[3]).toContain('Bloque 40')
    expect(t[4]).toContain('mc-x')
    expect(t[5]).toContain('Bloque 39')
    expect(screen.queryByRole('columnheader', { name: 'Proveedor' })).not.toBeInTheDocument()
  })

  it('el interruptor vuelve a la vista plana con la columna Bloque y el navegador lo recuerda', async () => {
    const { unmount } = montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.click(screen.getByRole('switch', { name: 'Agrupar por bloque' }))
    expect(screen.getByRole('columnheader', { name: 'Bloque' })).toBeInTheDocument()
    expect(screen.getByText('lcd-y')).toBeInTheDocument()
    expect(localStorage.getItem('pedidos.agruparPorBloque')).toBe('no')
    unmount()
    montar()
    await screen.findByText('lcd-x-negro')
    expect(screen.getByRole('switch', { name: 'Agrupar por bloque' })).toHaveAttribute('aria-checked', 'false')
  })

  it('plegar un bloque, «Plegar todo» y «Desplegar todo»', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.click(screen.getByRole('button', { name: 'Plegar bloque 41' }))
    expect(screen.queryByText('lcd-x-negro')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Plegar todo' }))
    expect(screen.queryByText('mc-x')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Desplegar todo' }))
    expect(screen.getByText('lcd-y')).toBeInTheDocument()
  })

  it('con el buscador: solo las líneas que cumplen, desplegadas y con «mostrando k de n»', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.type(screen.getByPlaceholderText('Buscar componente…'), 'lcd')
    expect(screen.getByText('mostrando 1 de 2')).toBeInTheDocument()
    expect(screen.getByText('lcd-y')).toBeInTheDocument()
    expect(screen.queryByText('bat-x')).not.toBeInTheDocument()
    expect(screen.queryByText('mc-x')).not.toBeInTheDocument()
  })

  it('mover una pendiente va sin preguntar; una en camino pide confirmación', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    await abrirMenu('lcd-x-negro')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover a bloque' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Bloque 40/ }))
    await waitFor(() => expect(escrituras).toEqual([`PATCH 1 {"idBloque":40,"updatedAt":"${U}"}`]))
    await abrirMenu('bat-x')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover a bloque' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Bloque nuevo/ }))
    const dlg = await screen.findByRole('dialog', { name: 'Mover línea ya pedida' })
    expect(dlg).toHaveTextContent('La línea bat-x (ID 2) está en camino. ¿Moverla a un bloque nuevo igualmente?')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Mover' }))
    await waitFor(() => expect(escrituras[1]).toBe(`PATCH 2 {"idBloque":null,"updatedAt":"${U}"}`))
  })

  it('⋮ del bloque → «Recibir todo» confirma y manda las en camino', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.click(screen.getByRole('button', { name: 'Acciones del bloque 41' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Recibir todo (1)' }))
    const dlg = await screen.findByRole('dialog', { name: 'Recibir todo · Bloque 41' })
    await userEvent.click(within(dlg).getByRole('button', { name: 'Recibir (1)' }))
    await waitFor(() => expect(escrituras).toEqual([`POST 41 recibir {"lineas":[{"idCompra":2,"updatedAt":"${U}"}]}`]))
  })

  it('el administrador ve los bloques sin ⋮', async () => {
    montar(SESION_ADMIN)
    await screen.findByText('lcd-x-negro')
    expect(screen.getByText('Bloque 41')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Acciones del bloque/ })).not.toBeInTheDocument()
  })

  it('con el ⋮ de un bloque abierto el sondeo se congela y vuelve al cerrarlo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.click(screen.getByRole('button', { name: 'Acciones del bloque 41' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS * 2) })
    expect(cargasCompras).toBe(1)
    await userEvent.keyboard('{Escape}')
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS) })
    await waitFor(() => expect(cargasCompras).toBeGreaterThan(1))
  })

  it('con un diálogo de bloque abierto («Añadir nota…») el sondeo se congela y vuelve al cerrarlo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.click(screen.getByRole('button', { name: 'Acciones del bloque 41' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Añadir nota…' }))
    const dlg = await screen.findByRole('dialog')
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS * 2) })
    expect(cargasCompras).toBe(1)
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS) })
    await waitFor(() => expect(cargasCompras).toBeGreaterThan(1))
  })

  it('llegada desde Stock con el bloque de la línea plegado: lo despliega y deja la fila seleccionada', async () => {
    const ruta = '/stock/pedidos?buscar=lcd-y'
    const llegada = filtrosDesdeStock(new URLSearchParams('buscar=lcd-y'))
    const firma = firmaFiltros({ ...FILTROS_PEDIDOS_VACIOS, ...filtrosPedidos.get(), ...llegada })
    plegadoBloques.set((p) => ({ ...p, filtrado: { firma, mapa: { '39': false } } }))
    montar(SESION_SUPER, ruta)
    await waitFor(() => expect(document.querySelector('tr[aria-selected="true"]')).toHaveTextContent('lcd-y'))
    expect(screen.getByText('Bloque 39')).toBeInTheDocument()
  })

  it('mover a un bloque que ya no existe: el aviso lleva el texto del servidor, no el genérico', async () => {
    server.use(http.patch('*/api/compras/:id/bloque', () => HttpResponse.json({ message: 'El bloque 40 ya no existe; elige otro destino.' }, { status: 409 })))
    montar()
    await screen.findByText('lcd-x-negro')
    await abrirMenu('lcd-x-negro')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover a bloque' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Bloque 40/ }))
    const aviso = await screen.findByRole('dialog')
    expect(aviso).toHaveTextContent('El bloque 40 ya no existe; elige otro destino.')
    expect(aviso).not.toHaveTextContent('Este pedido fue modificado')
  })
})
