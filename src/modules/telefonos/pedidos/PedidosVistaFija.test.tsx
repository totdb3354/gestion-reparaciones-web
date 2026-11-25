import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { maquetarJsdom } from '@/test/layoutJsdom'
import { estadoNsys, fila, fuente } from '../test/fabrica'
import { imeiValido } from '../test/imeiValido'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'
import { congelarHoy } from '../test/hoy'

congelarHoy()

const pedido = (i: number) => `402-0000000-${String(i).padStart(7, '0')}`
let filas = [fila({ idFila: 1, pedido: pedido(1) }), fila({ idFila: 2, pedido: pedido(2) }), fila({ idFila: 3, pedido: pedido(3), imei: imeiValido(3) })]

afterEach(() => { vi.restoreAllMocks() })
beforeEach(() => {
  estadoPedidos.reset()
  maquetarJsdom()
  filas = [fila({ idFila: 1, pedido: pedido(1) }), fila({ idFila: 2, pedido: pedido(2) }), fila({ idFila: 3, pedido: pedido(3), imei: imeiValido(3) })]
  server.use(
    http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas, hayMas: false })),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    http.get('*/api/pedidos/filas/:id/recomendados', () => HttpResponse.json([])),
    http.put('*/api/pedidos/filas/:id/imei', async ({ request, params }) => {
      const { imei } = (await request.json()) as { imei: string | null }
      const nueva = fila({ idFila: Number(params.id), pedido: pedido(Number(params.id)), imei })
      filas = filas.map((f) => (f.idFila === nueva.idFila ? nueva : f))
      return HttpResponse.json(nueva)
    }),
  )
})

const abrir = () => renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
const tabla = () => screen.getByRole('region', { name: 'Tabla de pedidos' })

describe('Pedidos: la vista filtrada no se mueve', () => {
  it('con «sin IMEI» puesto, la fila picada se queda; pulsar el contador otra vez la saca', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: '2 sin IMEI' }))
    expect(within(tabla()).queryByText(pedido(3))).not.toBeInTheDocument()
    await user.click(within(tabla()).getAllByRole('button', { name: /pulsa para poner el IMEI/ })[0])
    await user.keyboard(`${imeiValido(1)}{Enter}`)
    await screen.findByRole('button', { name: '1 sin IMEI' })
    expect(within(tabla()).getByText(pedido(1))).toBeInTheDocument()
    expect(within(tabla()).getByText(imeiValido(1))).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: '1 sin IMEI' }))
    await waitFor(() => expect(within(tabla()).queryByText(pedido(1))).not.toBeInTheDocument())
    expect(within(tabla()).getByText(pedido(2))).toBeInTheDocument()
  })

  it('un IMEI puesto por otro (sondeo) tampoco saca la fila; un pedido nuevo que cumple entra', async () => {
    const user = userEvent.setup()
    const { queryClient } = abrir()
    await user.click(await screen.findByRole('button', { name: '2 sin IMEI' }))
    filas = [fila({ idFila: 1, pedido: pedido(1), imei: imeiValido(9) }), filas[1], filas[2], fila({ idFila: 4, pedido: pedido(4) })]
    await queryClient.invalidateQueries()
    await screen.findByText(pedido(4))
    expect(within(tabla()).getByText(pedido(1))).toBeInTheDocument()
  })
})
