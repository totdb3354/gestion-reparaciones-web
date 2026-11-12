import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { estadoNsys, fila, fuente } from '../test/fabrica'
import { maquetarJsdom } from '@/test/layoutJsdom'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'
import { TablaFilas } from './TablaFilas'

// Al guardar un IMEI tecleado o leído, el foco pasa a la siguiente celda vacía de abajo, sin esperar al servidor.
const pedido = (i: number) => `402-0000000-${String(i).padStart(7, '0')}`
const f = (i: number, extra: Parameters<typeof fila>[0] = {}) => fila({ idFila: i, pedido: pedido(i), ...extra })
const campo = () => screen.queryByRole('textbox', { name: 'IMEI' })
let puts: { id: string; imei: string | null }[] = []
let recomendados = 0

afterEach(() => { vi.restoreAllMocks() })
beforeEach(() => {
  puts = []
  recomendados = 0
  estadoPedidos.reset()
  maquetarJsdom()
  server.use(
    http.get('*/api/pedidos/filas/:id/recomendados', () => { recomendados++; return HttpResponse.json([]) }),
    http.put('*/api/pedidos/filas/:id/imei', async ({ request, params }) => {
      const cuerpo = (await request.json()) as { imei: string | null }
      puts.push({ id: String(params.id), imei: cuerpo.imei })
      return HttpResponse.json(fila({ idFila: Number(params.id) }))
    }),
  )
})

const abrirTabla = (filas: ReturnType<typeof f>[]) => renderConProviders(<TablaFilas filas={filas} />, { sesion: SESION_SUPER })
const vacia = async (n = 0) => (await screen.findAllByRole('button', { name: /pulsa para poner el IMEI/ }))[n]
const aqui = () => document.querySelector('tr[data-aqui]')

describe('TablaFilas: salto a la siguiente celda vacía', () => {
  it('salta a la siguiente fila editable sin IMEI, saltándose las que ya tienen y las no editables', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2, { imei: '350000000000002' }), f(3, { estado: 'HISTORICO', editable: false }), f(4)])
    await user.click(await vacia())
    await user.keyboard('350000000000011')
    await waitFor(() => expect(puts).toEqual([{ id: '1', imei: '350000000000011' }]))
    await waitFor(() => expect(campo()).toHaveFocus())
    expect(campo()).toHaveValue('')
    expect(aqui()).toHaveTextContent(pedido(4))
    expect(screen.getAllByRole('textbox', { name: 'IMEI' })).toHaveLength(1)
  })

  it('con Enter tras las 15 cifras también salta, y el Enter del lector que llega a la celda nueva no da error', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard('350000000000011{Enter}{Enter}')
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(2)))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(puts).toEqual([{ id: '1', imei: '350000000000011' }])
  })

  it('sin ninguna vacía por debajo, se cierra (aunque haya una vacía por encima)', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia(1))
    await user.keyboard('350000000000022')
    await waitFor(() => expect(puts).toEqual([{ id: '2', imei: '350000000000022' }]))
    await waitFor(() => expect(campo()).not.toBeInTheDocument())
  })

  it('dos lecturas seguidas sin esperar dejan cada IMEI en su fila y un solo guardado por fila', async () => {
    const user = userEvent.setup()
    let liberar = () => {}
    const espera = new Promise<void>((r) => { liberar = r })
    server.use(http.put('*/api/pedidos/filas/:id/imei', async ({ request, params }) => {
      puts.push({ id: String(params.id), imei: ((await request.json()) as { imei: string }).imei })
      await espera
      return HttpResponse.json(fila({ idFila: Number(params.id) }))
    }))
    abrirTabla([f(1), f(2), f(3)])
    await user.click(await vacia())
    await user.keyboard('350000000000011{Enter}350000000000022{Enter}')
    liberar()
    await waitFor(() => expect(puts).toHaveLength(2))
    expect(puts).toEqual([{ id: '1', imei: '350000000000011' }, { id: '2', imei: '350000000000022' }])
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(3)))
    expect(campo()).toHaveValue('')
  })

  it('si falla el guardado de la anterior, sale el diálogo de error y la siguiente sigue abierta', async () => {
    const user = userEvent.setup()
    server.use(http.put('*/api/pedidos/filas/:id/imei', ({ params }) => { puts.push({ id: String(params.id), imei: null }); return HttpResponse.json({ message: 'No se pudo' }, { status: 422 }) }))
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard('350000000000011')
    expect(await screen.findByText('No se pudo')).toBeInTheDocument()
    expect(aqui()).toHaveTextContent(pedido(2))
    expect(puts).toHaveLength(1)
  })

  it('«Quitar el IMEI» no salta: se cierra', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1, { imei: '350000000000001' }), f(2)])
    await user.click(await screen.findByRole('button', { name: /350000000000001/ }))
    await user.click(screen.getByRole('button', { name: 'Quitar el IMEI' }))
    await waitFor(() => expect(puts).toEqual([{ id: '1', imei: null }]))
    await waitFor(() => expect(campo()).not.toBeInTheDocument())
  })
})

describe('TablaFilas: recomendados plegados', () => {
  it('se abre plegado y sin pedir nada; «Ver recomendados» los despliega y los pide; cada celda empieza plegada', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await waitFor(() => expect(campo()).toHaveFocus())
    const ver = screen.getByRole('button', { name: 'Ver recomendados' })
    expect(ver).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/dónde buscarlo/)).not.toBeInTheDocument()
    expect(recomendados).toBe(0)
    await user.click(ver)
    expect(screen.getByRole('button', { name: 'Ocultar recomendados' })).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByText(/No hay ningún móvil de ese modelo/)).toBeInTheDocument()
    expect(recomendados).toBe(1)
    await user.click(await screen.findByRole('button', { name: 'Cerrar' }))
    await user.click((await screen.findAllByRole('button', { name: /pulsa para poner el IMEI/ }))[1])
    expect(await screen.findByRole('button', { name: 'Ver recomendados' })).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('Pedidos: sin la etiqueta «a la vista» y salto en la tabla grande', () => {
  const FILAS = Array.from({ length: 300 }, (_, i) => f(i + 1, { imei: i === 0 || i === 289 ? null : '350000000000001' }))
  it('filtrar no añade «N a la vista» y, en modo ventana, el salto lleva a una fila que no estaba pintada', async () => {
    server.use(
      http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: FILAS, hayMas: false })),
      http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
      http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    )
    const user = userEvent.setup()
    renderConProviders(<PedidosPage umbralVentana={20} />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
    await screen.findByRole('button', { name: '300 filas' })
    await user.click(screen.getByRole('button', { name: '2 sin IMEI' }))
    expect(screen.queryByText(/a la vista/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '300 filas' }))
    // Se sube al principio: la fila 1 es la primera vacía y la 290, la siguiente, queda muy lejos de lo pintado.
    const region = screen.getByRole('region', { name: 'Tabla de pedidos' })
    region.scrollTop = 0
    fireEvent.scroll(region)
    await user.click(await screen.findByRole('button', { name: /pulsa para poner el IMEI/ }))
    expect(screen.queryByText(pedido(290))).not.toBeInTheDocument()
    await user.keyboard('350000000000011')
    await waitFor(() => expect(screen.getByText(pedido(290))).toBeInTheDocument())
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(290)))
    await waitFor(() => expect(campo()).toHaveFocus())
  })
})
