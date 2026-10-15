import { act, getDefaultNormalizer, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// eslint-disable-next-line no-restricted-imports -- "Descargar CSV" vive en el menú de usuario del AppLayout real (patrón de StockPage.test.tsx).
import { AppLayout } from '@/app/shell/AppLayout'
import type { CompraComponente, CompraOtro, Proveedor } from '@/shared/api/client'
import { INTERVALO_CONECTADO_MS } from '@/shared/api/refresco'
import * as csv from '@/shared/lib/csv'
import { abrirNuevoPedido, cerrarFormularioPedido, formularioPedido } from '@/shared/lib/formularioPedido'
import type { Sesion } from '@/shared/session/storage'
import { renderConProviders, renderConRouter, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { PedidosPage, RedirigirPedidosOtros } from './PedidosPage'
import { BLOQUE_PRUEBA } from './formulario/datosPrueba'

const U1 = '2026-09-20T08:30:00'
const U2 = '2026-09-19T08:00:00'
const MSG_MODIFICADO = 'Este pedido fue modificado por otro usuario. Los datos se han recargado.'
const sinColapsar = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) }

const base: CompraComponente = {
  ...BLOQUE_PRUEBA,
  idCompra: 1, idCom: 11, tipoComponente: 'lcd-x-negro', idProv: 1, nombreProveedor: 'Proveedor A', cantidad: 2, cantidadRecibida: null,
  esUrgente: false, fechaPedido: U1, fechaLlegada: null, precioUnidadPedido: 12.5, divisa: 'EUR', precioEur: 12.5, estado: 'pendiente',
  updatedAt: U1,
}
const compra = (o: Partial<CompraComponente>): CompraComponente => ({ ...base, ...o })
/** Orden del servidor (fecha desc) con un cancelado en medio: la página lo lleva al final. */
const compras: CompraComponente[] = [
  compra({ idCompra: 1 }),
  compra({ idCompra: 2, idCom: 12, tipoComponente: 'bat-x', idProv: 2, nombreProveedor: 'Proveedor B', estado: 'en_camino', esUrgente: true, divisa: 'USD', precioUnidadPedido: 10, precioEur: 8.8, fechaPedido: U2, updatedAt: U2 }),
  compra({ idCompra: 5, idCom: 15, tipoComponente: 'mc-x', estado: 'cancelado', fechaPedido: '2026-09-18T08:00:00' }),
  compra({ idCompra: 3, idCom: 13, tipoComponente: 'bat-y', estado: 'parcial', cantidad: 10, cantidadRecibida: 3, fechaPedido: '2026-09-17T08:00:00' }),
  compra({ idCompra: 4, idCom: 14, tipoComponente: 'cam-x', estado: 'recibido', cantidadRecibida: 2, fechaPedido: '2026-09-16T08:00:00' }),
]
const otroBase: CompraOtro = {
  ...BLOQUE_PRUEBA,
  idCompraOtro: 7, idProv: 1, nombreProveedor: 'Proveedor A', concepto: 'Cinta de embalar', cantidad: 3, cantidadRecibida: null,
  esUrgente: false, fechaPedido: U1, fechaLlegada: null, precioUnidadPedido: 2, divisa: 'EUR', precioEur: 2, estado: 'recibido', updatedAt: U1,
}
const otros: CompraOtro[] = [otroBase, { ...otroBase, idCompraOtro: 8, concepto: 'Bolsas', estado: 'pendiente' }]
const proveedor = (idProv: number, nombre: string, activo: boolean, divisa = 'EUR'): Proveedor => ({ idProv, nombre, activo, divisa, comentario: '', tipo: 'COMPONENTES' })
const proveedores = [proveedor(1, 'Proveedor A', true), proveedor(2, 'Proveedor B', true, 'USD'), proveedor(3, 'ACME', false)]
const cargas = { compras: 0, otros: 0 }
/** Lo que devuelve GET /api/compras-otros: ningún otro, salvo en los tests que los pintan (0.9.15). */
let listaOtros: CompraOtro[] = []

