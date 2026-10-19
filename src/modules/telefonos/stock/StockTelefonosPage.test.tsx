import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Route, useLocation } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { estadoNsys, movil, movilBuscado, trabajo } from '../test/fabrica'
import { StockTelefonosPage } from './StockTelefonosPage'

// iPhone 13: 128GB con 001 (Listos) y 003 (En revisión), 256GB con 006 y 512GB solo de pedido (007); además 002 de pedido
// y 004 que no cuenta. iPhone 14: 005. En stock, 4.
const STOCK = [
  movil({ imeiSn: '350000000000001', color: 'Azul', grado: 'A', ubicacion: 'Listos', sku: 'i13128AzulA', dias: 2 }),
  movil({ imeiSn: '350000000000002', color: 'Azul', grado: 'A-', bateriaNueva: true, ubicacion: 'Taller · Glass', estado: 'DE_PEDIDO', sku: 'i13128AzulA-100', dias: 30 }),
  movil({ imeiSn: '350000000000003', color: 'Rosa', grado: 'n/a', ubicacion: 'En revisión', sku: null, dias: 4 }),
  movil({ imeiSn: '350000000000004', color: 'Azul', grado: 'B', ubicacion: 'Esperando pieza', estado: 'NO_CUENTA', sku: 'i13128AzulB', dias: 9 }),
  movil({ imeiSn: '350000000000005', modelo: '14', modeloMaestro: '14', ubicacion: 'Listos', sku: 'i14128AzulA', dias: 3 }),
  movil({ imeiSn: '350000000000006', capacidad: '256GB', color: 'Rosa', grado: 'B', ubicacion: 'Listos', sku: 'i13256RosaB', dias: 1 }),
  movil({ imeiSn: '350000000000007', capacidad: '512GB', ubicacion: 'Listos', estado: 'DE_PEDIDO', sku: 'i13512AzulA', dias: 50 }),
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
const filas = () => within(screen.getByRole('region', { name: 'Tabla de móviles' })).getAllByRole('row').slice(1)
const primeraFila = async () => (await within(await screen.findByRole('region', { name: 'Tabla de móviles' })).findAllByRole('row'))[1]
const matriz = () => screen.getByRole('table', { name: 'Color y grado' })
const imeiDe = (fila: HTMLElement) => fila.textContent?.match(/3500000000000\d\d/)?.[0]
const lista = () => screen.getByRole('navigation', { name: 'Modelos' })
const modelosDeLaLista = () => within(lista()).getAllByRole('button', { name: / en stock$/ }).map((b) => b.getAttribute('aria-label'))
/** La celda de una fila bajo la cabecera `columna` de su misma tabla. */
const celda = (fila: HTMLElement, columna: string) => {
  const cabeceras = within(fila.closest('table') as HTMLElement).getAllByRole('columnheader')
  return within(fila).getAllByRole('cell')[cabeceras.findIndex((c) => c.textContent === columna)]
}
const colorAzul = () => within(matriz()).getByRole('button', { name: 'Color Azul' })
const interruptor = () => screen.getByRole('switch', { name: 'Ver también lo que no cuenta como stock' })

describe('Stock de teléfonos (spec pieza 1 §9.2 y spec 0.9.18 §4)', () => {
  it('cabecera con el total en stock, la píldora de NSYS y una fila por modelo con su total y sus capacidades', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Stock de teléfonos' })).toBeInTheDocument()
    expect(await screen.findByText('4 móviles en stock')).toBeInTheDocument()
    expect(screen.getByText(/^NSYS: /)).toHaveAttribute('role', 'status')
    expect(modelosDeLaLista()).toEqual(['iPhone 14: 1 en stock', 'iPhone 13: 3 en stock'])
    expect(within(lista()).getByRole('button', { name: 'iPhone 13 128GB: 2' })).toBeInTheDocument()
    expect(within(lista()).getByRole('button', { name: 'iPhone 13 256GB: 1' })).toBeInTheDocument()
    expect(within(lista()).queryByRole('button', { name: /^iPhone 13 512GB/ })).not.toBeInTheDocument()
  })

  it('el nombre abre el modelo con «Todas» y la columna Cap.; una pastilla, con esa capacidad', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: 'iPhone 13: 3 en stock' }))
    expect(screen.getByRole('heading', { level: 2, name: 'iPhone 13' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Todas: 3' })).toHaveAttribute('aria-pressed', 'true')
    expect(filas().map(imeiDe)).toEqual(['350000000000006', '350000000000001', '350000000000003'])
    expect(screen.getByRole('columnheader', { name: 'Cap.' })).toBeInTheDocument()
    expect(celda(filas()[0], 'Cap.')).toHaveTextContent('256 GB')
    expect(screen.getByText('3 móviles')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'iPhone 13 128GB: 2' }))
    expect(screen.getByRole('button', { name: '128 GB: 2' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'iPhone 13 128GB: 2' })).toHaveAttribute('aria-pressed', 'true')
    expect(filas().map(imeiDe)).toEqual(['350000000000001', '350000000000003'])
    expect(screen.queryByRole('columnheader', { name: 'Cap.' })).not.toBeInTheDocument()
  })

  it('las pestañas sin stock van apagadas, con el interruptor se abren y cambiar de pestaña quita los filtros', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: 'iPhone 13: 3 en stock' }))
    expect(screen.getByRole('button', { name: '512 GB: 0' })).toBeDisabled()
    await user.click(colorAzul())
    expect(screen.getByRole('button', { name: 'Quitar filtros (1)' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '128 GB: 2' }))
    expect(screen.queryByRole('button', { name: /Quitar filtros/ })).not.toBeInTheDocument()
    await user.click(interruptor())
    await user.click(screen.getByRole('button', { name: '512 GB: 0' }))
    expect(filas().map(imeiDe)).toEqual(['350000000000007'])
  })

  it('al elegir un modelo salen sus móviles y los filtros se combinan', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: 'iPhone 13 128GB: 2' }))
    expect(filas()).toHaveLength(2)
    await user.click(colorAzul())
    expect(filas()).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Ubicación' }))
    await user.click(screen.getByRole('checkbox', { name: 'Listos (1)' }))
    expect(filas()).toHaveLength(1)
    // La tabla color × grado respeta los demás filtros: en Listos no hay ningún Rosa, así que su fila desaparece.
    expect(within(matriz()).queryByRole('button', { name: 'Color Rosa' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Quitar filtros (2)' }))
    expect(filas()).toHaveLength(2)
  })

  it('el interruptor enseña lo que no cuenta como stock, en gris y fuera de los totales', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: 'iPhone 13: 3 en stock' }))
    await user.click(interruptor())
    expect(filas().map(imeiDe)).toEqual(['350000000000006', '350000000000001', '350000000000003', '350000000000004', '350000000000002', '350000000000007'])
    expect(screen.getAllByText('NO CUENTA · De pedido')).toHaveLength(2)
    expect(screen.getAllByText('NO CUENTA · No cuenta como stock')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'iPhone 13: 3 en stock' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Todas: 3' })).toBeInTheDocument()
    expect(screen.getByText('4 móviles en stock')).toBeInTheDocument()
  })

  it('lo de pedido se oculta sin el interruptor y con él sale en gris, sin borde rojo', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: 'iPhone 13 128GB: 2' }))
    expect(screen.queryByText('350000000000002')).not.toBeInTheDocument()
    await user.click(interruptor())
    const fila = filas().find((f) => imeiDe(f) === '350000000000002')!
    expect(fila).toHaveTextContent('NO CUENTA · De pedido')
    expect(fila).toHaveClass('text-texto-suave')
    expect(fila).not.toHaveClass('border-l-fila-urgente-brd')
  })

  it('el IMEI de una fila abre el detalle diciendo que viene del stock', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: 'Abrir 350000000000005' }))
    expect(await screen.findByText('Detalle del IMEI desde /telefonos/stock')).toBeInTheDocument()
  })

  it('el buscador de IMEI encuentra cualquier IMEI y abre su detalle', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/stock-telefonos/buscar', () => HttpResponse.json([
      movilBuscado({ imeiSn: '353918700112233', modelo: '11', modeloMaestro: '11', capacidad: '64GB', color: 'Negro', estado: 'VENDIDO', ubicacion: null, fechaVenta: '2023-05-02' }),
    ])))
    abrir()
    await user.type(await screen.findByRole('searchbox', { name: 'Buscar IMEI en todos los móviles' }), '3539')
    await user.click(await screen.findByRole('button', { name: /353918700112233 · iPhone 11 64GB Negro · Vendido el 02\/05\/2023/ }))
    expect(await screen.findByText(/^Detalle del IMEI/)).toBeInTheDocument()
  })

  it('el desplegable del buscador de IMEI se cierra al salir y vuelve al enfocar', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/stock-telefonos/buscar', () => HttpResponse.json([movilBuscado({ imeiSn: '353918700112233' })])))
    abrir()
    const caja = await screen.findByRole('searchbox', { name: 'Buscar IMEI en todos los móviles' })
    await user.type(caja, '3539')
    expect(await screen.findByRole('list', { name: 'Móviles encontrados' })).toBeInTheDocument()
    await user.click(interruptor())
    expect(screen.queryByRole('list', { name: 'Móviles encontrados' })).not.toBeInTheDocument()
    await user.click(caja)
    expect(await screen.findByRole('list', { name: 'Móviles encontrados' })).toBeInTheDocument()
  })

  it('escribir en el buscador de la columna filtra la lista pero no cambia el modelo abierto', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: 'iPhone 13: 3 en stock' }))
    await user.type(screen.getByRole('textbox', { name: 'Buscar modelo o SKU' }), '14')
    expect(modelosDeLaLista()).toEqual(['iPhone 14: 1 en stock'])
    expect(screen.getByRole('heading', { level: 2, name: 'iPhone 13' })).toBeInTheDocument()
  })

  const buscador = () => screen.getByRole('textbox', { name: 'Buscar modelo o SKU' })
  const skusSugeridos = () => within(screen.getByRole('list', { name: 'SKU en stock' })).getAllByRole('button')
    .map((b) => b.querySelector('.font-mono')?.textContent)

  it('un principio de SKU con Enter abre su modelo, filtra por los que empiezan así y lo resalta', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByText('4 móviles en stock')
    await user.type(buscador(), 'i13')
    expect(skusSugeridos()).toEqual(['i13128AzulA', 'i13256RosaB'])
    expect(screen.getByText('Enter: todos los que empiezan así')).toBeInTheDocument()
    expect(modelosDeLaLista()).toEqual(['iPhone 13: 3 en stock'])
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { level: 2, name: 'iPhone 13' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Todas: 3' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('pastilla-sku')).toHaveTextContent('SKU empieza por i13')
    expect(filas().map(imeiDe)).toEqual(['350000000000006', '350000000000001'])
    expect(within(filas()[0]).getByText('i13', { selector: 'mark' })).toBeInTheDocument()
    expect(buscador()).toHaveValue('')
  })

  it('un SKU exacto con las flechas y Enter abre su modelo y su capacidad con ese SKU', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByText('4 móviles en stock')
    await user.type(buscador(), 'i13')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(screen.getByRole('button', { name: '128 GB: 2' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('pastilla-sku')).toHaveTextContent('SKU i13128AzulA')
    expect(screen.getByTestId('pastilla-sku')).not.toHaveTextContent('empieza por')
    expect(filas().map(imeiDe)).toEqual(['350000000000001'])
  })

  it('un clic en un SKU de la lista hace lo mismo', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByText('4 móviles en stock')
    await user.type(buscador(), 'i13')
    await user.click(within(screen.getByRole('list', { name: 'SKU en stock' })).getAllByRole('button')[1])
    expect(screen.getByRole('button', { name: '256 GB: 1' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('pastilla-sku')).toHaveTextContent('SKU i13256RosaB')
    expect(filas().map(imeiDe)).toEqual(['350000000000006'])
  })

  it('si los SKU son de varios modelos, Enter avisa y no abre nada', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: 'iPhone 13: 3 en stock' }))
    await user.type(buscador(), 'i1')
    expect(screen.getByText('Hay SKU de 2 modelos: elige uno o escribe más')).toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(screen.getByText('Hay SKU de 2 modelos que empiezan así: elige uno o escribe más')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'iPhone 13' })).toBeInTheDocument()
    expect(screen.queryByTestId('pastilla-sku')).not.toBeInTheDocument()
  })

  it('un modelo escrito entero con Enter lo abre con «Todas»; sin nada que empiece así, lo dice; Escape lo borra', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: 'iPhone 13 128GB: 2' }))
    await user.type(buscador(), '14{Enter}')
    expect(screen.getByRole('heading', { level: 2, name: 'iPhone 14' })).toBeInTheDocument()
    expect(buscador()).toHaveValue('')
    await user.type(buscador(), '13 pro')
    expect(within(lista()).queryAllByRole('button', { name: / en stock$/ })).toHaveLength(0)
    expect(screen.getByText('Ningún modelo ni SKU en stock empieza así.')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(buscador()).toHaveValue('')
    expect(modelosDeLaLista()).toHaveLength(2)
  })

  it('la × de la pastilla quita el SKU, y cambiar de pestaña también', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByText('4 móviles en stock')
    await user.type(buscador(), 'i13{Enter}')
    await user.click(screen.getByRole('button', { name: 'Quitar el filtro de SKU' }))
    expect(screen.queryByTestId('pastilla-sku')).not.toBeInTheDocument()
    expect(filas()).toHaveLength(3)
    await user.type(buscador(), 'i13{Enter}')
    expect(screen.getByTestId('pastilla-sku')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '128 GB: 2' }))
    expect(screen.queryByTestId('pastilla-sku')).not.toBeInTheDocument()
  })

  it('al volver de un móvil sigue el filtro de SKU', async () => {
    const user = userEvent.setup()
    const primera = abrir()
    await screen.findByText('4 móviles en stock')
    await user.type(buscador(), 'i13{Enter}')
    await user.click(screen.getAllByRole('button', { name: /^Abrir / })[0])
    expect(await screen.findByText(/^Detalle del IMEI/)).toBeInTheDocument()
    primera.unmount()
    abrir()
    expect(await screen.findByTestId('pastilla-sku')).toHaveTextContent('SKU empieza por i13')
    expect(filas()).toHaveLength(2)
  })

  it('si tras recargar el modelo elegido ya no existe, cae al primero sin filtros', async () => {
    const user = userEvent.setup()
    const { queryClient } = abrir()
    await user.click(await screen.findByRole('button', { name: 'iPhone 13: 3 en stock' }))
    await user.click(colorAzul())
    server.use(http.get('*/api/stock-telefonos', () => HttpResponse.json([STOCK[4]])))
    await queryClient.invalidateQueries()
    expect(await screen.findByRole('heading', { level: 2, name: 'iPhone 14' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quitar filtros/ })).not.toBeInTheDocument()
    expect(filas()).toHaveLength(1)
  })

  it('volver a pulsar el modelo elegido no borra sus filtros', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: 'iPhone 13: 3 en stock' }))
    await user.click(colorAzul())
    await user.click(screen.getByRole('button', { name: 'iPhone 13: 3 en stock' }))
    expect(screen.getByRole('button', { name: 'Quitar filtros (1)' })).toBeInTheDocument()
  })

  it('sin datos de NSYS sale la banda roja', async () => {
    server.use(http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys({ nivel: 'SIN_DATOS', ultimaExportacion: null }))))
    abrir()
    expect(await screen.findByRole('alert')).toHaveTextContent('Todavía no ha llegado ningún dato de NSYS.')
  })

  it('la fila y el buscador también abren el detalle diciendo que vienen del stock', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/stock-telefonos/buscar', () => HttpResponse.json([movilBuscado({ imeiSn: '353918700112233' })])))
    const { unmount } = abrir()
    await user.click(await screen.findByRole('button', { name: 'iPhone 14: 1 en stock' }))
    await user.dblClick(filas()[0])
    expect(await screen.findByText('Detalle del IMEI desde /telefonos/stock')).toBeInTheDocument()
    unmount()
    abrir()
    await user.type(await screen.findByRole('searchbox', { name: 'Buscar IMEI en todos los móviles' }), '3539')
    await user.click(await screen.findByRole('button', { name: /353918700112233/ }))
    expect(await screen.findByText('Detalle del IMEI desde /telefonos/stock')).toBeInTheDocument()
  })

  it('al volver de un móvil siguen el modelo, la capacidad, el filtro, el interruptor y el texto del buscador', async () => {
    const user = userEvent.setup()
    const primera = abrir()
    await user.click(await screen.findByRole('switch', { name: 'Ver también lo que no cuenta como stock' }))
    await user.click(await screen.findByRole('button', { name: 'iPhone 13 128GB: 2' }))
    await user.click(colorAzul())
    await user.type(screen.getByRole('textbox', { name: 'Buscar modelo o SKU' }), 'iPhone 1')
    await user.click(screen.getAllByRole('button', { name: /^Abrir / })[0])
    expect(await screen.findByText(/^Detalle del IMEI/)).toBeInTheDocument()
    primera.unmount()

    abrir()
    expect(await screen.findByRole('heading', { level: 2, name: 'iPhone 13' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '128 GB: 2' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Quitar filtros (1)' })).toBeInTheDocument()
    expect(interruptor()).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('textbox', { name: 'Buscar modelo o SKU' })).toHaveValue('iPhone 1')
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
    server.use(http.get('*/api/stock-telefonos', () => HttpResponse.json([movil({ imeiSn: '350000000000009', grado: '' })])))
    abrir()
    expect(celda(await primeraFila(), 'Grado')).toHaveTextContent('—')
  })

  it('la tabla color × grado cuenta el stock y filtra por casilla, color, grado y Ctrl+clic', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: 'iPhone 13: 3 en stock' }))
    expect(screen.queryByRole('group', { name: 'Color' })).not.toBeInTheDocument()
    // El bloque de la tabla color × grado tiene tope de alto y scroll propio (spec §4.6).
    expect(matriz().parentElement).toHaveClass('max-h-[45%]', 'overflow-auto')
    // Del iPhone 13 en stock: Azul A (001), Rosa B (006, 256 GB) y Rosa n/a (003, en revisión).
    expect(within(matriz()).getByRole('button', { name: 'Azul A: 1' })).toHaveAttribute('title', 'Azul A: 1 listos · 0 en taller · 0 en revisión')
    expect(within(matriz()).getByRole('button', { name: 'Rosa n/a: 1' })).toHaveAttribute('title', 'Rosa n/a: 0 listos · 0 en taller · 1 en revisión')
    await user.click(within(matriz()).getByRole('button', { name: 'Rosa B: 1' }))
    expect(filas().map(imeiDe)).toEqual(['350000000000006'])
    expect(within(matriz()).getByRole('button', { name: 'Azul A: 1' })).toBeInTheDocument()
    await user.click(within(matriz()).getByRole('button', { name: 'Rosa B: 1' }))
    expect(filas()).toHaveLength(3)
    await user.click(within(matriz()).getByRole('button', { name: 'Color Rosa' }))
    expect(filas().map(imeiDe)).toEqual(['350000000000006', '350000000000003'])
    await user.click(within(matriz()).getByRole('button', { name: 'Grado A' }))
    expect(filas().map(imeiDe)).toEqual(['350000000000001'])
    await user.click(within(matriz()).getByRole('button', { name: 'Rosa B: 1' }))
    await user.keyboard('{Control>}')
    await user.click(within(matriz()).getByRole('button', { name: 'Azul A: 1' }))
    await user.keyboard('{/Control}')
    expect(filas().map(imeiDe)).toEqual(['350000000000006', '350000000000001'])
    expect(screen.getByRole('button', { name: 'Quitar filtros (4)' })).toBeInTheDocument()
  })

  it('«Quitar filtros» cuenta también el SKU y lo quita todo', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByText('4 móviles en stock')
    await user.type(screen.getByRole('textbox', { name: 'Buscar modelo o SKU' }), 'i13{Enter}')
    await user.click(colorAzul())
    await user.click(screen.getByRole('button', { name: 'Quitar filtros (2)' }))
    expect(screen.queryByTestId('pastilla-sku')).not.toBeInTheDocument()
    expect(filas()).toHaveLength(3)
  })

  const CON_TRABAJOS = [
    movil({ imeiSn: '350000000000011', ubicacion: 'Taller · Reparación', dias: 3,
      trabajos: [trabajo({ tecnico: 'Técnico 1' }), trabajo({ categoria: 'GLASS', tecnico: 'Técnico 3' })] }),
    movil({ imeiSn: '350000000000012', ubicacion: 'Taller · Glass', dias: 5 }),
    movil({ imeiSn: '350000000000013', ubicacion: 'Listos', dias: 1, trabajos: [trabajo({ tecnico: 'Técnico 2', desde: '2026-01-12T09:00:00' })] }),
  ]

  it('«Quién lo tiene»: el descuadre y la caja sin asignar primero, con sus avisos junto a los filtros', async () => {
    server.use(http.get('*/api/stock-telefonos', () => HttpResponse.json(CON_TRABAJOS)))
    abrir()
    expect(await screen.findByRole('columnheader', { name: 'Quién lo tiene' })).toBeInTheDocument()
    expect(filas().map(imeiDe)).toEqual(['350000000000013', '350000000000012', '350000000000011'])
    expect(celda(filas()[0], 'Quién lo tiene')).toHaveTextContent('⚠ Técnico 2: trabajo abierto')
    expect(celda(filas()[1], 'Quién lo tiene')).toHaveTextContent('⚠ En caja, sin asignar')
    expect(celda(filas()[2], 'Quién lo tiene')).toHaveTextContent('Técnico 1 · glass Técnico 3 sin entregar')
    expect(within(filas()[2]).getByText('Técnico 1').closest('[title]')).toHaveAttribute('title',
      'Reparación de Técnico 1 desde el 16/10 · Glass de Técnico 3 desde el 16/10: el móvil aún no le ha llegado')
    expect(screen.getByText('⚠ 1 en caja de taller sin asignar')).toBeInTheDocument()
    expect(screen.getByText('⚠ 1 con descuadre')).toBeInTheDocument()
  })

  it('el filtro Técnico: un técnico, los sin asignar y los descuadres; un móvil sale si coincide uno', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/stock-telefonos', () => HttpResponse.json(CON_TRABAJOS)))
    abrir()
    await user.click(await screen.findByRole('button', { name: 'Técnico' }))
    await user.click(screen.getByRole('checkbox', { name: 'Técnico 3 (1)' }))
    expect(filas().map(imeiDe)).toEqual(['350000000000011'])
    await user.click(screen.getByRole('checkbox', { name: 'Sin asignar (en caja de taller) (1)' }))
    expect(filas().map(imeiDe)).toEqual(['350000000000012', '350000000000011'])
    await user.click(screen.getByRole('checkbox', { name: 'Con descuadre (1)' }))
    expect(filas()).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Técnico' })).toHaveTextContent('Técnico: 3')
  })

  it('el grado lleva su color y las marcas de batería nueva y eSIM, sin columnas Batería ni Estado', async () => {
    server.use(http.get('*/api/stock-telefonos', () => HttpResponse.json([
      movil({ imeiSn: '350000000000031', grado: 'MsB', bateriaNueva: true, esEsim: true }),
    ])))
    abrir()
    const grado = celda(await primeraFila(), 'Grado')
    expect(within(grado).getByText('MsB')).toHaveClass('border-tipo-glass-text')
    expect(within(grado).getByText('100')).toHaveAttribute('title', 'Batería nueva')
    expect(within(grado).getByText('eSIM')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Batería' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Estado' })).not.toBeInTheDocument()
  })
})
