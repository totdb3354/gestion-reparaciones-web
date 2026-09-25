import { act, getDefaultNormalizer, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Route } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// eslint-disable-next-line no-restricted-imports -- "Descargar CSV" vive en el menú de usuario del AppLayout real (patrón de HistorialPage.test.tsx).
import { AppLayout } from '@/app/shell/AppLayout'
import { INTERVALO_CONECTADO_MS } from '@/shared/api/refresco'
import * as csv from '@/shared/lib/csv'
import { cerrarFormularioPedido, formularioPedido } from '@/shared/lib/formularioPedido'
import type { EstadoStock } from '@/shared/lib/semaforoStock'
import { renderConProviders, renderConRouter, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { ultimaRutaStock } from '../estado'
import { filtrosStock, seleccionStock } from './estado'
import { StockPage } from './StockPage'

const base = { fechaRegistro: '2026-09-01T10:00:00', updatedAt: '2026-09-01T10:00:00', ultimoPedido: null, idComMaster: null }
const componentes = [
  { ...base, idCom: 1, tipo: 'lcd-x', stock: 5, stockMinimo: 2, activo: true, enCamino: 0 },
  { ...base, idCom: 2, tipo: 'bat-x', stock: 2, stockMinimo: 3, activo: true, enCamino: 4 },
  { ...base, idCom: 3, tipo: 'cam-x', stock: 0, stockMinimo: 1, activo: true, enCamino: 0 },
  { ...base, idCom: 4, tipo: 'mc-x', stock: 1, stockMinimo: 0, activo: false, enCamino: 0 },
  { ...base, idCom: 5, tipo: 'lcd-y', stock: 5, stockMinimo: 2, activo: true, enCamino: 3, idComMaster: 1 },
]
const cargas = { n: 0 }

beforeEach(() => {
  cargas.n = 0
  server.use(
    http.get('*/api/componentes/gestionados', () => { cargas.n += 1; return HttpResponse.json(componentes) }),
    http.get('*/api/compras/cantidad-en-camino/:id', ({ params }) => HttpResponse.json({ value: params.id === '2' ? 4 : 0 })),
  )
})
afterEach(() => vi.useRealTimers())

const rutasPedidos = <Route path="/stock/pedidos" element={<p data-testid="pedidos">Pedidos</p>} />
const montar = (sesion = SESION_SUPER) => renderConProviders(<StockPage />, { sesion, ruta: '/stock', rutas: rutasPedidos })
const filaDe = (tipo: string) => screen.getByRole('row', { name: new RegExp(`^${tipo}`) })

describe('StockPage', () => {
  it('título, tabla con activos primero y desactivados al final, pie con "1 desactivado" y "Actualizado"', async () => {
    montar()
    expect(await screen.findByRole('heading', { name: 'Stock actual' })).toBeInTheDocument()
    // El título se pinta antes de que llegue la consulta: se esperan los datos antes de leer las filas.
    await screen.findByText('lcd-x')
    const filas = screen.getAllByRole('row').slice(1).map((r) => r.textContent ?? '')
    expect(filas[filas.length - 1]).toMatch(/^mc-x/)
    expect(screen.getByText('lcd-y  (compartido)', { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) })).toBeInTheDocument()
    expect(screen.getByText('1 desactivado')).toHaveClass('text-[10px]', 'text-texto-vacio')
    expect(screen.getByText(/^Actualizado \d\d:\d\d$/)).toBeInTheDocument()
    // "Sin stock" también está en la leyenda del donut: se busca el badge dentro de la tabla.
    expect(within(screen.getByRole('table')).getByText('Sin stock')).toBeInTheDocument()
  })
  it('el pie va en una línea: "N desactivados" a la izquierda y "Actualizado" a la derecha, en el mismo contenedor', async () => {
    montar()
    await screen.findByText('lcd-x')
    const desactivados = screen.getByText('1 desactivado')
    const actualizado = screen.getByRole('button', { name: /^Actualizado \d\d:\d\d$/ })
    const pie = desactivados.parentElement
    expect(pie).toBe(actualizado.parentElement)
    expect(pie).toHaveClass('flex', 'items-center', 'justify-between')
    // El botón no se estira (w-full lo estrechaba todo y partía el texto de la izquierda en dos líneas).
    expect(actualizado).not.toHaveClass('w-full')
    expect(actualizado).toHaveClass('shrink-0', 'whitespace-nowrap')
    expect(desactivados).toHaveClass('whitespace-nowrap')
  })
  it('al entrar guarda "/stock" como última pestaña de Stock (el botón "Stock" de la barra superior vuelve aquí)', async () => {
    ultimaRutaStock.set('/stock/proveedores')
    montar()
    await screen.findByText('lcd-x')
    expect(ultimaRutaStock.get()).toBe('/stock')
  })
  it('el donut cuenta sobre todo (activos) y no cambia al filtrar; el buscador filtra "contiene" y vacío pinta "Sin componentes"', async () => {
    montar()
    await screen.findByText('lcd-x')
    const leyenda = within(screen.getByTestId('donut-leyenda'))
    expect(leyenda.getByText('OK').nextSibling).toHaveTextContent('2')
    expect(leyenda.getByText('Bajo').nextSibling).toHaveTextContent('1')
    expect(leyenda.getByText('Sin stock').nextSibling).toHaveTextContent('1')
    await userEvent.type(screen.getByPlaceholderText('Buscar componente…'), 'LCD')
    expect(screen.queryByText('bat-x')).not.toBeInTheDocument()
    expect(leyenda.getByText('OK').nextSibling).toHaveTextContent('2')
    await userEvent.clear(screen.getByPlaceholderText('Buscar componente…'))
    await userEvent.type(screen.getByPlaceholderText('Buscar componente…'), 'zzz')
    expect(screen.getByText('Sin componentes')).toBeInTheDocument()
  })
  it('filtro Estado: casillas sin cerrar el desplegable, texto "N estados", "Desactivado" solo si hay; Limpiar filtros', async () => {
    montar()
    await screen.findByText('lcd-x')
    await userEvent.click(screen.getByRole('button', { name: 'Estado' }))
    // MultiSelect pinta cada opción como checkbox con aria-label = etiqueta (MultiSelect.tsx)
    expect(screen.getAllByRole('checkbox').map((i) => i.getAttribute('aria-label'))).toEqual(['OK', 'Bajo', 'Sin stock', 'Desactivado'])
    await userEvent.click(screen.getByRole('checkbox', { name: 'Bajo' }))
    // marcar no cierra el desplegable (calco de hideOnClick=false)
    expect(screen.getByRole('checkbox', { name: 'Sin stock' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bajo' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sin stock' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: '2 estados' })).toBeInTheDocument()
    expect(screen.queryByText('lcd-x')).not.toBeInTheDocument()
    expect(screen.getByText('bat-x')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByRole('button', { name: 'Estado' })).toBeInTheDocument()
    expect(screen.getByText('lcd-x')).toBeInTheDocument()
  })
  it('sin desactivados el check "Desactivado" no aparece ni el pie', async () => {
    server.use(http.get('*/api/componentes/gestionados', () => HttpResponse.json(componentes.filter((c) => c.activo))))
    montar()
    await screen.findByText('lcd-x')
    expect(screen.queryByText(/desactivado/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Estado' }))
    expect(screen.getByRole('checkbox', { name: 'Sin stock' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Desactivado' })).not.toBeInTheDocument()
  })
  it('seleccionar una fila pinta el gráfico por SKU con la barra Pedido (supertécnico) y la selección sobrevive al refresco', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    montar()
    await screen.findByText('bat-x')
    await userEvent.click(screen.getByText('bat-x'))
    expect(await screen.findByRole('img', { name: 'Stock 2, Pedido 4' })).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS) })
    await waitFor(() => expect(cargas.n).toBe(2))
    expect(filaDe('bat-x')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('img', { name: 'Stock 2, Pedido 4' })).toBeInTheDocument()
  })
  it('el TECNICO no pide la cantidad en camino: la barra Pedido va a 0', async () => {
    let pedida = false
    server.use(http.get('*/api/compras/cantidad-en-camino/:id', () => { pedida = true; return HttpResponse.json({ value: 4 }) }))
    montar(SESION_TEC)
    await screen.findByText('bat-x')
    await userEvent.click(screen.getByText('bat-x'))
    expect(await screen.findByRole('img', { name: 'Stock 2, Pedido 0' })).toBeInTheDocument()
    expect(pedida).toBe(false)
  })
  it('si falla la cantidad en camino, el gráfico por SKU conserva el anterior (título incluido) y avisa', async () => {
    montar()
    await screen.findByText('bat-x')
    await userEvent.click(screen.getByText('bat-x'))
    expect(await screen.findByRole('img', { name: 'Stock 2, Pedido 4' })).toBeInTheDocument()
    server.use(http.get('*/api/compras/cantidad-en-camino/:id', () => new HttpResponse(null, { status: 404 })))
    await userEvent.click(within(screen.getByRole('table')).getByText('cam-x'))
    expect(await screen.findByText('Recurso no encontrado.')).toBeInTheDocument()
    // El aviso es un diálogo modal: Radix marca aria-hidden el resto, de ahí hidden: true.
    expect(screen.getByRole('img', { name: 'Stock 2, Pedido 4', hidden: true })).toBeInTheDocument()
    // Radix pone aria-hidden en el propio <h2> y su nombre accesible queda vacío: se busca por texto en el título del gráfico.
    expect(screen.getByText('bat-x', { selector: 'h2' })).toBeInTheDocument()
  })
  it('"En Camino" > 0 navega a Pedidos con los tres estados y el buscador', async () => {
    const { router } = renderConRouter(
      [
        { path: '/stock', element: <StockPage /> },
        { path: '/stock/pedidos', element: <p data-testid="pedidos">Pedidos</p> },
      ],
      { sesion: SESION_SUPER, ruta: '/stock' },
    )
    await screen.findByText('bat-x')
    await userEvent.click(screen.getByRole('button', { name: '4' }))
    expect(await screen.findByTestId('pedidos')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/stock/pedidos')
    // URLSearchParams codifica la coma como %2C y el espacio como +.
    expect(router.state.location.search).toBe('?estados=pendiente%2Cen+camino%2Cparcial&buscar=bat-x')
  })
  it('"Pedir" del menú abre "Nuevo pedido" en el sitio con ese componente, sin navegar (4b, P1)', async () => {
    const { router } = renderConRouter(
      [
        { path: '/stock', element: <StockPage /> },
        { path: '/stock/pedidos', element: <p data-testid="pedidos">Pedidos</p> },
      ],
      { sesion: SESION_SUPER, ruta: '/stock' },
    )
    await screen.findByText('lcd-x')
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('lcd-x') })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Pedir' }))
    expect(formularioPedido.get()).toEqual({ tipo: 'compra', precarga: { modo: 'componentes', idsCom: [1] } })
    expect(router.state.location.pathname).toBe('/stock')
    expect(router.state.location.search).toBe('')
    expect(screen.queryByTestId('pedidos')).not.toBeInTheDocument()
  })
  it('menú del supertécnico: los cinco ítems con separadores; "Activar" en una desactivada; ADMIN sin menú; TECNICO solo "Solicitar pieza"', async () => {
    montar()
    await screen.findByText('lcd-x')
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('lcd-x') })
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Pedir', 'Editar stock', 'Ajustar mínimo', 'Desactivar', 'Solicitar pieza'])
    expect(screen.getAllByRole('separator')).toHaveLength(3)
    await userEvent.keyboard('{Escape}')
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('mc-x') })
    expect(screen.getByRole('menuitem', { name: 'Activar' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
  })
  it('ADMIN no tiene menú contextual', async () => {
    montar(SESION_ADMIN)
    await screen.findByText('lcd-x')
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('lcd-x') })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
  it('TECNICO solo ve "Solicitar pieza"', async () => {
    montar(SESION_TEC)
    await screen.findByText('lcd-x')
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('lcd-x') })
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Solicitar pieza'])
  })
  it('"Editar stock" manda el PUT, recarga, y un 409 cierra el diálogo con el aviso y recarga', async () => {
    let cuerpo: unknown = null
    let estado = 200
    server.use(http.put('*/api/componentes/1', async ({ request }) => { cuerpo = await request.json(); return estado === 200 ? new HttpResponse(null, { status: 200 }) : HttpResponse.json({ message: 'Dato modificado por otro usuario' }, { status: 409 }) }))
    montar()
    await screen.findByText('lcd-x')
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('lcd-x') })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar stock' }))
    const campo = within(screen.getByRole('dialog', { name: 'Editar stock' })).getByLabelText('Nueva cantidad')
    await userEvent.clear(campo)
    await userEvent.type(campo, '8{Enter}')
    await waitFor(() => expect(cuerpo).toEqual({ tipo: 'lcd-x', stock: 8, stockMinimo: 2, updatedAt: '2026-09-01T10:00:00' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(cargas.n).toBe(2))
    estado = 409
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('lcd-x') })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar stock' }))
    await userEvent.type(within(screen.getByRole('dialog')).getByLabelText('Nueva cantidad'), '{Enter}')
    expect(await screen.findByText('El componente fue modificado mientras editabas. Recarga los datos.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Editar stock' })).not.toBeInTheDocument()
    await waitFor(() => expect(cargas.n).toBe(3))
  })
  it('un error que no es 409 ni 422 en Editar stock deja el diálogo abierto y avisa', async () => {
    server.use(http.put('*/api/componentes/1', () => HttpResponse.json({ message: 'Recurso no encontrado.' }, { status: 404 })))
    montar()
    await screen.findByText('lcd-x')
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('lcd-x') })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar stock' }))
    await userEvent.type(within(screen.getByRole('dialog', { name: 'Editar stock' })).getByLabelText('Nueva cantidad'), '{Enter}')
    expect(await screen.findByText('Recurso no encontrado.')).toBeInTheDocument()
    // El aviso es un diálogo modal: Radix marca aria-hidden el resto (patrón de :124), y con el título vía
    // aria-labelledby oculto el nombre accesible del rol "dialog" se computa vacío; se busca por el título en vez.
    expect(screen.getByText('Editar stock', { selector: 'h2' })).toBeInTheDocument()
    expect(within(screen.getByText('Editar stock', { selector: 'h2' }).closest('[role="dialog"]')!).getByLabelText('Nueva cantidad')).toBeInTheDocument()
  })
  it('un 422 del servidor se muestra inline y el diálogo sigue abierto (Editar stock y Ajustar mínimo), sin aviso global', async () => {
    server.use(
      http.put('*/api/componentes/1', () => HttpResponse.json({ message: 'Cantidad no válida (debe ser ≥ 0).' }, { status: 422 })),
      http.patch('*/api/componentes/1/stock-minimo', () => HttpResponse.json({ message: 'Valor no válido (debe ser ≥ 0).' }, { status: 422 })),
    )
    montar()
    await screen.findByText('lcd-x')
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('lcd-x') })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar stock' }))
    const editar = screen.getByRole('dialog', { name: 'Editar stock' })
    await userEvent.type(within(editar).getByLabelText('Nueva cantidad'), '{Enter}')
    expect(await within(editar).findByRole('alert')).toHaveTextContent('Cantidad no válida (debe ser ≥ 0).')
    expect(screen.getByRole('dialog', { name: 'Editar stock' })).toBeInTheDocument()
    expect(screen.getAllByText('Cantidad no válida (debe ser ≥ 0).')).toHaveLength(1)
    await userEvent.click(within(editar).getByRole('button', { name: 'Cancelar' }))
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('lcd-x') })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Ajustar mínimo' }))
    const minimo = screen.getByRole('dialog', { name: 'Ajustar mínimo' })
    await userEvent.type(within(minimo).getByLabelText('Nuevo stock mínimo:'), '{Enter}')
    expect(await within(minimo).findByRole('alert')).toHaveTextContent('Valor no válido (debe ser ≥ 0).')
    expect(screen.getByRole('dialog', { name: 'Ajustar mínimo' })).toBeInTheDocument()
    expect(screen.getAllByText('Valor no válido (debe ser ≥ 0).')).toHaveLength(1)
  })
  it('"Ajustar mínimo" hace el PATCH; "Desactivar" sin confirmación; "Solicitar pieza" hace el POST sin recargar', async () => {
    const llamadas: string[] = []
    server.use(
      http.patch('*/api/componentes/1/stock-minimo', async ({ request }) => { llamadas.push(`min ${JSON.stringify(await request.json())}`); return new HttpResponse(null, { status: 200 }) }),
      http.patch('*/api/componentes/1/activo', async ({ request }) => { llamadas.push(`act ${JSON.stringify(await request.json())}`); return new HttpResponse(null, { status: 200 }) }),
      http.post('*/api/solicitudes-stock', async ({ request }) => { llamadas.push(`sol ${JSON.stringify(await request.json())}`); return new HttpResponse(null, { status: 201 }) }),
    )
    montar()
    await screen.findByText('lcd-x')
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('lcd-x') })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Ajustar mínimo' }))
    const campo = within(screen.getByRole('dialog', { name: 'Ajustar mínimo' })).getByLabelText('Nuevo stock mínimo:')
    await userEvent.clear(campo)
    await userEvent.type(campo, '7{Enter}')
    await waitFor(() => expect(llamadas).toContain('min {"stockMinimo":7}'))
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('lcd-x') })
    const cargasAntesDeDesactivar = cargas.n
    await userEvent.click(screen.getByRole('menuitem', { name: 'Desactivar' }))
    await waitFor(() => expect(llamadas).toContain('act {"activo":false}'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // La invalidación del PATCH recarga en diferido: se espera a esa recarga antes de tomar la referencia.
    await waitFor(() => expect(cargas.n).toBeGreaterThan(cargasAntesDeDesactivar))
    const antes = cargas.n
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('lcd-x') })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Solicitar pieza' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Solicitar pieza' })).getByRole('button', { name: 'Solicitar' }))
    await waitFor(() => expect(llamadas).toContain('sol {"idCom":1,"descripcion":null}'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(cargas.n).toBe(antes)
  })
  it('con un diálogo abierto el sondeo se congela', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    montar()
    await screen.findByText('lcd-x')
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('lcd-x') })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar stock' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS * 2) })
    expect(cargas.n).toBe(1)
  })
  it('los filtros sobreviven a salir y volver a la vista (store)', async () => {
    const { unmount } = montar()
    await screen.findByText('lcd-x')
    await userEvent.type(screen.getByPlaceholderText('Buscar componente…'), 'bat')
    unmount()
    montar()
    expect(await screen.findByPlaceholderText('Buscar componente…')).toHaveValue('bat')
  })
  it('Descargar CSV exporta la lista filtrada con el nombre y las cabeceras del JavaFX', async () => {
    const descargar = vi.spyOn(csv, 'descargarCsv').mockImplementation(() => {})
    // <AppLayout/> monta la campana y el SubNav: sus peticiones van con handlers propios (no se importan los de taller,
    // regla de módulos). Si onUnhandledRequest:'error' señala otra, se añade aquí. No se pisa el de `gestionados`.
    server.use(
      http.get('*/api/solicitudes/count', () => HttpResponse.json({ value: 0 })),
      http.get('*/api/solicitudes-stock/count', () => HttpResponse.json({ value: 0 })),
      http.get('*/api/solicitudes', () => HttpResponse.json([])),
      http.get('*/api/solicitudes-stock', () => HttpResponse.json([])),
    )
    renderConProviders(<StockPage />, { sesion: SESION_SUPER, ruta: '/stock', layout: <AppLayout /> })
    await screen.findByText('lcd-x')
    await userEvent.type(screen.getByPlaceholderText('Buscar componente…'), 'bat')
    await userEvent.click(screen.getByRole('button', { name: /Hola,/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Descargar CSV' }))
    const [nombre, cabeceras, filas] = descargar.mock.calls[0]
    expect(nombre).toBe('stock_actual')
    expect(cabeceras).toEqual(['Tipo', 'Stock', 'Stock mínimo', 'Estado', 'En camino', 'Fecha registro'])
    // fechaRegistro 10:00 UTC → 12:00 en Madrid (formatear, como el CSV del JavaFX).
    expect(filas).toEqual([['bat-x', '2', '3', 'Bajo', '4', '01/09/2026 12:00']])
    descargar.mockRestore()
  })
  it('"Limpiar filtros" desmarca las casillas y vacía el buscador sin tocar la selección', async () => {
    montar()
    await screen.findByText('lcd-x')
    await userEvent.type(screen.getByPlaceholderText('Buscar componente…'), 'bat')
    await userEvent.click(screen.getByRole('button', { name: 'Estado' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Bajo' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(within(screen.getByRole('table')).getByText('bat-x'))
    expect(filaDe('bat-x')).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByPlaceholderText('Buscar componente…')).toHaveValue('')
    await userEvent.click(screen.getByRole('button', { name: 'Estado' }))
    for (const casilla of screen.getAllByRole('checkbox')) expect(casilla).not.toBeChecked()
    await userEvent.keyboard('{Escape}')
    expect(within(screen.getByRole('table')).getByText('lcd-x')).toBeInTheDocument()
    expect(filaDe('bat-x')).toHaveAttribute('aria-selected', 'true')
  })
  it('"Ajustar mínimo": tras el PATCH se cierra el diálogo y se recarga la lista de componentes', async () => {
    let patch = false
    server.use(http.patch('*/api/componentes/1/stock-minimo', () => { patch = true; return new HttpResponse(null, { status: 200 }) }))
    montar()
    await screen.findByText('lcd-x')
    const antes = cargas.n
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('lcd-x') })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Ajustar mínimo' }))
    const campo = within(screen.getByRole('dialog', { name: 'Ajustar mínimo' })).getByLabelText('Nuevo stock mínimo:')
    await userEvent.clear(campo)
    await userEvent.type(campo, '7{Enter}')
    await waitFor(() => expect(patch).toBe(true))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(cargas.n).toBeGreaterThan(antes))
  })
  it('el refresco de 60 s solo recarga la pestaña visible: componentes sí, proveedores no', async () => {
    const proveedores = { n: 0 }
    server.use(http.get('*/api/proveedores', () => { proveedores.n += 1; return HttpResponse.json([]) }))
    vi.useFakeTimers({ shouldAdvanceTime: true })
    montar()
    await screen.findByText('lcd-x')
    expect(cargas.n).toBe(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS) })
    await waitFor(() => expect(cargas.n).toBe(2))
    expect(proveedores.n).toBe(0)
  })
  it('un error de "Solicitar pieza" (403) deja el diálogo abierto y avisa con el mensaje mapeado', async () => {
    server.use(http.post('*/api/solicitudes-stock', () => HttpResponse.json({ message: 'Prohibido' }, { status: 403 })))
    montar()
    await screen.findByText('lcd-x')
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('lcd-x') })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Solicitar pieza' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Solicitar pieza' })).getByRole('button', { name: 'Solicitar' }))
    expect(await screen.findByText('No tienes permisos para realizar esta acción.')).toBeInTheDocument()
    // El aviso es modal: el diálogo de fondo queda aria-hidden, se localiza por su título (patrón de "Editar stock").
    const titulo = screen.getByText('Solicitar pieza', { selector: 'h2' })
    expect(within(titulo.closest('[role="dialog"]')!).getByRole('button', { name: 'Solicitar', hidden: true })).toBeInTheDocument()
  })
  it('?componente=<id> al llegar desde Pedidos: desmarca OK, Bajo y Sin stock, vacía el buscador, selecciona y desplaza hasta la fila y limpia la URL', async () => {
    filtrosStock.set({ estados: new Set<EstadoStock>(['OK', 'Bajo']), buscador: 'lcd' })
    const { router } = renderConRouter([{ path: '/stock', element: <StockPage /> }], { sesion: SESION_SUPER, ruta: '/stock?componente=2' })
    await waitFor(() => expect(router.state.location.search).toBe(''))
    expect(router.state.location.pathname).toBe('/stock')
    expect(filtrosStock.get().estados.size).toBe(0)
    expect(screen.getByPlaceholderText('Buscar componente…')).toHaveValue('')
    expect(seleccionStock.get()).toBe('2')
    await waitFor(() => expect(filaDe('bat-x')).toHaveAttribute('aria-selected', 'true'))
    // La petición de desplazamiento encontró la fila: DataTable desplaza y enfoca su contenedor (DataTable.test.tsx,
    // "cada petición de desplazamiento…"), calco de select(i) + scrollTo(i) de navegarAComponente.
    await waitFor(() => expect(screen.getByRole('table').parentElement).toHaveFocus())
    // La selección alimenta el gráfico por SKU como un clic.
    expect(await screen.findByRole('img', { name: 'Stock 2, Pedido 4' })).toBeInTheDocument()
  })
  it('?componente= conserva "Desactivado" marcado (calco) y selecciona una fila desactivada', async () => {
    filtrosStock.set({ estados: new Set<EstadoStock>(['Bajo', 'Desactivado']), buscador: 'zzz' })
    const { router } = renderConRouter([{ path: '/stock', element: <StockPage /> }], { sesion: SESION_SUPER, ruta: '/stock?componente=4' })
    await waitFor(() => expect(router.state.location.search).toBe(''))
    expect([...filtrosStock.get().estados]).toEqual(['Desactivado'])
    expect(filtrosStock.get().buscador).toBe('')
    await waitFor(() => expect(filaDe('mc-x')).toHaveAttribute('aria-selected', 'true'))
    expect(screen.queryByText('bat-x')).not.toBeInTheDocument()
  })
  it('?componente= de un componente que no está en la lista aplica los filtros y limpia la URL sin tocar la selección; un id no numérico solo limpia la URL', async () => {
    seleccionStock.set('1')
    filtrosStock.set({ estados: new Set<EstadoStock>(['OK']), buscador: 'lcd' })
    const primero = renderConRouter([{ path: '/stock', element: <StockPage /> }], { sesion: SESION_SUPER, ruta: '/stock?componente=99' })
    await waitFor(() => expect(primero.router.state.location.search).toBe(''))
    expect(filtrosStock.get().estados.size).toBe(0)
    expect(filtrosStock.get().buscador).toBe('')
    expect(seleccionStock.get()).toBe('1')
    primero.unmount()

    filtrosStock.set({ estados: new Set<EstadoStock>(['OK']), buscador: 'lcd' })
    const segundo = renderConRouter([{ path: '/stock', element: <StockPage /> }], { sesion: SESION_SUPER, ruta: '/stock?componente=abc' })
    await waitFor(() => expect(segundo.router.state.location.search).toBe(''))
    expect([...filtrosStock.get().estados]).toEqual(['OK'])
    expect(filtrosStock.get().buscador).toBe('lcd')
  })
  it('con el formulario de pedido abierto el sondeo se congela; al cerrarlo se reanuda', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    montar()
    await screen.findByText('lcd-x')
    await userEvent.pointer({ keys: '[MouseRight]', target: filaDe('lcd-x') })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Pedir' }))
    expect(formularioPedido.get()).not.toBeNull()
    // El menú ya se cerró: lo único abierto es el formulario (que en la app pinta el host del shell).
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS * 2) })
    expect(cargas.n).toBe(1)
    act(() => cerrarFormularioPedido())
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS) })
    await waitFor(() => expect(cargas.n).toBeGreaterThan(1))
  })
})
