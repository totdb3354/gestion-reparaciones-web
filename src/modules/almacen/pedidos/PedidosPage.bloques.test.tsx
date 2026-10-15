import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompraComponente, CompraOtro, Proveedor } from '@/shared/api/client'
import { INTERVALO_CONECTADO_MS } from '@/shared/api/refresco'
import * as csv from '@/shared/lib/csv'
import { cerrarFormularioPedido, formularioPedido } from '@/shared/lib/formularioPedido'
import type { Sesion } from '@/shared/session/storage'
import { renderConRouter, SESION_ADMIN, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { lineaDePrueba as l, otroDePrueba as o } from './bloques/datosPrueba'
import { CABECERAS_CSV_PEDIDOS } from './columnas'
import { FILTROS_PEDIDOS_VACIOS, filtrosDesdeStock, firmaFiltros } from './filtros'
import { filtrosPedidos, plegadoBloques } from './estado'
import { PedidosPage } from './PedidosPage'

const U = '2026-10-09T10:00:00'
const B41 = { idBloque: 41, fechaBloque: '2026-10-09T10:00:00' }
const B40 = { idBloque: 40, fechaBloque: '2026-10-08T10:00:00' }
const B39 = { idBloque: 39, fechaBloque: '2026-10-07T10:00:00' }
/** 41 en curso (pendiente + en camino), 40 abierto, 39 terminado. */
const compras: CompraComponente[] = [
  l({ idCompra: 1, ...B41, tipoComponente: 'lcd-x-negro' }),
  l({ idCompra: 2, ...B41, tipoComponente: 'bat-x', estado: 'en_camino' }),
  l({ idCompra: 3, ...B40, tipoComponente: 'mc-x' }),
  l({ idCompra: 4, ...B39, tipoComponente: 'lcd-y', estado: 'recibido', cantidadRecibida: 2 }),
]
const proveedores: Proveedor[] = [{ idProv: 1, nombre: 'Proveedor A', activo: true, divisa: 'EUR', comentario: '', tipo: 'COMPONENTES' }]
let escrituras: string[]
let cargasCompras = 0
let otros: CompraOtro[]

beforeEach(() => {
  escrituras = []
  cargasCompras = 0
  otros = []
  localStorage.removeItem('pedidos.agruparPorBloque')
  server.use(
    http.get('*/api/compras', () => { cargasCompras += 1; return HttpResponse.json(compras) }),
    http.get('*/api/proveedores', () => HttpResponse.json(proveedores)),
    http.get('*/api/compras-otros', () => HttpResponse.json(otros)),
    http.patch('*/api/compras-otros/:id/bloque', async ({ params, request }) => {
      escrituras.push(`PATCH otro ${String(params.id)} ${JSON.stringify(await request.json())}`)
      return new HttpResponse(null, { status: 200 })
    }),
    http.patch('*/api/compras/:id/bloque', async ({ params, request }) => {
      escrituras.push(`PATCH ${String(params.id)} ${JSON.stringify(await request.json())}`)
      return new HttpResponse(null, { status: 200 })
    }),
    http.post('*/api/bloques-compra/:id/:accion', async ({ params, request }) => {
      escrituras.push(`POST ${String(params.id)} ${String(params.accion)} ${JSON.stringify(await request.json())}`)
      return new HttpResponse(null, { status: 200 })
    }),
  )
})
afterEach(() => {
  vi.useRealTimers()
  localStorage.removeItem('pedidos.agruparPorBloque')
})

function montar(sesion: Sesion = SESION_SUPER, ruta = '/stock/pedidos') {
  return renderConRouter([{ path: '/stock/pedidos', element: <PedidosPage /> }], { sesion, ruta })
}
const filas = () => screen.getAllByRole('row').slice(1).map((r) => r.textContent ?? '')
const abrirMenu = (texto: string) => userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText(texto).closest('tr') as HTMLElement })

