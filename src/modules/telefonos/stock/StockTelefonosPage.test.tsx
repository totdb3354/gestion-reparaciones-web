import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Route, useLocation } from 'react-router'
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

function DetalleFalso() {
  const desde = (useLocation().state as { desde?: string } | null)?.desde
  return <p>Detalle del IMEI{desde ? ` desde ${desde}` : ''}</p>
}

const abrir = () => renderConProviders(<StockTelefonosPage />, {
  sesion: SESION_SUPER, ruta: '/telefonos/stock',
  rutas: <Route path="/reparaciones/imeis/:imei" element={<DetalleFalso />} />,
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
    expect(await screen.findByText(/^Detalle del IMEI/)).toBeInTheDocument()
  })

  it('el buscador encuentra cualquier IMEI y abre su detalle', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/stock-telefonos/buscar', () => HttpResponse.json([
      movilBuscado({ imeiSn: '353918700112233', modelo: '11', modeloMaestro: '11', capacidad: '64GB', color: 'Negro', estado: 'VENDIDO', ubicacion: null, fechaVenta: '2023-05-02' }),
    ])))
    abrir()
    await user.type(await screen.findByRole('searchbox', { name: 'Buscar IMEI en todos los móviles' }), '3539')
    await user.click(await screen.findByRole('button', { name: /353918700112233 · iPhone 11 64GB Negro · Vendido el 02\/05\/2023/ }))
    expect(await screen.findByText(/^Detalle del IMEI/)).toBeInTheDocument()
  })

  it('el desplegable del buscador se cierra al salir y vuelve al enfocar', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/stock-telefonos/buscar', () => HttpResponse.json([movilBuscado({ imeiSn: '353918700112233' })])))
    abrir()
    const caja = await screen.findByRole('searchbox', { name: 'Buscar IMEI en todos los móviles' })
    await user.type(caja, '3539')
    expect(await screen.findByRole('list', { name: 'Móviles encontrados' })).toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: 'Ver también lo que no cuenta como stock' }))
    expect(screen.queryByRole('list', { name: 'Móviles encontrados' })).not.toBeInTheDocument()
    await user.click(caja)
    expect(await screen.findByRole('list', { name: 'Móviles encontrados' })).toBeInTheDocument()
  })

  it('si la búsqueda de modelo oculta el elegido, el panel sigue al primero visible y sin filtros', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: /^iPhone 13 128GB/ }))
    await user.click(within(screen.getByRole('group', { name: 'Color' })).getByRole('button', { name: /^Azul/ }))
    expect(screen.getByRole('button', { name: 'Quitar filtros (1)' })).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Buscar modelo' }), '14')
    expect(screen.getByRole('heading', { level: 2, name: 'iPhone 14 128GB' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quitar filtros/ })).not.toBeInTheDocument()
    expect(filas()).toHaveLength(1)
  })

  it('si tras recargar el modelo elegido ya no existe, cae al primero sin filtros', async () => {
    const user = userEvent.setup()
    const { queryClient } = abrir()
    await user.click(await screen.findByRole('button', { name: /^iPhone 13 128GB/ }))
    await user.click(within(screen.getByRole('group', { name: 'Color' })).getByRole('button', { name: /^Azul/ }))
    server.use(http.get('*/api/stock-telefonos', () => HttpResponse.json([STOCK[4]])))
    await queryClient.invalidateQueries()
    expect(await screen.findByRole('heading', { level: 2, name: 'iPhone 14 128GB' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quitar filtros/ })).not.toBeInTheDocument()
    expect(filas()).toHaveLength(1)
  })

  it('volver a pulsar el modelo elegido no borra sus filtros', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: /^iPhone 13 128GB/ }))
    await user.click(within(screen.getByRole('group', { name: 'Color' })).getByRole('button', { name: /^Azul/ }))
    await user.click(screen.getByRole('button', { name: /^iPhone 13 128GB/ }))
    expect(screen.getByRole('button', { name: 'Quitar filtros (1)' })).toBeInTheDocument()
  })

  it('sin datos de NSYS sale la banda roja', async () => {
    server.use(http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys({ nivel: 'SIN_DATOS', ultimaExportacion: null }))))
    abrir()
    expect(await screen.findByRole('alert')).toHaveTextContent('Todavía no ha llegado ningún dato de NSYS.')
  })

  it('el IMEI de una fila abre el detalle diciendo que viene del stock', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: 'Abrir 350000000000005' }))
    expect(await screen.findByText('Detalle del IMEI desde /telefonos/stock')).toBeInTheDocument()
  })

  it('la fila y el buscador también abren el detalle diciendo que vienen del stock', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/stock-telefonos/buscar', () => HttpResponse.json([movilBuscado({ imeiSn: '353918700112233' })])))
    const { unmount } = abrir()
    await user.click((await within(await screen.findByRole('navigation', { name: 'Modelos' })).findAllByRole('button'))[0])
    await user.dblClick(filas()[0])
    expect(await screen.findByText('Detalle del IMEI desde /telefonos/stock')).toBeInTheDocument()
    unmount()
    abrir()
    await user.type(await screen.findByRole('searchbox', { name: 'Buscar IMEI en todos los móviles' }), '3539')
    await user.click(await screen.findByRole('button', { name: /353918700112233/ }))
    expect(await screen.findByText('Detalle del IMEI desde /telefonos/stock')).toBeInTheDocument()
  })

  it('al volver de un móvil siguen el modelo, el filtro, el interruptor y la búsqueda de modelo', async () => {
    const user = userEvent.setup()
    const primera = abrir()
    await user.click(await screen.findByRole('switch', { name: 'Ver también lo que no cuenta como stock' }))
    await user.click(await screen.findByRole('button', { name: /^iPhone 13 128GB/ }))
    await user.click(within(screen.getByRole('group', { name: 'Color' })).getByRole('button', { name: /^Azul/ }))
    await user.type(screen.getByRole('textbox', { name: 'Buscar modelo' }), 'iPhone 1')
    await user.click(screen.getAllByRole('button', { name: /^Abrir / })[0])
    expect(await screen.findByText(/^Detalle del IMEI/)).toBeInTheDocument()
    primera.unmount()

    abrir()
    expect(await screen.findByRole('heading', { level: 2, name: 'iPhone 13 128GB' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar filtros (1)' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Ver también lo que no cuenta como stock' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('textbox', { name: 'Buscar modelo' })).toHaveValue('iPhone 1')
    expect(filas()).toHaveLength(3)
  })

  it('mientras NSYS no contesta la píldora es neutra, no roja', async () => {
    server.use(http.get('*/api/stock-telefonos/estado', async () => { await new Promise(() => {}) }))
    abrir()
    const pildora = await screen.findByText('NSYS: comprobando…')
    expect(pildora).not.toHaveClass('bg-urgente-bg')
    expect(pildora).not.toHaveClass('text-fila-urgente-brd')
    expect(pildora.querySelector('span')).not.toHaveClass('bg-verde-ok')
    expect(pildora.querySelector('span')).toHaveClass('bg-gris-borde')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('si falla la consulta del estado la píldora lo dice sin banda roja', async () => {
    server.use(http.get('*/api/stock-telefonos/estado', () => new HttpResponse(null, { status: 500 })))
    abrir()
    const pildora = await screen.findByText('NSYS: no se pudo comprobar')
    expect(pildora).not.toHaveClass('bg-urgente-bg')
    expect(pildora).not.toHaveClass('text-fila-urgente-brd')
    expect(pildora.querySelector('span')).not.toHaveClass('bg-verde-ok')
    expect(pildora.querySelector('span')).toHaveClass('bg-gris-borde')
    expect(screen.queryByText(/Todavía no ha llegado ningún dato/)).not.toBeInTheDocument()
  })

  it('si la primera carga del stock falla no dice que hay 0 móviles', async () => {
    server.use(http.get('*/api/stock-telefonos', () => new HttpResponse(null, { status: 500 })))
    abrir()
    expect(await screen.findByText('No se pudo cargar el stock de teléfonos.')).toBeInTheDocument()
    expect(screen.queryByText('No hay móviles en stock.')).not.toBeInTheDocument()
    expect(screen.queryByText(/móviles? en stock$/)).not.toBeInTheDocument()
  })

  it('un grado vacío se ve como raya en la tabla', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/stock-telefonos', () => HttpResponse.json([movil({ imeiSn: '350000000000009', grado: '' })])))
    abrir()
    await user.click(await screen.findByRole('button', { name: /^iPhone 13 128GB/ }))
    expect(within(filas()[0]).getAllByRole('cell')[2]).toHaveTextContent('—')
  })

  it('los chips de color y grado se leen con un espacio entre el nombre y el número', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: /^iPhone 13 128GB/ }))
    expect(within(screen.getByRole('group', { name: 'Color' })).getByRole('button', { name: /^Azul \d+$/ })).toBeInTheDocument()
  })
})
