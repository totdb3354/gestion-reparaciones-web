import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { maquetarJsdom } from '@/test/layoutJsdom'
import { estadoNsys, fila, fuente } from '../test/fabrica'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'

// «Previsualizar etiqueta» del panel de la fila (spec v2 §3.2). Datos inventados.
const FILAS = [
  fila({ idFila: 1, canal: 'AMAZON', plataforma: 'AMZ', pedido: '402-0000000-0000041' }),
  fila({ idFila: 3, canal: 'DISTRIBUIDORES', plataforma: 'Cliente Web B', pedido: '402-0000000-0000043', estado: 'ENVIADA', envioFecha: '2026-11-09T10:30:00', impresaEn: '2026-11-10T09:15:00', tieneEtiqueta: true, transportista: 'UPSv2', seguimiento: '1Z0000000000000002' }),
]
const AVISO = 'Previsualización. Imprimir desde aquí no marca el pedido como enviado: imprime la etiqueta desde ShippyPro.'

let peticiones: string[] = []
let respuesta: () => Response = () => pdf()
const pdf = () => new HttpResponse('%PDF-1.4 sintetico', { headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' } })
const crear = vi.fn(() => 'blob:etiqueta-1')
const revocar = vi.fn()

beforeEach(() => {
  peticiones = []
  respuesta = pdf
  crear.mockClear(); revocar.mockClear()
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: crear, revokeObjectURL: revocar }))
  estadoPedidos.reset()
  maquetarJsdom()
  server.use(
    http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: FILAS, hayMas: false })),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    http.get('*/api/pedidos/filas/:id/cambios', () => HttpResponse.json([])),
    http.get('*/api/pedidos/filas/:id/etiqueta', ({ params }) => { peticiones.push(String(params.id)); return respuesta() }),
  )
})
afterEach(() => { vi.unstubAllGlobals() })

const abrirPanel = async (celda: string) => {
  const user = userEvent.setup()
  renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
  await screen.findByRole('button', { name: '2 filas' })
  await user.click(screen.getAllByText(celda)[0])
  await screen.findByRole('region', { name: 'Detalle del pedido' })
  return user
}
const boton = () => screen.queryByRole('button', { name: 'Previsualizar etiqueta' })

describe('Previsualizar etiqueta', () => {
  it('el botón solo sale en el panel de una fila con etiqueta y no pide nada hasta pulsarlo', async () => {
    const user = await abrirPanel('AMZ')
    expect(boton()).toBeNull()
    await user.click(screen.getAllByText('Cliente Web B')[0])
    expect(boton()).toBeInTheDocument()
    expect(peticiones).toEqual([])
    await user.click(boton()!)
    await screen.findByTitle('Etiqueta')
    expect(peticiones).toEqual(['3'])
  })

  it('el diálogo enseña el aviso, la etiqueta de estado con el pedido y un iframe con la URL del objeto; no hay botón de imprimir', async () => {
    const user = await abrirPanel('Cliente Web B')
    await user.click(boton()!)
    const dialogo = await screen.findByRole('dialog', { name: 'Previsualización de la etiqueta' })
    expect(dialogo).toHaveTextContent(AVISO)
    expect(dialogo).toHaveTextContent('Enviado 10/11')
    expect(dialogo).toHaveTextContent('402-0000000-0000043')
    const marco = await screen.findByTitle('Etiqueta')
    expect(marco).toHaveAttribute('src', 'blob:etiqueta-1')
    expect(screen.getByRole('link', { name: 'Abrir en una pestaña nueva' })).toHaveAttribute('href', 'blob:etiqueta-1')
    expect(screen.queryByRole('button', { name: /imprimir/i })).toBeNull()
  })

  it('mientras llega dice «Cargando la etiqueta…»', async () => {
    let soltar = () => {}
    const espera = new Promise<void>((r) => { soltar = r })
    server.use(http.get('*/api/pedidos/filas/:id/etiqueta', async () => { await espera; return pdf() }))
    const user = await abrirPanel('Cliente Web B')
    await user.click(boton()!)
    expect(await screen.findByText('Cargando la etiqueta…')).toBeInTheDocument()
    soltar()
    await screen.findByTitle('Etiqueta')
  })

  it.each([
    [404, 'Este pedido no tiene etiqueta generada'],
    [502, 'No se pudo obtener la etiqueta de ShippyPro. Inténtalo de nuevo.'],
    [400, 'No se pudo cargar la etiqueta.'],
  ])('un %i dice «%s» dentro del diálogo, sin diálogo de error, y «Reintentar» vuelve a pedirla', async (estado, texto) => {
    respuesta = () => HttpResponse.json({ message: texto }, { status: estado })
    const user = await abrirPanel('Cliente Web B')
    await user.click(boton()!)
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Error' })).toBeNull()
    expect(peticiones).toEqual(['3'])
    respuesta = pdf
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByTitle('Etiqueta')).toHaveAttribute('src', 'blob:etiqueta-1')
    expect(peticiones).toEqual(['3', '3'])
  })

  it('al cerrar con Escape se libera la URL del objeto, se cierra solo el diálogo y el foco vuelve al botón', async () => {
    const user = await abrirPanel('Cliente Web B')
    await user.click(boton()!)
    await screen.findByTitle('Etiqueta')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(revocar).toHaveBeenCalledWith('blob:etiqueta-1')
    expect(screen.getByRole('region', { name: 'Detalle del pedido' })).toBeInTheDocument()
    expect(boton()).toHaveFocus()
  })
})
