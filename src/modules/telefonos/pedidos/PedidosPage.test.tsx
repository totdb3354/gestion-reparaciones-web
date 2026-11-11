import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { candidato, estadoNsys, fila, fuente } from '../test/fabrica'
import { PedidosPage } from './PedidosPage'
import { maquetarJsdom } from '@/test/layoutJsdom'

const FILAS = [
  fila({ idFila: 1, enviada: true, imei: '350000000000010', pedido: '402-0000000-0000011' }),
  fila({ idFila: 2, pedido: '402-0000000-0000012', imei: '350000000000001', nivel: 'OK', caja: 'CAJA LISTOS' }),
  fila({ idFila: 3, pedido: '402-0000000-0000013' }),
  fila({ idFila: 4, pedido: '402-0000000-0000014', imei: '350000000000999', nivel: 'MAL', motivo: 'COLOR_O_GRADO', skuMovil: 'i14eSIM128RojoA', caja: 'CAJA LISTOS' }),
  fila({ idFila: 5, pedido: '402-0000000-0000015', imei: '350000000000002', nivel: 'AVISO', motivo: 'MS' }),
]

let puts: { id: string; cuerpo: unknown }[] = []

afterEach(() => { vi.restoreAllMocks() })

beforeEach(() => {
  puts = []
  maquetarJsdom()
  server.use(
    http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: FILAS, hayMas: false })),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    http.get('*/api/pedidos/filas/:id/recomendados', () => HttpResponse.json([
      candidato({ imei: '350000000000101', caja: 'CAJA LISTOS', nivel: 1 }),
      candidato({ imei: '350000000000103', caja: 'Taller', nivel: 3 }),
    ])),
    http.put('*/api/pedidos/filas/:id/imei', async ({ request, params }) => {
      puts.push({ id: String(params.id), cuerpo: await request.json() })
      return HttpResponse.json(fila({ idFila: Number(params.id) }))
    }),
  )
})

const abrir = () => renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
const celdaVacia = async () => screen.findByRole('button', { name: /pulsa para poner el IMEI/ })
const campo = () => screen.queryByRole('textbox', { name: 'IMEI' })

describe('Pedidos como la hoja: la tabla', () => {
  it('cabecera con el recuento y la tabla con sus seis columnas, sin letras ni número de fila', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(await screen.findByText('5 filas · 4 sin enviar · 1 sin IMEI')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Fecha', 'Plataforma', 'SKU', 'IMEI', 'Pedido', 'Fecha compra'])
    expect(screen.getAllByRole('row')).toHaveLength(6)
    expect(screen.getAllByText('09/11/2026').length).toBeGreaterThan(0)
  })

  it('la celda mal lleva su motivo; la que cuadra, su caja; la vacía invita a poner el IMEI', async () => {
    abrir()
    const mal = await screen.findByRole('button', { name: /350000000000999/ })
    expect(mal).toHaveTextContent('otro color o grado: es i14eSIM128RojoA')
    expect(screen.getByRole('button', { name: /350000000000001/ })).toHaveTextContent('CAJA LISTOS')
    expect(screen.getByRole('button', { name: /350000000000002/ })).toHaveTextContent('es un Ms')
    expect(await celdaVacia()).toBeInTheDocument()
  })

  it('una fila enviada no abre el desplegable', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByText('350000000000010'))
    expect(campo()).not.toBeInTheDocument()
  })

  it('sin filas, lo dice', async () => {
    server.use(http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: [], hayMas: false })))
    abrir()
    expect(await screen.findByText('No hay pedidos en este periodo.')).toBeInTheDocument()
  })
})

