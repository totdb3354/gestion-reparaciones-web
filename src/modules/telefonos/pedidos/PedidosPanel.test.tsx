import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { maquetarJsdom } from '@/test/layoutJsdom'
import { candidato, estadoNsys, fila, fuente } from '../test/fabrica'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'

// Pantalla v2 (parte 2): filtro de Plataforma por tienda y panel de la fila. Datos inventados.
const FILAS = [
  fila({ idFila: 1, canal: 'AMAZON', plataforma: 'AMZ', pedido: '402-0000000-0000041' }),
  fila({ idFila: 2, canal: 'DISTRIBUIDORES', plataforma: 'Cliente Web A', pedido: '402-0000000-0000042', imei: '350000000000011', nivel: 'MAL', motivo: 'MODELO', skuMovil: 'i14128NegroA', caja: 'CAJA LISTOS' }),
  fila({ idFila: 3, canal: 'DISTRIBUIDORES', plataforma: 'Cliente Web B', pedido: '402-0000000-0000043', estado: 'ENVIADA', envioFecha: '2026-11-09T10:30:00', impresaEn: '2026-11-10T09:15:00', tieneEtiqueta: true, transportista: 'UPSv2', seguimiento: '1Z0000000000000002' }),
  fila({ idFila: 4, canal: null, estado: 'HISTORICO', editable: false, plataforma: 'Cliente Web C', imei: '350000000000012', pedido: '402-0000000-0000044' }),
]

let respuesta = FILAS
let pedidosCambios: string[] = []
let cambios: Record<string, unknown[]> = {}

afterEach(() => { vi.restoreAllMocks() })

beforeEach(() => {
  respuesta = FILAS
  pedidosCambios = []
  cambios = {
    '2': [
      { usuario: 'Supertécnico 1', fecha: '2026-11-10T12:05:00', imeiAnterior: '350000000000010', imeiNuevo: '350000000000011' },
      { usuario: null, fecha: '2026-11-09T08:00:00', imeiAnterior: null, imeiNuevo: '350000000000010' },
      { usuario: 'Supertécnico 1', fecha: '2026-11-08T09:00:00', imeiAnterior: '350000000000009', imeiNuevo: null },
    ],
  }
  estadoPedidos.reset()
  maquetarJsdom()
  server.use(
    http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: respuesta, hayMas: false })),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    http.get('*/api/pedidos/filas/:id/recomendados', () => HttpResponse.json([candidato({ imei: '350000000000101', caja: 'CAJA LISTOS' })])),
    http.get('*/api/pedidos/filas/:id/cambios', ({ params }) => { pedidosCambios.push(String(params.id)); return HttpResponse.json(cambios[String(params.id)] ?? []) }),
    http.put('*/api/pedidos/filas/:id/imei', ({ params }) => HttpResponse.json(fila({ idFila: Number(params.id), imei: '350000000000101' }))),
  )
})

const abrir = () => renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
const filasPintadas = () => screen.getAllByRole('row').length - 1
const panel = () => screen.queryByRole('region', { name: 'Detalle del pedido' })
const tr = (pedido: string) => screen.getAllByText(pedido)[0].closest('tr')!
const celda = (t: string) => screen.getAllByText(t)[0]
const esperar = () => screen.findByRole('button', { name: '4 filas' })

describe('Pedidos v2: filtro de Plataforma por tienda', () => {
  it('ofrece casillas por tienda con su recuento (sin clientes); marcar una deja sus filas con el cliente en la columna', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    await user.click(screen.getByRole('button', { name: 'Filtrar Plataforma' }))
    const casillas = screen.getAllByRole('checkbox').map((c) => c.closest('label')!.textContent)
    expect(casillas).toEqual(['Todos', 'AMZ1', 'Fonestockroom2', 'Histórico (otros)1'])
    expect(screen.queryByRole('checkbox', { name: /Cliente/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /^Fonestockroom/ }))
    expect(filasPintadas()).toBe(2)
    expect(tr('402-0000000-0000042')).toHaveTextContent('Cliente Web A')
    expect(screen.getByRole('button', { name: 'Quitar filtro Plataforma: Fonestockroom' })).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /^Fonestockroom/ }))
    await user.click(screen.getByRole('checkbox', { name: /^Histórico \(otros\)/ }))
    expect(filasPintadas()).toBe(1)
    expect(tr('402-0000000-0000044')).toBeInTheDocument()
  })
})

