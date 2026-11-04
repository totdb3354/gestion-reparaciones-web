import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Route, useLocation } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { atributos, estadoNsys, fuentePedidos, movilUnidad, pedido, trabajo, unidad } from '../test/fabrica'
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
    expect(pildora).toHaveAccessibleName('Fuentes: ShippyPro · PEDIDOS 2026 · Simulador · NSYS: con retraso')
    await userEvent.click(pildora)
    expect(await screen.findByText('pedidos de Amazon y webs, sin IMEI')).toBeInTheDocument()
    expect(screen.getByText('pedido e IMEI juntos')).toBeInTheDocument()
    expect(screen.getByText('dónde está cada móvil')).toBeInTheDocument()
    expect(screen.getByText('Items del 16/10 13:31')).toBeInTheDocument()
  })

  it('«Plegar las que cuadran» vuelve a plegar el pedido desplegado', async () => {
    abrir()
    const simulador = await within(lista()).findByRole('article', { name: '6488' })
    await userEvent.click(within(simulador).getByRole('button', { name: '✔ 3 unidades más cuadran · ver' }))
    await userEvent.click(within(simulador).getByRole('button', { name: 'Plegar las que cuadran' }))
    expect(within(simulador).queryByRole('button', { name: 'i13128AzulA: Cuadra' })).not.toBeInTheDocument()
    expect(within(simulador).getByRole('button', { name: '✔ 3 unidades más cuadran · ver' })).toBeInTheDocument()
  })

  it('con el filtro «Cuadra» no se pliega nada', async () => {
    abrir()
    await within(lista()).findAllByRole('article')
    await userEvent.click(within(screen.getByRole('group', { name: 'Estado' })).getByRole('button', { name: /^Cuadra/ }))
    const simulador = within(lista()).getByRole('article', { name: '6488' })
    expect(within(simulador).getAllByRole('button', { name: 'i13128AzulA: Cuadra' })).toHaveLength(3)
    expect(within(simulador).queryByRole('button', { name: /unidades más cuadran/ })).not.toBeInTheDocument()
    expect(within(simulador).queryByRole('button', { name: 'Plegar las que cuadran' })).not.toBeInTheDocument()
  })

  it('«N uds.» cuenta todas las unidades del pedido aunque el filtro deje solo algunas', async () => {
    const mezcla = pedido({ idPedido: 7, numero: '402-0000000-0000007', unidades: [unidad({ idUnidad: 70 }),
      unidad({ idUnidad: 71, imei: '350000000000071', estado: 'CUADRA', movil: movilUnidad() })] })
    server.use(http.get('*/api/pedidos', () => HttpResponse.json([mezcla])))
    abrir()
    await within(lista()).findAllByRole('article')
    await userEvent.click(within(screen.getByRole('group', { name: 'Estado' })).getByRole('button', { name: /^Cuadra/ }))
    expect(within(within(lista()).getByRole('article', { name: '402-0000000-0000007' })).getByText(/· 2 uds\.$/)).toBeInTheDocument()
  })

  it('la unidad elegida por defecto, si cuadra y estaba plegada, se enseña desplegada', async () => {
    server.use(http.get('*/api/pedidos', () => HttpResponse.json([PEDIDOS[3]])))
    abrir()
    const simulador = await within(lista()).findByRole('article', { name: '6488' })
    const botones = within(simulador).getAllByRole('button', { name: 'i13128AzulA: Cuadra' })
    expect(botones).toHaveLength(3)
    expect(botones[0]).toHaveAttribute('aria-current', 'true')
  })

  it('el aviso «IMEI en dos pedidos» sale en la lista y el detalle dice qué pasa', async () => {
    server.use(http.get('*/api/pedidos', () => HttpResponse.json([
      pedido({ unidades: [unidad({ imei: '350000000000009', imeiFuente: 'PEDIDOS_2026', repetido: true, otroOrderId: '402-0000000-0000099',
        estado: 'CUADRA', movil: movilUnidad() })] }),
    ])))
    abrir()
    expect(await within(lista()).findByText('IMEI en dos pedidos')).toBeInTheDocument()
    expect(within(detalle()).getByText('Este IMEI está tecleado en dos pedidos.')).toBeInTheDocument()
    expect(within(detalle()).getByText(/también en el pedido 402-0000000-0000099/)).toBeInTheDocument()
  })

  it('el detalle de una unidad que NSYS no tiene dice que se revise el IMEI', async () => {
    server.use(http.get('*/api/pedidos', () => HttpResponse.json([
      pedido({ unidades: [unidad({ imei: '350000000000008', imeiFuente: 'PEDIDOS_2026', estado: 'NO_EN_NSYS' })] }),
    ])))
    abrir()
    await within(lista()).findByRole('button', { name: 'i13128AzulA: No cuadra' })
    expect(within(detalle()).getByText('No cuadra: no está en NSYS')).toBeInTheDocument()
    expect(within(detalle()).getByText('Revisa el IMEI en PEDIDOS 2026: NSYS no lo tiene (mal tecleado o sin dar de alta).')).toBeInTheDocument()
    expect(within(detalle()).queryByRole('table', { name: 'Diferencias' })).not.toBeInTheDocument()
  })

  it('«grado que no se vende»: dice que se cambie el IMEI y la tabla dice que el taller no lo cambia', async () => {
    server.use(http.get('*/api/pedidos', () => HttpResponse.json([
      pedido({ unidades: [unidad({ imei: '350000000000007', imeiFuente: 'PEDIDOS_2026', estado: 'NO_CUADRA', motivo: 'GRADO_NO_VENDIBLE',
        movil: movilUnidad({ grado: 'C' }) })] }),
    ])))
    abrir()
    await within(lista()).findByRole('button', { name: 'i13128AzulA: No cuadra' })
    expect(within(detalle()).getByText('Hay que cambiar el IMEI en PEDIDOS 2026: ese grado no se vende.')).toBeInTheDocument()
    const fila = within(within(detalle()).getByRole('table', { name: 'Diferencias' })).getByRole('row', { name: /^Grado/ })
    expect(fila).toHaveTextContent(/Grado\s*A\s*C ✘\s*no$/)
  })

  it('el eSIM sale en «Pide» y «Móvil», y solo con las partes que hay', async () => {
    server.use(http.get('*/api/pedidos', () => HttpResponse.json([
      pedido({ unidades: [unidad({ imei: '350000000000006', imeiFuente: 'PEDIDOS_2026', estado: 'CUADRA',
        pide: atributos({ modelo: '14', esEsim: true, capacidad: null, color: 'Azul', grado: 'A' }),
        movil: movilUnidad({ modelo: '14', modeloMaestro: '14', esEsim: true, capacidad: '256GB', color: null, grado: 'A' }) })] }),
    ])))
    abrir()
    await within(lista()).findByRole('button', { name: 'i13128AzulA: Cuadra' })
    expect(within(detalle()).getByText('iPhone 14 eSIM · Azul · A')).toBeInTheDocument()
    expect(within(detalle()).getByText('iPhone 14 eSIM · 256GB · A')).toBeInTheDocument()
  })

  it('los botones de Canal y de Estado dicen cuál está pulsado (aria-pressed)', async () => {
    abrir()
    await within(lista()).findAllByRole('article')
    const canal = within(screen.getByRole('group', { name: 'Canal' }))
    const estado = within(screen.getByRole('group', { name: 'Estado' }))
    expect(canal.getByRole('button', { name: /^Todos/ })).toHaveAttribute('aria-pressed', 'true')
    expect(estado.getByRole('button', { name: /^Todos/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(canal.getByRole('button', { name: /^Distribuidores/ }))
    await userEvent.click(estado.getByRole('button', { name: /^No cuadra/ }))
    expect(canal.getByRole('button', { name: /^Distribuidores/ })).toHaveAttribute('aria-pressed', 'true')
    expect(canal.getByRole('button', { name: /^Todos/ })).toHaveAttribute('aria-pressed', 'false')
    expect(estado.getByRole('button', { name: /^No cuadra/ })).toHaveAttribute('aria-pressed', 'true')
    expect(estado.getByRole('button', { name: /^Todos/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('la cabecera usa singular y plural', async () => {
    server.use(http.get('*/api/pedidos', () => HttpResponse.json([pedido()])))
    abrir()
    expect(await screen.findByText('1 unidad en 1 pedido · los más antiguos arriba')).toBeInTheDocument()
  })

  it('sin pedidos y sin filtros dice que no hay pendientes; con filtros que lo vacían, que ninguno los cumple', async () => {
    server.use(http.get('*/api/pedidos', () => HttpResponse.json([])))
    abrir()
    expect(await within(lista()).findByText('No hay pedidos pendientes.')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar pedidos' }), 'zzz')
    expect(within(lista()).getByText('Ningún pedido con estos filtros.')).toBeInTheDocument()
  })

  it('si no se pudo cargar, la lista lo dice y la cabecera no cuenta unidades', async () => {
    server.use(http.get('*/api/pedidos', () => new HttpResponse(null, { status: 500 })))
    abrir()
    expect(await screen.findByText('No se pudo cargar la lista de pedidos.')).toBeInTheDocument()
    expect(screen.queryByText(/unidades? en \d+ pedidos?/)).not.toBeInTheDocument()
    expect(screen.queryByText('No hay pedidos pendientes.')).not.toBeInTheDocument()
  })

  it('al volver (se desmonta y se monta de nuevo) quedan la unidad, los filtros y el interruptor como estaban', async () => {
    const { unmount } = abrir()
    await userEvent.click(await within(lista()).findByRole('button', { name: 'i14256AzulA: No cuadra' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Canal' })).getByRole('button', { name: /^Distribuidores/ }))
    await userEvent.click(screen.getByRole('switch', { name: 'Ver también los del Simulador de más de 14 días' }))
    unmount()
    abrir()
    await within(lista()).findAllByRole('article')
    expect(within(lista()).getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['18832'])
    expect(screen.getByRole('switch', { name: /Simulador de más de 14 días/ })).toHaveAttribute('aria-checked', 'true')
    expect(within(detalle()).getByText('Pedido 18832')).toBeInTheDocument()
  })

  it('la unidad elegida sigue elegida tras un refetch con otro orden o un pedido nuevo delante', async () => {
    let respuesta = PEDIDOS
    server.use(http.get('*/api/pedidos', () => HttpResponse.json(respuesta)))
    const { queryClient } = abrir()
    await userEvent.click(await within(lista()).findByRole('button', { name: 'i14256AzulA: No cuadra' }))
    expect(within(detalle()).getByText('Pedido 18832')).toBeInTheDocument()
    respuesta = [pedido({ idPedido: 9, numero: '402-0000000-0000009', unidades: [unidad({ idUnidad: 9 })] }), ...[...PEDIDOS].reverse()]
    await queryClient.invalidateQueries({ queryKey: ['telefonos', 'pedidos'] })
    await waitFor(() => expect(within(lista()).getAllByRole('article')[0]).toHaveAttribute('aria-label', '402-0000000-0000009'))
    expect(within(detalle()).getByText('Pedido 18832')).toBeInTheDocument()
    expect(within(lista()).getByRole('button', { name: 'i14256AzulA: No cuadra' })).toHaveAttribute('aria-current', 'true')
  })

  it('al cambiar el interruptor de los viejos la lista no se queda en blanco mientras llega la nueva', async () => {
    let soltar!: () => void
    const espera = new Promise<void>((r) => { soltar = r })
    server.use(http.get('*/api/pedidos', async ({ request }) => {
      if (new URL(request.url).searchParams.get('viejos') === 'true') await espera
      return HttpResponse.json(PEDIDOS)
    }))
    abrir()
    await within(lista()).findAllByRole('article')
    await userEvent.click(screen.getByRole('switch', { name: 'Ver también los del Simulador de más de 14 días' }))
    expect(within(lista()).getAllByRole('article')).toHaveLength(4)
    expect(within(lista()).queryByText('No hay pedidos pendientes.')).not.toBeInTheDocument()
    soltar()
  })
})

describe('píldora de las fuentes (spec pieza 2 §9.2)', () => {
  const punto = () => screen.getByRole('button', { name: /^Fuentes:/ }).querySelector('[aria-hidden]')

  it('el nombre del botón empieza por «Fuentes:» y contiene el texto visible', async () => {
    abrir()
    const boton = await screen.findByRole('button', { name: /^Fuentes:/ })
    expect(boton.getAttribute('aria-label')).toContain(boton.textContent ?? '')
  })

  it.each([
    ['OK', 'OK', 'al día', 'bg-verde-ok'],
    ['RETRASO', 'OK', 'con retraso', 'bg-ambar'],
    ['OK', 'SIN_DATOS', 'sin datos', 'bg-fila-urgente-brd'],
  ])('punto del peor nivel: fuentes %s y NSYS %s', async (fuentes, nsys, texto, clase) => {
    server.use(
      http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuentePedidos({ nivel: fuentes }), fuentePedidos({ fuente: 'PEDIDOS_2026' }), fuentePedidos({ fuente: 'SIMULADOR' })])),
      http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys({ nivel: nsys }))),
    )
    abrir()
    expect(await screen.findByRole('button', { name: new RegExp(`NSYS: ${texto}$`) })).toBeInTheDocument()
    expect(punto()).toHaveClass(clase)
  })

  it('la fila de NSYS dice la hora de Items', async () => {
    const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
    server.use(http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys({ ultimaExportacion: `${hoy}T13:31:00` }))))
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: /^Fuentes:/ }))
    expect(await screen.findByText('Items de las 13:31')).toBeInTheDocument()
  })

  it('mientras carga dice «comprobando…» y si falla, «no se pudo comprobar»', async () => {
    let soltar!: () => void
    const espera = new Promise<void>((r) => { soltar = r })
    server.use(http.get('*/api/pedidos/fuentes', async () => { await espera; return HttpResponse.json([fuentePedidos()]) }))
    const { unmount } = abrir()
    expect(await screen.findByText('Fuentes: comprobando…')).toBeInTheDocument()
    soltar()
    expect(await screen.findByRole('button', { name: /^Fuentes:/ })).toBeInTheDocument()
    unmount()
    server.use(http.get('*/api/pedidos/fuentes', () => new HttpResponse(null, { status: 500 })))
    abrir()
    expect(await screen.findByText('Fuentes: no se pudo comprobar')).toBeInTheDocument()
  })
})