beforeEach(() => {
  localStorage.setItem('pedidos.agruparPorBloque', 'no')
  cargas.compras = 0
  cargas.otros = 0
  listaOtros = []
  server.use(
    http.get('*/api/compras', () => { cargas.compras += 1; return HttpResponse.json(compras) }),
    http.get('*/api/compras-otros', () => { cargas.otros += 1; return HttpResponse.json(listaOtros) }),
    http.get('*/api/proveedores', () => HttpResponse.json(proveedores)),
  )
})
afterEach(() => {
  vi.useRealTimers()
  localStorage.removeItem('pedidos.agruparPorBloque')
})

function montar(sesion: Sesion = SESION_SUPER, ruta = '/stock/pedidos') {
  return renderConRouter(
    [
      { path: '/stock/pedidos', element: <PedidosPage /> },
      { path: '/stock/pedidos/otros', element: <RedirigirPedidosOtros /> },
      { path: '/stock', element: <p data-testid="stock">Stock</p> },
    ],
    { sesion, ruta },
  )
}
/** Por texto y no por rol: con un diálogo abierto Radix deja el resto aria-hidden. */
const filaDe = (texto: string) => screen.getByText(texto).closest('tr') as HTMLElement
const abrirMenu = (texto: string) => userEvent.pointer({ keys: '[MouseRight]', target: filaDe(texto) })
/** Nombre de cada fila (componente o concepto) sin la píldora «pieza»/«otro» de delante (0.9.15). */
const nombresEnTabla = () => {
  const i = screen.getAllByRole('columnheader').map((c) => c.textContent).indexOf('Componente / concepto')
  return screen.getAllByRole('row').slice(1).map((r) => (within(r).getAllByRole('cell')[i].textContent ?? '').replace(/^(pieza|otro)/, ''))
}
/** Registra "id acción cuerpo" de cada PATCH de transición y responde con `respuesta`. */
function registrarPatch(ruta: string, respuesta: () => Response = () => new HttpResponse(null, { status: 200 })) {
  const llamadas: string[] = []
  server.use(http.patch(ruta, async ({ params, request }) => { llamadas.push(`${String(params.id)} ${String(params.accion)} ${JSON.stringify(await request.json())}`); return respuesta() }))
  return llamadas
}
/** Peticiones del AppLayout (campana y lateral) en los tests de CSV; los de taller no se importan (regla de módulos). */
function handlersLayout() {
  server.use(
    http.get('*/api/solicitudes/count', () => HttpResponse.json({ value: 0 })),
    http.get('*/api/solicitudes-stock/count', () => HttpResponse.json({ value: 0 })),
    http.get('*/api/solicitudes', () => HttpResponse.json([])),
    http.get('*/api/solicitudes-stock', () => HttpResponse.json([])),
    http.get('*/api/componentes/gestionados', () => HttpResponse.json([])),
  )
}