describe('Pedidos v2: el panel de la fila', () => {
  it('se abre al pulsar una celda que no es la del IMEI, cambia de fila, y se cierra con la misma fila, «Cerrar» y Escape', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    expect(panel()).toBeNull()
    await user.click(celda('Cliente Web A'))
    expect(panel()).toBeInTheDocument()
    expect(tr('402-0000000-0000042')).toHaveAttribute('data-elegida')
    await user.click(celda('Cliente Web B'))
    expect(panel()).toHaveTextContent('402-0000000-0000043')
    expect(document.querySelectorAll('tr[data-elegida]')).toHaveLength(1)
    await user.click(celda('Cliente Web B'))
    expect(panel()).toBeNull()
    await user.click(celda('Cliente Web A'))
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(panel()).toBeNull()
    await user.click(screen.getByRole('button', { name: '402-0000000-0000041' })) // con teclado/botón
    expect(panel()).toHaveTextContent('402-0000000-0000041')
    await user.keyboard('{Escape}')
    expect(panel()).toBeNull()
  })

  it('con el panel y el desplegable del IMEI abiertos, un Escape cierra el desplegable y el siguiente, el panel', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    await user.click(celda('Cliente Web A'))
    expect(panel()).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /pulsa para poner el IMEI/ })[0])
    expect(screen.getByRole('textbox', { name: 'IMEI' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'IMEI' })).not.toBeInTheDocument())
    expect(panel()).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(panel()).toBeNull()
  })

  it('pulsar la celda del IMEI abre el desplegable y no el panel', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    await user.click(screen.getAllByRole('button', { name: /pulsa para poner el IMEI/ })[0])
    expect(screen.getByRole('textbox', { name: 'IMEI' })).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /350000000000101/ })) // un recomendado, dentro del desplegable
    expect(panel()).toBeNull()
  })

  it('enseña el pedido, el móvil y los cambios del IMEI de más reciente a más antiguo', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    await user.click(celda('Cliente Web A'))
    const p = await screen.findByRole('region', { name: 'Detalle del pedido' })
    expect(p.querySelector('dl')!.textContent).toMatch(/TiendaFonestockroom.*PlataformaCliente Web A/)
    for (const t of ['402-0000000-0000042', 'Cliente Web A', 'Fonestockroom', 'i13128AzulA', '09/11/2026', '08/11/2026', 'Pendiente', '350000000000011', 'i14128NegroA', 'CAJA LISTOS', 'otro modelo, capacidad o eSIM']) {
      expect(p).toHaveTextContent(t)
    }
    const items = await screen.findAllByRole('listitem')
    expect(items.map((i) => i.textContent)).toEqual([
      'Supertécnico 1 cambió 350000000000010 por 35000000000001110/11/2026 12:05',
      'Carga desde la hoja puso 35000000000001009/11/2026 08:00',
      'Supertécnico 1 quitó 35000000000000908/11/2026 09:00',
    ])
  })

  it('una enviada enseña transportista y seguimiento; sin cambios dice que nadie ha puesto IMEI', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    await user.click(celda('Cliente Web B'))
    const p = await screen.findByRole('region', { name: 'Detalle del pedido' })
    expect(p).toHaveTextContent('Enviado 10/11')
    expect(p).toHaveTextContent('Etiqueta generada09/11/2026 10:30')
    expect(p).toHaveTextContent('Enviado (etiqueta impresa)10/11/2026 09:15')
    expect(p).toHaveTextContent('UPS')
    expect(p).toHaveTextContent('1Z0000000000000002')
    expect(await screen.findByText('Nadie ha puesto IMEI todavía.')).toBeInTheDocument()
  })

  it('con la etiqueta generada y sin imprimir, el panel dice «Etiqueta sin imprimir todavía» y no pone fecha de envío', async () => {
    const user = userEvent.setup()
    respuesta = [fila({ idFila: 7, canal: 'DISTRIBUIDORES', plataforma: 'Cliente Web D', pedido: '402-0000000-0000047', estado: 'ENVIADA', envioFecha: '2026-11-09T11:05:00', tieneEtiqueta: true, transportista: 'GLSSpain', seguimiento: '1Z0000000000000003' })]
    abrir()
    await screen.findByRole('button', { name: '1 filas' })
    await user.click(celda('Cliente Web D'))
    const p = await screen.findByRole('region', { name: 'Detalle del pedido' })
    expect(p).toHaveTextContent('Etiqueta generada 09/11')
    expect(p).toHaveTextContent('Etiqueta generada09/11/2026 11:05')
    expect(p).toHaveTextContent('EnviadoEtiqueta sin imprimir todavía')
    expect(p).not.toHaveTextContent('Enviado (etiqueta impresa)')
    expect(p).toHaveTextContent('GLS')
  })

  it('una fila del histórico no pide nada y dice que viene de la hoja', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    await user.click(celda('Cliente Web C'))
    expect(await screen.findByText('Viene de la hoja: no hay registro de quién lo puso.')).toBeInTheDocument()
    expect(pedidosCambios).toEqual([])
  })

  it('si falla la consulta lo dice dentro del panel, sin diálogo de error', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/pedidos/filas/:id/cambios', () => HttpResponse.json({ message: 'Fallo' }, { status: 500 })))
    abrir()
    await esperar()
    await user.click(celda('Cliente Web A'))
    expect(await screen.findByText('No se pudo cargar quién ha tocado el IMEI.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Error' })).not.toBeInTheDocument()
  })

  it('tras guardar un IMEI en esa fila se vuelve a pedir su lista de cambios', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    await user.click(celda('AMZ'))
    await screen.findByText('Nadie ha puesto IMEI todavía.')
    expect(pedidosCambios).toEqual(['1'])
    await user.click(screen.getAllByRole('button', { name: /pulsa para poner el IMEI/ })[0])
    await user.click(await screen.findByRole('button', { name: /350000000000101/ }))
    await waitFor(() => expect(pedidosCambios.filter((i) => i === '1').length).toBeGreaterThanOrEqual(2))
  })

  it('la fila elegida sigue al filtrar y el panel se cierra si la fila deja de estar entre las recibidas', async () => {
    const user = userEvent.setup()
    const { queryClient } = abrir()
    await esperar()
    await user.click(celda('Cliente Web A'))
    await user.click(screen.getByRole('button', { name: '1 no cuadran' }))
    expect(panel()).toHaveTextContent('402-0000000-0000042')
    await user.click(screen.getByRole('button', { name: '4 filas' }))
    respuesta = FILAS.filter((f) => f.idFila !== 2)
    await queryClient.invalidateQueries()
    await waitFor(() => expect(panel()).toBeNull())
    expect(estadoPedidos.get().filaElegida).toBeNull()
  })
})
