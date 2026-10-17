import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Route } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { estadoNsys, movil, movilBuscado } from '../test/fabrica'
import { StockTelefonosPage } from './StockTelefonosPage'

const STOCK = [
  movil({ imeiSn: '350000000000001', color: 'Azul', grado: 'A', ubicacion: 'Listos' }),
  movil({ imeiSn: '350000000000002', color: 'Azul', grado: 'A-', bateriaNueva: true, ubicacion: 'Taller · Glass', estado: 'DE_PEDIDO' }),
  movil({ imeiSn: '350000000000003', color: 'Rosa', grado: 'n/a', ubicacion: 'En revisión' }),
  movil({ imeiSn: '350000000000004', color: 'Azul', grado: 'B', ubicacion: 'Esperando pieza', estado: 'NO_CUENTA' }),
  movil({ imeiSn: '350000000000005', modelo: '14', modeloMaestro: '14', ubicacion: 'Listos' }),
]

beforeEach(() => {
  server.use(
    http.get('*/api/stock-telefonos', () => HttpResponse.json(STOCK)),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
  )
})

const abrir = () => renderConProviders(<StockTelefonosPage />, {
  sesion: SESION_SUPER, ruta: '/telefonos/stock',
  rutas: <Route path="/reparaciones/imeis/:imei" element={<p>Detalle del IMEI</p>} />,
})
const filas = () => screen.getAllByRole('row').slice(1)

describe('Stock de teléfonos (spec pieza 1 §9.2)', () => {
  it('cabecera con el total en stock, la píldora de NSYS y los modelos con sus totales', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Stock de teléfonos' })).toBeInTheDocument()
    expect(await screen.findByText('4 móviles en stock')).toBeInTheDocument()
    expect(screen.getByText(/^NSYS: /)).toHaveAttribute('role', 'status')
    const modelos = within(screen.getByRole('navigation', { name: 'Modelos' })).getAllByRole('button')
    expect(modelos.map((b) => b.textContent?.match(/^iPhone \d+ \d+GB/)?.[0])).toEqual(['iPhone 14 128GB', 'iPhone 13 128GB'])
    expect(modelos[1]).toHaveTextContent('2 libres')
  })

  it('al elegir un modelo salen sus móviles y los filtros de un clic se combinan', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: /^iPhone 13 128GB/ }))
    expect(filas()).toHaveLength(3)
    expect(filas()[0]).toHaveTextContent('350000000000002')
    expect(filas()[0]).toHaveClass('border-l-fila-urgente-brd')

    await user.click(within(screen.getByRole('group', { name: 'Color' })).getByRole('button', { name: /^Azul/ }))
    expect(filas()).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Ubicación' }))
    await user.click(screen.getByRole('checkbox', { name: 'Listos (1)' }))
    expect(filas()).toHaveLength(1)
    expect(within(screen.getByRole('group', { name: 'Color' })).getByRole('button', { name: /^Rosa/ })).toBeDisabled()

    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Quitar filtros (2)' }))
    expect(filas()).toHaveLength(3)
  })

  it('el interruptor enseña lo que no cuenta como stock, en gris y fuera de los totales', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: /^iPhone 13 128GB/ }))
    await user.click(screen.getByRole('switch', { name: 'Ver también lo que no cuenta como stock' }))
    expect(filas()).toHaveLength(4)
    expect(screen.getByText('NO CUENTA')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^iPhone 13 128GB/ })).toHaveTextContent('1 no cuentan')
    expect(screen.getByText('4 móviles en stock')).toBeInTheDocument()
  })

  it('el IMEI de una fila abre su detalle', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: 'Abrir 350000000000005' }))
    expect(await screen.findByText('Detalle del IMEI')).toBeInTheDocument()
  })

  it('el buscador encuentra cualquier IMEI y abre su detalle', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/stock-telefonos/buscar', () => HttpResponse.json([
      movilBuscado({ imeiSn: '353918700112233', modelo: '11', modeloMaestro: '11', capacidad: '64GB', color: 'Negro', estado: 'VENDIDO', ubicacion: null, fechaVenta: '2023-05-02' }),
    ])))
    abrir()
    await user.type(await screen.findByRole('searchbox', { name: 'Buscar IMEI en todos los móviles' }), '3539')
    await user.click(await screen.findByRole('button', { name: /353918700112233 · iPhone 11 64GB Negro · Vendido el 02\/05\/2023/ }))
    expect(await screen.findByText('Detalle del IMEI')).toBeInTheDocument()
  })

  it('sin datos de NSYS sale la banda roja', async () => {
    server.use(http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys({ nivel: 'SIN_DATOS', ultimaExportacion: null }))))
    abrir()
    expect(await screen.findByRole('alert')).toHaveTextContent('Todavía no ha llegado ningún dato de NSYS.')
  })
})
