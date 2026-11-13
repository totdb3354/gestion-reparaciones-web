import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { maquetarJsdom } from '@/test/layoutJsdom'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { estadoNsys, fila, fuente } from '../test/fabrica'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'

// Spec Pedidos v2 §5: por encima del umbral se pinta solo lo visible. El umbral se baja con la propiedad para no necesitar 5.000 filas.
const NOTA = 'Tabla grande: se pinta solo lo que se ve. Para buscar usa el buscador (Control+F).'
const crear = (n: number) => Array.from({ length: n }, (_, i) => fila({
  idFila: i + 1, pedido: `402-0000000-${String(i + 1).padStart(7, '0')}`, plataforma: i % 2 ? 'Web' : 'Amazon', imei: i % 3 === 0 ? '350000000000001' : null,
}))
let filas = crear(0)

afterEach(() => { vi.restoreAllMocks() })

beforeEach(() => {
  estadoPedidos.reset()
  server.use(
    http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas, hayMas: false })),
    http.get('*/api/pedidos/filas/:id/recomendados', () => HttpResponse.json([])),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
  )
})

const abrir = (umbral: number) => renderConProviders(<PedidosPage umbralVentana={umbral} />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
const trs = () => screen.getAllByRole('row').filter((r) => r.hasAttribute('data-estado')).length
const region = () => screen.getByRole('region', { name: 'Tabla de pedidos' })
const buscador = () => screen.getByLabelText('Buscar en todo el historial')
const ctrlF = () => fireEvent.keyDown(document.body, { key: 'f', ctrlKey: true })

describe('Pedidos: tabla con muchas filas', () => {
  it('hasta el umbral (incluido) se pintan todas y Control+F no se intercepta', async () => {
    filas = crear(20)
    abrir(20)
    await screen.findByRole('button', { name: '20 filas' })
    expect(trs()).toBe(20)
    expect(screen.queryByText(NOTA)).toBeNull()
    expect(ctrlF()).toBe(true) // fireEvent devuelve false si alguien hizo preventDefault
    expect(buscador()).not.toHaveFocus()
  })

  it('por encima del umbral pinta solo las visibles, los contadores cuentan todas, enseña la nota y Control+F va al buscador', async () => {
    filas = crear(300)
    abrir(20)
    await screen.findByRole('button', { name: '300 filas' })
    expect(screen.getByText(NOTA)).toBeInTheDocument()
    expect(trs()).toBeGreaterThan(0)
    expect(trs()).toBeLessThan(60)
    expect(screen.getByRole('button', { name: '200 sin IMEI' })).toBeInTheDocument()
    expect(ctrlF()).toBe(false)
    expect(buscador()).toHaveFocus()
  })

  it('con scroll al final se llega a la última fila (y la primera deja de estar)', async () => {
    filas = crear(300)
    abrir(20)
    await screen.findByRole('button', { name: '300 filas' })
    expect(screen.queryByRole('button', { name: '402-0000000-0000300' })).toBeNull()
    const c = region()
    c.scrollTop = 300 * 32 + 1000
    fireEvent.scroll(c)
    expect(await screen.findByRole('button', { name: '402-0000000-0000300' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '402-0000000-0000001' })).toBeNull()
    expect(trs()).toBeLessThan(60)
  })

  it('al cruzar el umbral con un filtro, la fila elegida y la raya azul se conservan y se vuelve a pintar todo', async () => {
    const user = userEvent.setup()
    filas = crear(30)
    abrir(20)
    await screen.findByRole('button', { name: '30 filas' })
    await user.click(screen.getByRole('button', { name: '402-0000000-0000005' }))
    await screen.findByRole('region', { name: 'Detalle del pedido' })
    estadoPedidos.set((s) => ({ ...s, filaAqui: 7 }))
    expect(document.querySelector('tr[data-aqui]')).not.toBeNull()
    // 30 > 20: ventana. Un filtro que deja 20 filas la quita.
    await user.click(screen.getByRole('button', { name: '20 sin IMEI' }))
    await waitFor(() => expect(screen.queryByText(NOTA)).toBeNull())
    expect(trs()).toBe(20)
    await user.click(screen.getByRole('button', { name: '30 filas' }))
    await waitFor(() => expect(screen.getByText(NOTA)).toBeInTheDocument())
    expect(estadoPedidos.get().filaElegida).toBe(5)
    expect(estadoPedidos.get().filaAqui).toBe(7)
    expect(screen.getByRole('region', { name: 'Detalle del pedido' })).toHaveTextContent('402-0000000-0000005')
    expect(document.querySelector('tr[data-aqui]')?.textContent).toContain('402-0000000-0000007')
  })

  it('la fila con la celda del IMEI abierta sigue pintada (y con lo tecleado) aunque salga de la ventana; con el desplegable abierto Control+F no se intercepta', async () => {
    maquetarJsdom()
    const user = userEvent.setup()
    filas = crear(300)
    abrir(20)
    await screen.findByRole('button', { name: '300 filas' })
    await user.click(screen.getAllByRole('button', { name: /pulsa para poner el IMEI/ })[0])
    await user.type(screen.getByRole('textbox', { name: 'IMEI' }), '35000')
    const c = region()
    c.scrollTop = 300 * 32 + 1000
    fireEvent.scroll(c)
    expect(await screen.findByRole('button', { name: '402-0000000-0000300' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'IMEI' })).toHaveValue('35000')
    expect(trs()).toBeLessThan(60)
    expect(ctrlF()).toBe(true)
  })

  it('en modo ventana la tabla dice cuantas filas tiene y cada fila su numero', async () => {
    filas = crear(300)
    abrir(20)
    await screen.findByRole('button', { name: '300 filas' })
    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '301')
    expect(document.querySelector('tbody tr[data-estado]')).toHaveAttribute('aria-rowindex', '2')
  })
})
