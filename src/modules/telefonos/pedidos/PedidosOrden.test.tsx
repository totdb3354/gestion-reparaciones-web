import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { estadoNsys, fila, fuente } from '../test/fabrica'
import { congelarHoy } from '../test/hoy'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'

congelarHoy()

/** 0.9.39 (spec «ordenar por cabecera»): la columna SKU de Pedidos se ordena con un clic en su cabecera, y se ve que se puede. */
const FILAS = [
  fila({ idFila: 1, fecha: '2026-11-20', sku: 'i14128NegroA', pedido: 'P-1' }),
  fila({ idFila: 2, fecha: '2026-11-21', sku: 'i12064BlancoB', pedido: 'P-2' }),
  fila({ idFila: 3, fecha: '2026-11-22', sku: 'i13128AzulA', pedido: 'P-3' }),
]

beforeEach(() => {
  estadoPedidos.reset()
  server.use(
    http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: FILAS, hayMas: false })),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
  )
})

const abrir = () => renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
const tabla = () => screen.getByRole('region', { name: 'Tabla de pedidos' })
const skus = () => within(tabla()).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[2].textContent?.trim())

describe('Pedidos: ordenar por SKU', () => {
  it('la cabecera SKU se ve ordenable y cada clic ordena A-Z, Z-A y vuelve al orden de siempre', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByRole('button', { name: '3 filas' })
    const boton = within(tabla()).getByRole('button', { name: 'SKU' })
    const icono = () => boton.querySelector('[data-icono-orden]')?.getAttribute('data-icono-orden')
    const cabecera = () => within(tabla()).getByRole('columnheader', { name: /^SKU/ })
    expect(icono()).toBe('ninguno')
    expect(boton).toHaveAttribute('title', 'Ordenar por SKU: de la A a la Z (de menor a mayor)')
    expect(skus()).toEqual(['i14128NegroA', 'i12064BlancoB', 'i13128AzulA'])

    await user.click(boton)
    expect(skus()).toEqual(['i12064BlancoB', 'i13128AzulA', 'i14128NegroA'])
    expect(icono()).toBe('asc')
    expect(cabecera()).toHaveAttribute('aria-sort', 'ascending')

    await user.click(boton)
    expect(skus()).toEqual(['i14128NegroA', 'i13128AzulA', 'i12064BlancoB'])
    expect(icono()).toBe('desc')

    await user.click(boton)
    expect(skus()).toEqual(['i14128NegroA', 'i12064BlancoB', 'i13128AzulA'])
    expect(cabecera()).not.toHaveAttribute('aria-sort')
  })

  it('las demás columnas no se ordenan (no llevan botón de orden)', async () => {
    abrir()
    await screen.findByRole('button', { name: '3 filas' })
    for (const c of ['Fecha', 'Plataforma', 'IMEI', 'Pedido', 'Enviado']) expect(within(tabla()).queryByRole('button', { name: c })).toBeNull()
  })

  it('«Quitar filtros» no quita el orden', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByRole('button', { name: '3 filas' })
    await user.click(within(tabla()).getByRole('button', { name: 'SKU' }))
    await user.type(screen.getByLabelText('Buscar en todo el historial'), 'x')
    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    expect(estadoPedidos.get().ordenSku).toBe('asc')
  })
})
