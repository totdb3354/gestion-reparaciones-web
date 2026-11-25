import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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

  /** Pone el IMEI a la fila 1 desde la tabla y la deja a la vista (con «sin IMEI» puesto, fija). */
  const picarLaPrimera = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: '2 sin IMEI' }))
    await user.click(within(tabla()).getAllByRole('button', { name: /pulsa para poner el IMEI/ })[0])
    await user.keyboard(`${imeiValido(1)}{Enter}`)
    await screen.findByRole('button', { name: '1 sin IMEI' })
    await user.keyboard('{Escape}')
    expect(within(tabla()).getByText(pedido(1))).toBeInTheDocument()
  }

  it('cambiar el periodo rehace la vista: la fila picada que se quedaba desaparece', async () => {
    const user = userEvent.setup()
    abrir()
    await picarLaPrimera(user)
    await user.selectOptions(screen.getByLabelText('Periodo:'), 'Últimos 3 meses')
    await waitFor(() => expect(within(tabla()).queryByText(pedido(1))).not.toBeInTheDocument())
    expect(within(tabla()).getByText(pedido(2))).toBeInTheDocument()
  })

  it('cambiar la búsqueda rehace la vista', async () => {
    const user = userEvent.setup()
    abrir()
    await picarLaPrimera(user)
    fireEvent.change(screen.getByLabelText('Buscar en todo el historial'), { target: { value: '402' } })
    await waitFor(() => expect(within(tabla()).queryByText(pedido(1))).not.toBeInTheDocument())
    expect(within(tabla()).getByText(pedido(2))).toBeInTheDocument()
  })

  it('una fila que el servidor deja de mandar desaparece de la vista', async () => {
    const user = userEvent.setup()
    const { queryClient } = abrir()
    await user.click(await screen.findByRole('button', { name: '2 sin IMEI' }))
    expect(within(tabla()).getByText(pedido(2))).toBeInTheDocument()
    filas = [filas[0], filas[2]]
    await queryClient.invalidateQueries()
    await waitFor(() => expect(within(tabla()).queryByText(pedido(2))).not.toBeInTheDocument())
    expect(within(tabla()).getByText(pedido(1))).toBeInTheDocument()
  })

  it('con datos viejos en pantalla (placeholder) no se fija nada: la fila que cambió mientras llegaban los nuevos se juzga con lo fresco', async () => {
    const user = userEvent.setup()
    let soltar: () => void = () => {}
    let retener = false
    const espera = new Promise<void>((r) => { soltar = r })
    server.use(http.get('*/api/pedidos/filas', async () => {
      if (retener) await espera
      return HttpResponse.json({ filas, hayMas: false })
    }))
    abrir()
    await user.click(await screen.findByRole('button', { name: '2 sin IMEI' }))
    expect(within(tabla()).getByText(pedido(1))).toBeInTheDocument()
    // Cambia el periodo: la segunda petición queda retenida (se ven los datos viejos) y mientras tanto la fila 1 recibe IMEI.
    retener = true
    filas = [fila({ idFila: 1, pedido: pedido(1), imei: imeiValido(1) }), filas[1], filas[2]]
    await user.selectOptions(screen.getByLabelText('Periodo:'), 'Últimos 3 meses')
    soltar()
    // Con datos frescos la fila 1 ya no es «sin IMEI»: si se hubiera fijado con los viejos, se quedaría.
    await waitFor(() => expect(within(tabla()).queryByText(pedido(1))).not.toBeInTheDocument())
    expect(within(tabla()).getByText(pedido(2))).toBeInTheDocument()
  })
})