describe('PedidosPage: vista', () => {
  it('título sin toggle, columnas, cancelados al final, píldora «pieza» y pie "Actualizado"; lee piezas y otros', async () => {
    montar()
    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    await screen.findByText('lcd-x-negro')
    expect(screen.queryByRole('link', { name: 'Componentes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Otros' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['ID', 'Bloque', 'Pedido', 'Componente / concepto', 'Proveedor', 'Cant.', 'P.Unit.', 'EUR', 'Estado'])
    expect(nombresEnTabla()).toEqual(['lcd-x-negro', 'bat-x', 'bat-y', 'cam-x', 'mc-x'])
    expect(within(filaDe('lcd-x-negro')).getByText('pieza')).toBeInTheDocument()
    expect(within(filaDe('bat-x')).getByText('en_camino')).toBeInTheDocument()
    expect(within(filaDe('bat-x')).getByText('⚠')).toBeInTheDocument()
    expect(within(filaDe('bat-x')).getByText('10,00 $')).toBeInTheDocument()
    expect(within(filaDe('bat-x')).getByText('19/09/26 10:00')).toBeInTheDocument()
    expect(within(filaDe('bat-y')).getByText('3/10')).toBeInTheDocument()
    expect(filaDe('lcd-x-negro')).toHaveClass('border-l-8', 'border-l-fila-pendiente-brd')
    expect(filaDe('mc-x')).toHaveClass('opacity-45')
    expect(screen.getByRole('button', { name: /^Actualizado \d\d:\d\d$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo pedido' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo otro pedido' })).not.toBeInTheDocument()
    expect(cargas.compras).toBe(1)
    expect(cargas.otros).toBe(1)
  })
  it('piezas y otros en una sola lista: el otro con su píldora «otro», «O-{id}» y sin enlace; a igual fecha, las piezas primero', async () => {
    listaOtros = otros
    montar()
    await screen.findByText('Cinta de embalar')
    expect(nombresEnTabla()).toEqual(['lcd-x-negro', 'Cinta de embalar', 'Bolsas', 'bat-x', 'bat-y', 'cam-x', 'mc-x'])
    const fila = filaDe('Cinta de embalar')
    expect(within(fila).getByText('otro')).toBeInTheDocument()
    expect(fila.querySelector('[data-columna="id"]')).toHaveTextContent('O-7')
    expect(screen.queryByRole('button', { name: 'Cinta de embalar' })).not.toBeInTheDocument()
  })
  it('el buscador encuentra un otro por su concepto y «Limpiar filtros» vuelve a la lista entera', async () => {
    listaOtros = otros
    montar()
    await screen.findByText('Cinta de embalar')
    await userEvent.type(screen.getByPlaceholderText('Buscar componente o nº de bloque…'), 'bolsas')
    expect(nombresEnTabla()).toEqual(['Bolsas'])
    expect(screen.queryByRole('radiogroup', { name: 'Tipo' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(nombresEnTabla()).toHaveLength(7)
  })
  it('la dirección antigua /stock/pedidos/otros abre Pedidos, sin filtro y con la lista entera', async () => {
    listaOtros = otros
    const { router } = montar(SESION_SUPER, '/stock/pedidos/otros')
    await screen.findByText('Cinta de embalar')
    await waitFor(() => expect(router.state.location.pathname).toBe('/stock/pedidos'))
    expect(router.state.location.search).toBe('')
    expect(nombresEnTabla()).toHaveLength(7)
  })
  it.each([['ADMIN', SESION_ADMIN], ['TECNICO', SESION_TEC]] as const)('%s ve la tabla sin "Nuevo pedido" ni menú contextual', async (_rol, sesion) => {
    montar(sesion)
    await screen.findByText('lcd-x-negro')
    expect(screen.queryByRole('button', { name: 'Nuevo pedido' })).not.toBeInTheDocument()
    await abrirMenu('lcd-x-negro')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
  it('filtros: Estado con los cinco chips, Proveedor solo con activos, Desde, buscador y "Limpiar filtros"', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.click(screen.getByRole('button', { name: 'Estado' }))
    expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual(['pendiente', 'en camino', 'parcial', 'recibido', 'cancelado'])
    await userEvent.click(screen.getByRole('checkbox', { name: 'en camino' }))
    expect(screen.getByRole('button', { name: 'en camino' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'parcial' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: '2 estados' })).toBeInTheDocument()
    expect(nombresEnTabla()).toEqual(['bat-x', 'bat-y'])
    await userEvent.click(screen.getByRole('button', { name: 'Proveedor' }))
    expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual(['Proveedor A', 'Proveedor B'])
    await userEvent.click(screen.getByRole('checkbox', { name: 'Proveedor B' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Proveedor B' })).toBeInTheDocument()
    expect(nombresEnTabla()).toEqual(['bat-x'])
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByRole('button', { name: 'Estado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Proveedor' })).toBeInTheDocument()
    expect(nombresEnTabla()).toHaveLength(5)
    await userEvent.type(screen.getByLabelText('Desde:'), '2026-09-19')
    expect(nombresEnTabla()).toEqual(['lcd-x-negro', 'bat-x'])
    await userEvent.type(screen.getByPlaceholderText('Buscar componente o nº de bloque…'), 'zzz')
    expect(screen.getByText('Sin pedidos')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByLabelText('Desde:')).toHaveValue('')
    expect(screen.getByPlaceholderText('Buscar componente o nº de bloque…')).toHaveValue('')
  })
  it('el enlace Componente navega a Stock con ?componente=<idCom>', async () => {
    const { router } = montar()
    await screen.findByText('bat-x')
    await userEvent.click(screen.getByRole('button', { name: 'bat-x' }))
    expect(await screen.findByTestId('stock')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/stock')
    expect(router.state.location.search).toBe('?componente=12')
  })
  it('llegada desde "En Camino" de Stock: marca los estados, rellena el buscador, selecciona la primera fila filtrada y limpia la URL', async () => {
    server.use(http.get('*/api/compras', () => HttpResponse.json([compra({ idCompra: 6, idCom: 12, tipoComponente: 'bat-x', estado: 'recibido', fechaPedido: '2026-09-21T08:00:00' }), ...compras])))
    const { router } = montar(SESION_TEC, '/stock/pedidos?estados=pendiente%2Cen+camino%2Cparcial&buscar=bat-x')
    await waitFor(() => expect(document.querySelector('tr[aria-selected="true"]')).toHaveTextContent('19/09/26 10:00'))
    expect(document.querySelector('tr[aria-selected="true"]')).toHaveTextContent('bat-x')
    expect(router.state.location.pathname).toBe('/stock/pedidos')
    expect(router.state.location.search).toBe('')
    expect(screen.getByPlaceholderText('Buscar componente o nº de bloque…')).toHaveValue('bat-x')
    expect(screen.getByRole('button', { name: '3 estados' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })
})

describe('PedidosPage: menú y acciones (SUPERTECNICO)', () => {
  it('menú por estado (0.9.9: más «Mover a bloque»); un cancelado no tiene menú (solo se mueven líneas vivas)', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    await abrirMenu('lcd-x-negro')
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Confirmar pedido', 'Editar', 'Borrar', 'Mover a bloque'])
    expect(screen.getAllByRole('separator')).toHaveLength(2)
    await userEvent.keyboard('{Escape}')
    await abrirMenu('bat-x')
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Recepción parcial', 'Confirmar recibido', 'Editar', 'Cancelar pedido', 'Mover a bloque'])
    await userEvent.keyboard('{Escape}')
    await abrirMenu('mc-x')
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
  })
  it('"Confirmar pedido" escribe al pulsar, sin diálogo, y recarga', async () => {
    const llamadas = registrarPatch('*/api/compras/:id/:accion')
    montar()
    await screen.findByText('lcd-x-negro')
    await abrirMenu('lcd-x-negro')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Confirmar pedido' }))
    await waitFor(() => expect(llamadas).toEqual([`1 confirmar {"updatedAt":"${U1}"}`]))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(cargas.compras).toBe(2))
  })
  it('"Confirmar recibido" y "Cerrar sin resto" también escriben al pulsar', async () => {
    const llamadas = registrarPatch('*/api/compras/:id/:accion')
    montar()
    await screen.findByText('bat-x')
    await abrirMenu('bat-x')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Confirmar recibido' }))
    await waitFor(() => expect(llamadas).toHaveLength(1))
    await abrirMenu('bat-y')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sin resto' }))
    await waitFor(() => expect(llamadas).toEqual([`2 confirmar-recibido {"updatedAt":"${U2}"}`, `3 confirmar-alterado {"updatedAt":"${U1}"}`]))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('"Recepción parcial": diálogo con sus textos, validación local y PATCH con la cantidad; se cierra al terminar', async () => {
    const llamadas = registrarPatch('*/api/compras/:id/:accion')
    montar()
    await screen.findByText('bat-x')
    await abrirMenu('bat-x')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Recepción parcial' }))
    const dlg = screen.getByRole('dialog', { name: 'Recepción parcial' })
    expect(within(dlg).getByText('Pedido #2 — bat-x (2 pedidas)')).toBeInTheDocument()
    const campo = within(dlg).getByLabelText('Cantidad recibida ahora:')
    await userEvent.type(campo, 'abc{Enter}')
    expect(within(dlg).getByRole('alert')).toHaveTextContent('Cantidad no válida.')
    await userEvent.clear(campo)
    await userEvent.type(campo, '2{Enter}')
    expect(within(dlg).getByRole('alert')).toHaveTextContent('La cantidad debe ser mayor que 0 y menor que 2.')
    expect(llamadas).toEqual([])
    await userEvent.clear(campo)
    await userEvent.type(campo, '1{Enter}')
    await waitFor(() => expect(llamadas).toEqual([`2 confirmar-parcial {"cantidadRecibida":1,"updatedAt":"${U2}"}`]))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('un 409 dentro de "Recepción parcial" cierra el diálogo, avisa "modificado por otro usuario" y recarga', async () => {
    const llamadas = registrarPatch('*/api/compras/:id/:accion', () => HttpResponse.json({ message: 'El pedido ya no está en camino' }, { status: 409 }))
    montar()
    await screen.findByText('bat-x')
    const antes = cargas.compras
    await abrirMenu('bat-x')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Recepción parcial' }))
    const dlg = screen.getByRole('dialog', { name: 'Recepción parcial' })
    const campo = within(dlg).getByLabelText('Cantidad recibida ahora:')
    await userEvent.type(campo, '1{Enter}')
    await waitFor(() => expect(llamadas).toEqual([`2 confirmar-parcial {"cantidadRecibida":1,"updatedAt":"${U2}"}`]))
    const aviso = await screen.findByRole('dialog', { name: 'Advertencia' })
    expect(within(aviso).getByText(MSG_MODIFICADO)).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Recepción parcial' })).not.toBeInTheDocument()
    expect(screen.queryByText('El pedido ya no está en camino')).not.toBeInTheDocument()
    await waitFor(() => expect(cargas.compras).toBeGreaterThan(antes))
  })
  it('"Recibir resto": un 422 del servidor se pinta inline y el diálogo sigue abierto, sin aviso global', async () => {
    const msg = 'No puedes recibir más de lo pedido. Faltan 7 unidad(es).'
    registrarPatch('*/api/compras/:id/:accion', () => HttpResponse.json({ message: msg }, { status: 422 }))
    montar()
    await screen.findByText('bat-y')
    await abrirMenu('bat-y')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Recibir resto' }))
    const dlg = screen.getByRole('dialog', { name: 'Recibir unidades' })
    expect(within(dlg).getByLabelText('Cantidad que llega ahora:')).toHaveValue('7')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Confirmar' }))
    expect(await within(dlg).findByRole('alert')).toHaveTextContent(msg)
    expect(screen.getByRole('dialog', { name: 'Recibir unidades' })).toBeInTheDocument()
    expect(screen.getAllByText(msg)).toHaveLength(1)
  })
  it('"Cancelar pedido": confirmación con sus textos (dos botones que empiezan por "Cancelar") y PATCH', async () => {
    const llamadas = registrarPatch('*/api/compras/:id/:accion')
    montar()
    await screen.findByText('bat-x')
    await abrirMenu('bat-x')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cancelar pedido' }))
    const dlg = screen.getByRole('dialog', { name: 'Cancelar pedido' })
    expect(within(dlg).getByText('¿Cancelar el pedido #2 de bat-x?')).toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancelar pedido' }))
    await waitFor(() => expect(llamadas).toEqual([`2 cancelar {"updatedAt":"${U2}"}`]))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('"Borrar": confirmación y DELETE sin cuerpo', async () => {
    const borrados: string[] = []
    server.use(http.delete('*/api/compras/:id', ({ params }) => { borrados.push(String(params.id)); return new HttpResponse(null, { status: 200 }) }))
    montar()
    await screen.findByText('lcd-x-negro')
    await abrirMenu('lcd-x-negro')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Borrar' }))
    const dlg = screen.getByRole('dialog', { name: 'Borrar pedido' })
    expect(within(dlg).getByText('¿Borrar el pedido pendiente #1 de lcd-x-negro?')).toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(borrados).toEqual(['1']))
  })
  it('"Revertir a En camino" de componentes: tres líneas; un 409 enseña el mensaje del servidor y recarga', async () => {
    const msg = 'Stock insuficiente para deshacer la recepción (stock actual: 1, a descontar: 2)'
    const llamadas = registrarPatch('*/api/compras/:id/:accion', () => HttpResponse.json({ message: msg }, { status: 409 }))
    montar()
    await screen.findByText('cam-x')
    const antes = cargas.compras
    await abrirMenu('cam-x')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Revertir a En camino' }))
    const dlg = screen.getByRole('dialog', { name: 'Revertir a En camino' })
    expect(within(dlg).getByText('¿Revertir el pedido #4 de cam-x a En camino?\nSe descontarán 2 unidad(es) del stock.\nRecuerda revisar el stock tras la operación.', sinColapsar)).toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Revertir a En camino' }))
    const aviso = await screen.findByRole('dialog', { name: 'Advertencia' })
    expect(within(aviso).getByText(msg)).toBeInTheDocument()
    expect(llamadas).toEqual([`4 desrecibir {"updatedAt":"${U1}"}`])
    expect(screen.queryByText(MSG_MODIFICADO)).not.toBeInTheDocument()
    await waitFor(() => expect(cargas.compras).toBeGreaterThan(antes))
  })
  it('"Revertir a En camino" de un otro: una sola línea, «#O-{id}» y la ruta de otros', async () => {
    listaOtros = otros
    const llamadas = registrarPatch('*/api/compras-otros/:id/:accion')
    montar()
    await screen.findByText('Cinta de embalar')
    await abrirMenu('Cinta de embalar')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Revertir a En camino' }))
    const dlg = screen.getByRole('dialog', { name: 'Revertir a En camino' })
    expect(within(dlg).getByText('¿Revertir el pedido #O-7 de Cinta de embalar a En camino?', sinColapsar)).toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Revertir a En camino' }))
    await waitFor(() => expect(llamadas).toEqual([`7 desrecibir {"updatedAt":"${U1}"}`]))
  })
  it('un otro pendiente: su menú lleva «Mover a bloque» y «Confirmar pedido» va a /api/compras-otros (0.9.15)', async () => {
    listaOtros = otros
    const llamadas = registrarPatch('*/api/compras-otros/:id/:accion')
    montar()
    await screen.findByText('Bolsas')
    await abrirMenu('Bolsas')
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Confirmar pedido', 'Editar', 'Borrar', 'Mover a bloque'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Confirmar pedido' }))
    await waitFor(() => expect(llamadas).toEqual([`8 confirmar {"updatedAt":"${U1}"}`]))
    await waitFor(() => expect(cargas.otros).toBe(2))
  })
  it('un 409 en cualquier otra transición avisa "Este pedido fue modificado por otro usuario…" y recarga', async () => {
    registrarPatch('*/api/compras/:id/:accion', () => HttpResponse.json({ message: 'El pedido ya no está pendiente' }, { status: 409 }))
    montar()
    await screen.findByText('lcd-x-negro')
    await abrirMenu('lcd-x-negro')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Confirmar pedido' }))
    const aviso = await screen.findByRole('dialog', { name: 'Advertencia' })
    expect(within(aviso).getByText(MSG_MODIFICADO)).toBeInTheDocument()
    expect(screen.queryByText('El pedido ya no está pendiente')).not.toBeInTheDocument()
    await waitFor(() => expect(cargas.compras).toBe(2))
  })
  it('"Nuevo pedido" abre el formulario de alta en el sitio (store); ya no hay «Nuevo otro pedido»', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    expect(screen.queryByRole('button', { name: 'Nuevo otro pedido' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    expect(formularioPedido.get()).toEqual({ tipo: 'compra', precarga: { modo: 'vacio' } })
    act(() => cerrarFormularioPedido())
  })
})

describe('PedidosPage: refresco y CSV', () => {
  it('la selección sobrevive al refresco de 60 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    montar()
    await screen.findByText('cam-x')
    // Clic en Proveedor: en Componente está el enlace, que navega.
    await userEvent.click(within(filaDe('cam-x')).getAllByRole('cell')[4])
    expect(filaDe('cam-x')).toHaveAttribute('aria-selected', 'true')
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS) })
    await waitFor(() => expect(cargas.compras).toBe(2))
    expect(filaDe('cam-x')).toHaveAttribute('aria-selected', 'true')
  })
  it('con un diálogo abierto el sondeo se congela', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    montar()
    await screen.findByText('bat-x')
    await abrirMenu('bat-x')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Recepción parcial' }))
    expect(screen.getByRole('dialog', { name: 'Recepción parcial' })).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS * 2) })
    expect(cargas.compras).toBe(1)
    expect(cargas.otros).toBe(1)
  })
  it('con el formulario de alta abierto el sondeo se congela y vuelve al cerrarlo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    montar()
    await screen.findByText('lcd-x-negro')
    act(() => abrirNuevoPedido({ modo: 'vacio' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS * 2) })
    expect(cargas.compras).toBe(1)
    act(() => cerrarFormularioPedido())
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS) })
    await waitFor(() => expect(cargas.compras).toBeGreaterThan(1))
  })
  it('"Actualizado HH:mm" recarga las dos listas, piezas y otros (0.9.15)', async () => {
    montar(SESION_TEC)
    await screen.findByText('lcd-x-negro')
    expect(cargas.compras).toBe(1)
    expect(cargas.otros).toBe(1)
    await userEvent.click(screen.getByRole('button', { name: /^Actualizado \d\d:\d\d$/ }))
    await waitFor(() => expect(cargas.compras).toBe(2))
    await waitFor(() => expect(cargas.otros).toBe(2))
  })
  it('Descargar CSV exporta la lista visible, piezas y otros, con «Tipo» tras «ID» y «O-{id}» en los otros (0.9.15)', async () => {
    listaOtros = otros
    const descargar = vi.spyOn(csv, 'descargarCsv').mockResolvedValue(undefined)
    handlersLayout()
    renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/stock/pedidos', layout: <AppLayout /> })
    await screen.findByText('Cinta de embalar')
    // «ba»: bat-x, bat-y y «Cinta de em-ba-lar».
    await userEvent.type(screen.getByPlaceholderText('Buscar componente o nº de bloque…'), 'ba')
    await userEvent.click(screen.getByRole('button', { name: /Hola,/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Descargar CSV' }))
    const [nombre, cabeceras, filas] = descargar.mock.calls[0]
    expect(nombre).toBe('pedidos')
    expect(cabeceras).toEqual(['ID', 'Tipo', 'Bloque', 'Nota del bloque', 'Fecha pedido', 'Componente', 'Cantidad', 'Urgente', 'Proveedor', 'Precio unidad', 'Divisa', 'Total EUR', 'Estado'])
    expect(filas).toEqual([
      ['O-7', 'otro', '1', '', '20/09/2026 10:30', 'Cinta de embalar', '3', 'No', 'Proveedor A', '2,00', 'EUR', '6,00', 'recibido'],
      ['2', 'pieza', '1', '', '19/09/2026 10:00', 'bat-x', '2', 'Sí', 'Proveedor B', '10,00', 'USD', '17,60', 'en_camino'],
      ['3', 'pieza', '1', '', '17/09/2026 10:00', 'bat-y', '10', 'No', 'Proveedor A', '12,50', 'EUR', '125,00', 'parcial'],
    ])
    descargar.mockRestore()
  })
})

describe('PedidosPage: tabla fluida', () => {
  it('la tabla, con piezas y otros, ocupa todo el ancho sin columna de relleno (ajuste fluido)', async () => {
    listaOtros = otros
    const { container } = montar()
    await screen.findByText('Cinta de embalar')
    expect(container.querySelector('[data-relleno]')).toBeNull()
  })
})
