import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Route, useLocation } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { fuentePedidos, movilUnidad, pedido, trabajo, unidad } from '../test/fabrica'
import { PedidosPage } from './PedidosPage'

const PEDIDOS = [
  pedido({ idPedido: 1, numero: '402-0000000-0000001', fecha: '2026-10-28T10:00:00', unidades: [
    unidad({ idUnidad: 1, imei: '350000000000001', imeiFuente: 'PEDIDOS_2026', sinPedidoConcreto: true, estado: 'EN_TALLER',
      movil: movilUnidad({ grado: 'C', ubicacion: 'Taller · Glass', trabajos: [trabajo({ tecnico: 'Técnico 1', categoria: 'GLASS' })] }) }),
  ] }),
  pedido({ idPedido: 2, numero: '402-0000000-0000002', fecha: '2026-10-30T10:00:00', unidades: [unidad({ idUnidad: 2 })] }),
  pedido({ idPedido: 3, canal: 'DISTRIBUIDORES', numero: '18832', cliente: 'Tienda Norte SL', pais: 'ES', fecha: '2026-10-31T10:00:00', unidades: [
    unidad({ idUnidad: 3, sku: 'i14256AzulA', imei: '350000000000003', imeiFuente: 'PEDIDOS_2026', estado: 'NECESITA_TALLER', motivo: 'COLOR_O_GRADO',
      pide: { modelo: '14', capacidad: '256GB', color: 'Azul', grado: 'A', esEsim: false },
      movil: movilUnidad({ modelo: '14', modeloMaestro: '14', capacidad: '256GB', color: 'Rojo', sku: 'i14256RojoA' }) }),
  ] }),
  pedido({ idPedido: 4, canal: 'SIMULADOR', numero: '6488', cliente: 'Móviles Levante SL', pais: null, fuente: 'SIMULADOR',
    fecha: '2026-11-02T00:00:00', unidades: [4, 5, 6].map((i) => unidad({ idUnidad: i, imei: `35000000000000${i}`, imeiFuente: 'SIMULADOR',
      estado: 'CUADRA', movil: movilUnidad() })) }),
]

beforeEach(() => {
  server.use(
    http.get('*/api/pedidos', () => HttpResponse.json(PEDIDOS)),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuentePedidos(), fuentePedidos({ fuente: 'PEDIDOS_2026' }),
      fuentePedidos({ fuente: 'SIMULADOR', nivel: 'RETRASO' })])),
  )
})

function DetalleFalso() {
  const desde = (useLocation().state as { desde?: string } | null)?.desde
  return <p>Detalle del IMEI{desde ? ` desde ${desde}` : ''}</p>
}

const abrir = () => renderConProviders(<PedidosPage />, {
  sesion: SESION_SUPER, ruta: '/telefonos/pedidos',
  rutas: <Route path="/reparaciones/imeis/:imei" element={<DetalleFalso />} />,
})
const lista = () => screen.getByRole('region', { name: 'Lista de pedidos' })
const detalle = () => screen.getByRole('region', { name: 'Unidad elegida' })

describe('«Pedidos» (spec pieza 2 §9.2)', () => {
  it('los pedidos de más antiguo a más nuevo, con su cabecera, y la primera unidad sin móvil elegida', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(await screen.findByText('6 unidades en 4 pedidos · los más antiguos arriba')).toBeInTheDocument()
    expect(within(lista()).getAllByRole('article').map((a) => a.getAttribute('aria-label')))
      .toEqual(['402-0000000-0000001', '402-0000000-0000002', '18832', '6488'])
    expect(within(detalle()).getByText('Pedido 402-0000000-0000002')).toBeInTheDocument()
    expect(within(detalle()).getByText('Tecléalo en PEDIDOS 2026, como hoy. El ERP lo lee en unos minutos.')).toBeInTheDocument()
  })

  it('el que está en el taller dice con quién y en qué tiene que acabar, y por qué «sin pedido concreto»', async () => {
    abrir()
    await userEvent.click(await within(lista()).findByRole('button', { name: 'i13128AzulA: En el taller' }))
    expect(within(detalle()).getByText('En el taller con Técnico 1 · tiene que acabar en i13128AzulA')).toBeInTheDocument()
    expect(within(detalle()).getByText('sin pedido concreto')).toBeInTheDocument()
    expect(within(detalle()).getByText(/^En PEDIDOS 2026 hay 1 IMEI tecleado para i13128AzulA/)).toBeInTheDocument()
  })

  it('el que no cuadra enseña la tabla de diferencias y qué hacer', async () => {
    abrir()
    await userEvent.click(await within(lista()).findByRole('button', { name: 'i14256AzulA: No cuadra' }))
    const tabla = within(detalle()).getByRole('table', { name: 'Diferencias' })
    expect(within(tabla).getByRole('row', { name: /Color Azul Rojo/ })).toHaveAttribute('data-distinto', 'true')
    expect(within(detalle()).getByText('Hay que asignarle el trabajo en Asignaciones.')).toBeInTheDocument()
  })

  it('las del Simulador que cuadran van plegadas y se despliegan', async () => {
    abrir()
    const simulador = await within(lista()).findByRole('article', { name: '6488' })
    await userEvent.click(within(simulador).getByRole('button', { name: '✔ 3 unidades más cuadran · ver' }))
    expect(within(simulador).getAllByRole('button', { name: 'i13128AzulA: Cuadra' })).toHaveLength(3)
  })

  it('filtra por canal, por estado y por texto', async () => {
    abrir()
    await within(lista()).findAllByRole('article')
    await userEvent.click(within(screen.getByRole('group', { name: 'Canal' })).getByRole('button', { name: /^Distribuidores/ }))
    expect(within(lista()).getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['18832'])
    await userEvent.click(within(screen.getByRole('group', { name: 'Canal' })).getByRole('button', { name: /^Todos/ }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Estado' })).getByRole('button', { name: /^Sin móvil/ }))
    expect(within(lista()).getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['402-0000000-0000002'])
    await userEvent.click(within(screen.getByRole('group', { name: 'Estado' })).getByRole('button', { name: /^Todos/ }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar pedidos' }), 'levante')
    expect(within(lista()).getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['6488'])
  })

  it('el interruptor pide también los del Simulador viejos', async () => {
    const pedidas: string[] = []
    server.use(http.get('*/api/pedidos', ({ request }) => { pedidas.push(new URL(request.url).search); return HttpResponse.json(PEDIDOS) }))
    abrir()
    await userEvent.click(await screen.findByRole('switch', { name: 'Ver también los del Simulador de más de 14 días' }))
    await waitFor(() => expect(pedidas).toContain('?viejos=true'))
  })

  it('«Ver rastro» abre el detalle del IMEI', async () => {
    abrir()
    await userEvent.click(await within(lista()).findByRole('button', { name: 'i14256AzulA: No cuadra' }))
    await userEvent.click(within(detalle()).getByRole('button', { name: 'Ver rastro' }))
    expect(await screen.findByText('Detalle del IMEI desde /telefonos/pedidos')).toBeInTheDocument()
  })

  it('la píldora de las fuentes dice el peor nivel y abre el detalle', async () => {
    abrir()
    const pildora = await screen.findByRole('button', { name: /^Fuentes:/ })
    expect(pildora).toHaveAccessibleName('Fuentes: con retraso')
    await userEvent.click(pildora)
    expect(await screen.findByText('pedidos de Amazon y webs, sin IMEI')).toBeInTheDocument()
    expect(screen.getByText('pedido e IMEI juntos')).toBeInTheDocument()
  })
})