describe('Pedidos agrupados por bloques (0.9.9)', () => {
  it('por defecto agrupa: del más reciente al más antiguo, vivos desplegados y terminados plegados, sin columna Proveedor', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    const t = filas()
    expect(t).toHaveLength(6)
    expect(t[0]).toContain('Bloque 41')
    expect(t[1]).toContain('lcd-x-negro')
    expect(t[2]).toContain('bat-x')
    expect(t[3]).toContain('Bloque 40')
    expect(t[4]).toContain('mc-x')
    expect(t[5]).toContain('Bloque 39')
    expect(screen.queryByRole('columnheader', { name: 'Proveedor' })).not.toBeInTheDocument()
  })

  it('el interruptor vuelve a la vista plana con la columna Bloque y el navegador lo recuerda', async () => {
    const { unmount } = montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.click(screen.getByRole('switch', { name: 'Agrupar por bloque' }))
    expect(screen.getByRole('columnheader', { name: 'Bloque' })).toBeInTheDocument()
    expect(screen.getByText('lcd-y')).toBeInTheDocument()
    expect(localStorage.getItem('pedidos.agruparPorBloque')).toBe('no')
    unmount()
    montar()
    await screen.findByText('lcd-x-negro')
    expect(screen.getByRole('switch', { name: 'Agrupar por bloque' })).toHaveAttribute('aria-checked', 'false')
  })

  it('plegar un bloque, «Plegar todo» y «Desplegar todo»', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.click(screen.getByRole('button', { name: 'Plegar bloque 41' }))
    expect(screen.queryByText('lcd-x-negro')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Plegar todo' }))
    expect(screen.queryByText('mc-x')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Desplegar todo' }))
    expect(screen.getByText('lcd-y')).toBeInTheDocument()
  })

  it('con el buscador: solo las líneas que cumplen, desplegadas y con «mostrando k de n»', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.type(screen.getByPlaceholderText('Buscar componente o nº de bloque…'), 'lcd')
    expect(screen.getByText('mostrando 1 de 2')).toBeInTheDocument()
    expect(screen.getByText('lcd-y')).toBeInTheDocument()
    expect(screen.queryByText('bat-x')).not.toBeInTheDocument()
    expect(screen.queryByText('mc-x')).not.toBeInTheDocument()
  })

  it('con solo cifras en el buscador: una sola cabecera, la del bloque con ese número', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.type(screen.getByPlaceholderText('Buscar componente o nº de bloque…'), '41')
    await waitFor(() => expect(document.querySelectorAll('tr[data-cabecera]')).toHaveLength(1))
    expect(document.querySelector('tr[data-cabecera]')).toHaveTextContent('41')
  })

  it('mover una pendiente va sin preguntar; una en camino pide confirmación', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    await abrirMenu('lcd-x-negro')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover a bloque' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Bloque 40/ }))
    await waitFor(() => expect(escrituras).toEqual([`PATCH 1 {"idBloque":40,"updatedAt":"${U}"}`]))
    await abrirMenu('bat-x')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover a bloque' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Bloque nuevo/ }))
    const dlg = await screen.findByRole('dialog', { name: 'Mover línea ya pedida' })
    expect(dlg).toHaveTextContent('La línea bat-x (ID 2) está en camino. ¿Moverla a un bloque nuevo igualmente?')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Mover' }))
    await waitFor(() => expect(escrituras[1]).toBe(`PATCH 2 {"idBloque":null,"updatedAt":"${U}"}`))
  })

  it('⋮ del bloque → «Recibir todo» confirma y manda las en camino', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.click(screen.getByRole('button', { name: 'Acciones del bloque 41' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Recibir todo (1)' }))
    const dlg = await screen.findByRole('dialog', { name: 'Recibir todo · Bloque 41' })
    await userEvent.click(within(dlg).getByRole('button', { name: 'Recibir (1)' }))
    await waitFor(() => expect(escrituras).toEqual([`POST 41 recibir {"lineas":[{"idCompra":2,"updatedAt":"${U}","tipo":"PIEZA"}]}`]))
  })

  it('⋮ del bloque → «Exportar bloque en CSV» descarga todas sus líneas aunque un filtro oculte alguna (0.9.13)', async () => {
    const descargar = vi.spyOn(csv, 'descargarCsv').mockResolvedValue(undefined)
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.type(screen.getByPlaceholderText('Buscar componente o nº de bloque…'), 'bat')
    await waitFor(() => expect(screen.queryByText('lcd-x-negro')).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Acciones del bloque 41' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Exportar bloque en CSV' }))
    expect(descargar).toHaveBeenCalledTimes(1)
    const [nombre, cabeceras, filasCsv] = descargar.mock.calls[0]
    expect(nombre).toBe('pedidos_bloque_41')
    expect(cabeceras).toEqual(CABECERAS_CSV_PEDIDOS)
    expect(filasCsv.map((f) => f[0])).toEqual(['1', '2'])
    expect(escrituras).toEqual([])
    descargar.mockRestore()
  })

  it('⋮ del bloque → «Juntar con…» ofrece el bloque abierto y no el terminado', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.click(screen.getByRole('button', { name: 'Acciones del bloque 41' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /Juntar con/ }))
    const dlg = await screen.findByRole('dialog', { name: 'Juntar Bloque 41 con…' })
    expect(within(dlg).getByRole('radio', { name: /Bloque 40/ })).toBeInTheDocument()
    expect(within(dlg).queryByRole('radio', { name: /Bloque 39/ })).not.toBeInTheDocument()
  })

  it('⋮ del bloque → «Añadir previsión…» abre el formulario en modo bloque con la previsión', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.click(screen.getByRole('button', { name: 'Acciones del bloque 41' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Añadir previsión…' }))
    expect(formularioPedido.get()).toEqual({ tipo: 'compra', precarga: { modo: 'bloque', idBloque: 41, idProv: 1, prevision: true } })
    cerrarFormularioPedido()
  })

  it('el administrador ve el ⋮ del bloque solo con «Exportar bloque en CSV» (0.9.13)', async () => {
    montar(SESION_ADMIN)
    await screen.findByText('lcd-x-negro')
    expect(screen.getByText('Bloque 41')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Acciones del bloque 41' }))
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Exportar bloque en CSV'])
  })

  it('con el ⋮ de un bloque abierto el sondeo se congela y vuelve al cerrarlo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.click(screen.getByRole('button', { name: 'Acciones del bloque 41' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS * 2) })
    expect(cargasCompras).toBe(1)
    await userEvent.keyboard('{Escape}')
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS) })
    await waitFor(() => expect(cargasCompras).toBeGreaterThan(1))
  })

  it('con un diálogo de bloque abierto («Añadir nota…») el sondeo se congela y vuelve al cerrarlo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.click(screen.getByRole('button', { name: 'Acciones del bloque 41' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Añadir nota…' }))
    const dlg = await screen.findByRole('dialog')
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS * 2) })
    expect(cargasCompras).toBe(1)
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS) })
    await waitFor(() => expect(cargasCompras).toBeGreaterThan(1))
  })

  it('llegada desde Stock con el bloque de la línea plegado: lo despliega y deja la fila seleccionada', async () => {
    const ruta = '/stock/pedidos?buscar=lcd-y'
    const llegada = filtrosDesdeStock(new URLSearchParams('buscar=lcd-y'))
    const firma = firmaFiltros({ ...FILTROS_PEDIDOS_VACIOS, ...filtrosPedidos.get(), ...llegada })
    plegadoBloques.set((p) => ({ ...p, filtrado: { firma, mapa: { '39': false } } }))
    montar(SESION_SUPER, ruta)
    await waitFor(() => expect(document.querySelector('tr[aria-selected="true"]')).toHaveTextContent('lcd-y'))
    expect(screen.getByText('Bloque 39')).toBeInTheDocument()
  })

  it('mover a un bloque que ya no existe: el aviso lleva el texto del servidor, no el genérico', async () => {
    server.use(http.patch('*/api/compras/:id/bloque', () => HttpResponse.json({ message: 'El bloque 40 ya no existe; elige otro destino.' }, { status: 409 })))
    montar()
    await screen.findByText('lcd-x-negro')
    await abrirMenu('lcd-x-negro')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover a bloque' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Bloque 40/ }))
    const aviso = await screen.findByRole('dialog')
    expect(aviso).toHaveTextContent('El bloque 40 ya no existe; elige otro destino.')
    expect(aviso).not.toHaveTextContent('Este pedido fue modificado')
  })


  it('una recibida no ofrece «Mover a bloque» y una viva solo ve destinos vivos (el 39, terminado, no)', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    // El 39 está terminado y sale plegado: se despliega desde su cabecera.
    await userEvent.click(screen.getByText('Bloque 39').closest('button') as HTMLElement)
    await abrirMenu('lcd-y')
    expect(await screen.findByRole('menuitem', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Mover a bloque' })).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await abrirMenu('lcd-x-negro')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover a bloque' }))
    expect(await screen.findByRole('menuitem', { name: /Bloque 40/ })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Bloque 39/ })).not.toBeInTheDocument()
  })
})