describe('Pedidos como la hoja: la celda del IMEI', () => {
  it('abre el desplegable con los recomendados, su caja y su nivel', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await celdaVacia())
    expect(campo()).toBeInTheDocument()
    await waitFor(() => expect(campo()).toHaveFocus())
    const c = await screen.findByRole('button', { name: /350000000000101/ })
    expect(c).toHaveTextContent('CAJA LISTOS')
    expect(c).toHaveTextContent('igual que el pedido')
    expect(screen.getByRole('button', { name: /350000000000103/ })).toHaveTextContent('hay que transformarlo')
    expect(screen.queryByRole('button', { name: 'Quitar el IMEI' })).not.toBeInTheDocument()
    // El SKU del título sale tal cual (sin pasarlo a mayúsculas).
    const sku = screen.getByText('i13128AzulA', { selector: 'span.normal-case' })
    expect(sku.parentElement).toHaveTextContent('Recomendados para i13128AzulA')
  })

  it('elegir un candidato hace PUT con ese IMEI y cierra', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await celdaVacia())
    await user.click(await screen.findByRole('button', { name: /350000000000101/ }))
    await waitFor(() => expect(puts).toEqual([{ id: '3', cuerpo: { imei: '350000000000101' } }]))
    await waitFor(() => expect(campo()).not.toBeInTheDocument())
  })

  it('escribir 15 cifras y Enter guarda', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await celdaVacia())
    await user.type(campo() as HTMLElement, '350000000000555{Enter}')
    await waitFor(() => expect(puts).toEqual([{ id: '3', cuerpo: { imei: '350000000000555' } }]))
  })

  it('escribir 14 cifras no llama y enseña el mensaje bajo el campo', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await celdaVacia())
    await user.type(campo() as HTMLElement, '35000000000055{Enter}')
    expect(screen.getByText('Un IMEI son 15 cifras')).toBeInTheDocument()
    expect(puts).toEqual([])
  })

  it('«Quitar el IMEI» manda null', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: /350000000000999/ }))
    await user.click(screen.getByRole('button', { name: 'Quitar el IMEI' }))
    await waitFor(() => expect(puts).toEqual([{ id: '4', cuerpo: { imei: null } }]))
  })

  it('Escape, «Cerrar» y el clic fuera cierran; solo hay uno abierto', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await celdaVacia())
    await user.keyboard('{Escape}')
    expect(campo()).not.toBeInTheDocument()
    expect(await celdaVacia()).toHaveFocus()
    await user.click(await celdaVacia())
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(campo()).not.toBeInTheDocument()
    await user.click(await celdaVacia())
    await user.click(screen.getByRole('heading', { name: 'Pedidos' }))
    expect(campo()).not.toBeInTheDocument()
    await user.click(await celdaVacia())
    await user.click(screen.getByRole('button', { name: /350000000000001/ }))
    expect(screen.getAllByRole('textbox', { name: 'IMEI' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: /350000000000001/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('si el PUT falla, el desplegable sigue abierto con lo escrito', async () => {
    const user = userEvent.setup()
    server.use(http.put('*/api/pedidos/filas/:id/imei', () => { puts.push({ id: 'x', cuerpo: null }); return HttpResponse.json({ message: 'No se pudo' }, { status: 422 }) }))
    abrir()
    await user.click(await celdaVacia())
    await user.type(campo() as HTMLElement, '350000000000555{Enter}')
    await waitFor(() => expect(puts).toHaveLength(1))
    // El desplegable también es role=dialog: el de error se distingue por su texto.
    expect(await screen.findByText('No se pudo')).toBeInTheDocument()
    // El diálogo de error (modal) deja el resto fuera del árbol de accesibilidad: se busca con `hidden`.
    const abierto = screen.getByRole('textbox', { name: 'IMEI', hidden: true })
    expect(abierto).toHaveValue('350000000000555')
  })

  it('un segundo Enter con el PUT pendiente no manda otra petición', async () => {
    const user = userEvent.setup()
    let liberar = () => {}
    const espera = new Promise<void>((r) => { liberar = r })
    server.use(http.put('*/api/pedidos/filas/:id/imei', async ({ params }) => {
      puts.push({ id: String(params.id), cuerpo: null })
      await espera
      return HttpResponse.json(fila({ idFila: Number(params.id) }))
    }))
    abrir()
    await user.click(await celdaVacia())
    await user.type(campo() as HTMLElement, '350000000000555{Enter}{Enter}')
    // Los dos Enter ya se han tecleado (user.type espera): el segundo no pudo mandar otra petición mientras la primera seguía pendiente.
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(campo()).toHaveAttribute('readonly')
    liberar()
    await waitFor(() => expect(campo()).not.toBeInTheDocument())
    expect(puts).toHaveLength(1)
  })

  it('mientras llegan los recomendados dice «Cargando…»; sin ninguno, que no hay', async () => {
    const user = userEvent.setup()
    let liberar = () => {}
    const espera = new Promise<void>((r) => { liberar = r })
    server.use(http.get('*/api/pedidos/filas/:id/recomendados', async () => { await espera; return HttpResponse.json([]) }))
    abrir()
    await user.click(await celdaVacia())
    expect(await screen.findByText('Cargando…')).toBeInTheDocument()
    liberar()
    expect(await screen.findByText(/No hay ningún móvil de ese modelo/)).toBeInTheDocument()
  })

  it('un sondeo con filas nuevas deja abierto el desplegable con lo escrito', async () => {
    const user = userEvent.setup()
    const { queryClient } = abrir()
    await user.click(await celdaVacia())
    await user.type(campo() as HTMLElement, '3500000')
    server.use(http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: FILAS.map((f) => ({ ...f, plataforma: 'Plataforma Z' })), hayMas: false })))
    await queryClient.invalidateQueries()
    await waitFor(() => expect(screen.getAllByText('Plataforma Z').length).toBe(5))
    expect(campo()).toHaveValue('3500000')
  })
})