describe('otros dentro de los bloques (0.9.15)', () => {
  /** Otro 88 en el bloque 41 (Proveedor A), pendiente, a la misma hora que sus piezas. */
  const otro41 = () => o({ idCompraOtro: 88, ...B41, concepto: 'Cinta de embalar' })

  it('un otro sale en el bloque de su proveedor, tras las piezas, con su píldora y «O-{id}»; la cabecera cuenta los otros', async () => {
    otros = [otro41()]
    montar()
    const fila = (await screen.findByText('Cinta de embalar')).closest('tr') as HTMLElement
    expect(within(fila).getByText('otro')).toBeInTheDocument()
    expect(fila.querySelector('[data-columna="id"]')).toHaveTextContent('O-88')
    expect(screen.queryByRole('button', { name: 'Cinta de embalar' })).not.toBeInTheDocument()
    const t = filas()
    expect(t[0]).toContain('Bloque 41')
    expect(t[0]).toContain('3 líneas (1 otro)')
    expect(t[3]).toContain('Cinta de embalar')
  })

  it('filtro «Tipo: Otros»: solo el otro, su bloque desplegado con «mostrando 1 de 3»; «Limpiar filtros» vuelve a «Todos»', async () => {
    otros = [otro41()]
    montar()
    await screen.findByText('Cinta de embalar')
    await userEvent.click(screen.getByRole('radio', { name: 'Otros' }))
    expect(screen.getByText('mostrando 1 de 3')).toBeInTheDocument()
    expect(screen.queryByText('lcd-x-negro')).not.toBeInTheDocument()
    expect(screen.queryByText('Bloque 40')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByRole('radio', { name: 'Todos' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('lcd-x-negro')).toBeInTheDocument()
  })

  it('menú de fila de un otro: sus transiciones y «Mover a bloque», que manda PATCH /api/compras-otros/{id}/bloque', async () => {
    otros = [otro41()]
    montar()
    await screen.findByText('Cinta de embalar')
    await abrirMenu('Cinta de embalar')
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Confirmar pedido', 'Editar', 'Borrar', 'Mover a bloque'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover a bloque' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Bloque 40/ }))
    await waitFor(() => expect(escrituras).toEqual([`PATCH otro 88 {"idBloque":40,"updatedAt":"${U}"}`]))
  })

  it('⋮ del bloque → «Añadir otro…», justo tras «Añadir líneas…», abre «Nuevo pedido» del bloque con una línea de otro', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.click(screen.getByRole('button', { name: 'Acciones del bloque 41' }))
    const textos = screen.getAllByRole('menuitem').map((m) => m.textContent)
    expect(textos[textos.indexOf('Añadir líneas…') + 1]).toBe('Añadir otro…')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Añadir otro…' }))
    expect(formularioPedido.get()).toEqual({ tipo: 'compra', precarga: { modo: 'bloque', idBloque: 41, idProv: 1, otro: true } })
    cerrarFormularioPedido()
  })

  it('en un bloque terminado, «Añadir otro…» va deshabilitado con su motivo', async () => {
    montar()
    await screen.findByText('lcd-x-negro')
    await userEvent.click(screen.getByRole('button', { name: 'Acciones del bloque 39' }))
    const entrada = screen.getByRole('menuitem', { name: /Añadir otro…/ })
    expect(entrada).toHaveAttribute('aria-disabled', 'true')
    expect(entrada).toHaveTextContent('el bloque está terminado')
  })
})
