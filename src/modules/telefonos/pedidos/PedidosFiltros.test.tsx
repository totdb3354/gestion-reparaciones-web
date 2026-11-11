import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { hoyMadrid } from '@/shared/lib/fechas'
import { estadoNsys, fila, fuente } from '../test/fabrica'
import { estadoPedidos } from './estado'
import { haceUnMes, rangoDe } from './filas'
import { PedidosPage } from './PedidosPage'

const MIXTAS = [
  fila({ idFila: 1, plataforma: 'Amazon', sku: 'i13128AzulA', pedido: '402-0000000-0000021' }),
  fila({ idFila: 2, plataforma: 'Web', sku: 'i14128NegroA', imei: '350000000000001', pedido: '402-0000000-0000022' }),
  fila({ idFila: 3, plataforma: 'Web', sku: 'i13128AzulA', estado: 'ENVIADA', imei: '350000000000002', pedido: '402-0000000-0000023' }),
  fila({ idFila: 4, plataforma: 'Web', sku: 'i14128NegroA', pedido: '402-0000000-0000024' }),
]
const CONTADOR = '4 filas · 3 pendientes · 2 sin IMEI'

let urls: URL[] = []
let respuesta: { filas: typeof MIXTAS; hayMas: boolean } = { filas: MIXTAS, hayMas: false }

beforeEach(() => {
  urls = []
  respuesta = { filas: MIXTAS, hayMas: false }
  estadoPedidos.reset()
  server.use(
    http.get('*/api/pedidos/filas', ({ request }) => { urls.push(new URL(request.url)); return HttpResponse.json(respuesta) }),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
  )
})

const abrir = () => renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
const ultima = () => urls[urls.length - 1]
const filasPintadas = () => screen.getAllByRole('row').length - 1
const buscador = () => screen.getByLabelText('Buscar en todo el historial')
const abrirFiltro = async (user: ReturnType<typeof userEvent.setup>, columna: string) =>
  user.click(await screen.findByRole('button', { name: `Filtrar ${columna}` }))

describe('Pedidos: filtro de fechas', () => {
  it('por defecto pide el último mes y, sin búsqueda, no manda buscar', async () => {
    abrir()
    await screen.findByText(CONTADOR)
    const hasta = hoyMadrid()
    expect(urls[0].searchParams.get('desde')).toBe(haceUnMes(hasta))
    expect(urls[0].searchParams.get('hasta')).toBe(hasta)
    expect(urls[0].searchParams.has('buscar')).toBe(false)
  })

  it('cambiar el periodo pide otras fechas', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByText(CONTADOR)
    await user.selectOptions(screen.getByLabelText('Periodo:'), 'Últimos 3 meses')
    await waitFor(() => expect(ultima().searchParams.get('desde')).toBe(rangoDe('tres-meses', new Date()).desde))
    await user.selectOptions(screen.getByLabelText('Periodo:'), 'Todo')
    await waitFor(() => expect(ultima().searchParams.get('desde')).toBe('2000-01-01'))
    await user.selectOptions(screen.getByLabelText('Periodo:'), 'Este año')
    await waitFor(() => expect(ultima().searchParams.get('desde')).toBe(`${hoyMadrid().slice(0, 4)}-01-01`))
  })

  it('«Rango…» enseña dos fechas; un rango al revés o incompleto conserva el anterior', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByText(CONTADOR)
    await user.selectOptions(screen.getByLabelText('Periodo:'), 'Rango…')
    fireEvent.change(screen.getByLabelText('Desde:'), { target: { value: '2026-01-10' } })
    fireEvent.change(screen.getByLabelText('Hasta:'), { target: { value: '2026-02-20' } })
    await waitFor(() => expect([ultima().searchParams.get('desde'), ultima().searchParams.get('hasta')]).toEqual(['2026-01-10', '2026-02-20']))
    const pedidas = urls.length
    fireEvent.change(screen.getByLabelText('Desde:'), { target: { value: '2026-03-01' } }) // al revés
    fireEvent.change(screen.getByLabelText('Desde:'), { target: { value: '' } }) // incompleto
    expect(urls).toHaveLength(pedidas)
    expect([ultima().searchParams.get('desde'), ultima().searchParams.get('hasta')]).toEqual(['2026-01-10', '2026-02-20'])
  })
})

describe('Pedidos: rango de fechas', () => {
  const mes = () => ({ desde: haceUnMes(hoyMadrid()), hasta: hoyMadrid() })
  const pedidas = () => ({ desde: ultima().searchParams.get('desde'), hasta: ultima().searchParams.get('hasta') })

  it('la primera vez que se elige «Rango…» salen y se piden las fechas del periodo aplicado', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByText(CONTADOR)
    await user.selectOptions(screen.getByLabelText('Periodo:'), 'Rango…')
    expect(screen.getByLabelText('Desde:')).toHaveValue(mes().desde)
    expect(screen.getByLabelText('Hasta:')).toHaveValue(mes().hasta)
    expect(pedidas()).toEqual(mes())
  })

  it('rango propio, «Último mes» y «Rango…» otra vez: sale y se pide el rango guardado', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByText(CONTADOR)
    await user.selectOptions(screen.getByLabelText('Periodo:'), 'Rango…')
    fireEvent.change(screen.getByLabelText('Desde:'), { target: { value: '2026-01-10' } })
    fireEvent.change(screen.getByLabelText('Hasta:'), { target: { value: '2026-02-20' } })
    await waitFor(() => expect(pedidas()).toEqual({ desde: '2026-01-10', hasta: '2026-02-20' }))
    await user.selectOptions(screen.getByLabelText('Periodo:'), 'Último mes')
    await waitFor(() => expect(pedidas()).toEqual(mes()))
    await user.selectOptions(screen.getByLabelText('Periodo:'), 'Rango…')
    expect(screen.getByLabelText('Desde:')).toHaveValue('2026-01-10')
    expect(screen.getByLabelText('Hasta:')).toHaveValue('2026-02-20')
    await waitFor(() => expect(pedidas()).toEqual({ desde: '2026-01-10', hasta: '2026-02-20' }))
  })

  it('un rango guardado con fechas vacías pide el último mes', async () => {
    estadoPedidos.set((s) => ({ ...s, periodo: 'rango', rango: { desde: '', hasta: '' } }))
    abrir()
    await screen.findByText(CONTADOR)
    expect(pedidas()).toEqual(mes())
  })
})

describe('Pedidos: buscador', () => {
  it('mientras llega la búsqueda se ven las filas de antes y un «Buscando…»', async () => {
    let soltar: () => void = () => {}
    const espera = new Promise<void>((r) => { soltar = r })
    server.use(http.get('*/api/pedidos/filas', async ({ request }) => {
      if (new URL(request.url).searchParams.has('buscar')) await espera
      return HttpResponse.json(respuesta)
    }))
    abrir()
    await screen.findByText(CONTADOR)
    expect(screen.queryByText('Buscando…')).not.toBeInTheDocument()
    fireEvent.change(buscador(), { target: { value: '35' } })
    expect(await screen.findByText('Buscando…')).toBeInTheDocument()
    expect(filasPintadas()).toBe(4)
    soltar()
    await waitFor(() => expect(screen.queryByText('Buscando…')).not.toBeInTheDocument())
  })

  it('tras 300 ms pide con buscar y atenúa el periodo; vaciarlo vuelve al periodo', async () => {
    abrir()
    await screen.findByText(CONTADOR)
    fireEvent.change(buscador(), { target: { value: '35' } })
    expect(urls.some((u) => u.searchParams.has('buscar'))).toBe(false) // aún no ha pasado la espera
    await waitFor(() => expect(ultima().searchParams.get('buscar')).toBe('35'))
    expect(await screen.findByText(/La búsqueda mira en todo el historial/)).toBeInTheDocument()
    expect(screen.getByLabelText('Periodo:').parentElement).toHaveAttribute('data-atenuado', 'true')
    fireEvent.change(buscador(), { target: { value: '' } })
    await waitFor(() => expect(ultima().searchParams.has('buscar')).toBe(false))
    expect(screen.queryByText(/La búsqueda mira en todo el historial/)).not.toBeInTheDocument()
  })

  it('con menos de 2 caracteres no hay búsqueda aunque pase la espera', async () => {
    abrir()
    await screen.findByText(CONTADOR)
    const pedidas = urls.length
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      fireEvent.change(buscador(), { target: { value: '3' } })
      await act(async () => { vi.advanceTimersByTime(1000) })
    } finally { vi.useRealTimers() }
    expect(urls).toHaveLength(pedidas)
    expect(screen.queryByText(/La búsqueda mira en todo el historial/)).not.toBeInTheDocument()
  })

  it('con «hay más» enseña el aviso de los 500 y lo quita en cuanto se borra la búsqueda', async () => {
    respuesta = { filas: MIXTAS, hayMas: true }
    abrir()
    await screen.findByText(CONTADOR)
    expect(screen.queryByText(/Hay más de 500/)).not.toBeInTheDocument() // sin búsqueda no hay aviso
    fireEvent.change(buscador(), { target: { value: '35' } })
    expect(await screen.findByText('Hay más de 500 resultados: se enseñan los 500 más recientes. Afina la búsqueda.')).toBeInTheDocument()
    fireEvent.change(buscador(), { target: { value: '' } })
    expect(screen.queryByText(/Hay más de 500/)).not.toBeInTheDocument()
  })

  it('con una búsqueda en marcha, cambiar el periodo no pide otra vez', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByText(CONTADOR)
    fireEvent.change(buscador(), { target: { value: '35' } })
    await waitFor(() => expect(ultima().searchParams.get('buscar')).toBe('35'))
    const pedidas = urls.length
    await user.selectOptions(screen.getByLabelText('Periodo:'), 'Últimos 3 meses')
    await user.selectOptions(screen.getByLabelText('Periodo:'), 'Todo')
    expect(urls).toHaveLength(pedidas)
  })
})

describe('Pedidos: filtros por columna', () => {
  it('el de plataforma esconde filas sin pedir nada, marca la cabecera y añade «a la vista»', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByText(CONTADOR)
    const pedidas = urls.length
    await abrirFiltro(user, 'Plataforma')
    expect(screen.getByRole('checkbox', { name: 'Todos' })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Amazon' }))
    expect(filasPintadas()).toBe(1)
    expect(screen.getByText(`${CONTADOR} · 1 a la vista`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filtrar Plataforma (filtro activo)' })).toBeInTheDocument()
    expect(urls).toHaveLength(pedidas)
    await user.click(screen.getByRole('checkbox', { name: 'Web' }))
    expect(filasPintadas()).toBe(4)
  })

  it('el de SKU y el de plataforma se combinan', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByText(CONTADOR)
    await abrirFiltro(user, 'Plataforma')
    await user.click(screen.getByRole('checkbox', { name: 'Web' }))
    await user.keyboard('{Escape}')
    await abrirFiltro(user, 'SKU')
    await user.click(screen.getByRole('checkbox', { name: 'i14128NegroA' }))
    expect(filasPintadas()).toBe(2)
    expect(screen.getByText(/· 2 a la vista/)).toBeInTheDocument()
  })

  it('con muchos valores lleva una caja para acortar la lista', async () => {
    const user = userEvent.setup()
    respuesta = { filas: Array.from({ length: 12 }, (_, i) => fila({ idFila: i + 1, sku: `sku${String(i).padStart(2, '0')}`, pedido: `402-0000000-00001${i}` })), hayMas: false }
    abrir()
    await abrirFiltro(user, 'SKU')
    await user.type(await screen.findByRole('textbox', { name: 'Buscar en SKU' }), 'sku1')
    expect(screen.getAllByRole('checkbox')).toHaveLength(3) // «Todos», sku10 y sku11
    expect(screen.queryByRole('checkbox', { name: 'sku05' })).not.toBeInTheDocument()
  })

  it('si los filtros no dejan ninguna fila, la cabecera sigue y un solo filtro se ajusta ahí', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByText(CONTADOR)
    await abrirFiltro(user, 'Plataforma')
    await user.click(screen.getByRole('checkbox', { name: 'Amazon' }))
    await user.keyboard('{Escape}')
    await abrirFiltro(user, 'SKU')
    await user.click(screen.getByRole('checkbox', { name: 'i14128NegroA' }))
    await user.keyboard('{Escape}')
    expect(await screen.findByText(/Ningún pedido cumple los filtros de columna/)).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(7)
    await abrirFiltro(user, 'Plataforma (filtro activo)')
    await user.click(screen.getByRole('checkbox', { name: 'Amazon' }))
    expect(screen.queryByText(/Ningún pedido cumple los filtros de columna/)).not.toBeInTheDocument()
    expect(filasPintadas()).toBe(2)
  })

  it('«Solo sin IMEI» deja las filas editables sin IMEI, las enviadas también', async () => {
    const user = userEvent.setup()
    respuesta = { filas: [...MIXTAS, fila({ idFila: 5, estado: 'ENVIADA', pedido: '402-0000000-0000025' }), fila({ idFila: 6, estado: 'HISTORICO', editable: false, pedido: '402-0000000-0000026' })], hayMas: false }
    abrir()
    await screen.findByText('6 filas · 3 pendientes · 3 sin IMEI')
    await abrirFiltro(user, 'IMEI')
    await user.click(screen.getByRole('checkbox', { name: 'Solo sin IMEI' }))
    expect(filasPintadas()).toBe(3)
    expect(screen.getByText(/· 3 a la vista/)).toBeInTheDocument()
  })

  it('el filtro de «Enviado» tiene Pendientes, Enviados y Ya no pendientes, y se recuerda', async () => {
    const user = userEvent.setup()
    respuesta = { filas: [...MIXTAS, fila({ idFila: 5, estado: 'NO_PENDIENTE', pedido: '402-0000000-0000025' }), fila({ idFila: 6, estado: 'HISTORICO', editable: false, pedido: '402-0000000-0000026' })], hayMas: false }
    const primera = abrir()
    await screen.findByText('6 filas · 3 pendientes · 3 sin IMEI')
    await abrirFiltro(user, 'Enviado')
    await user.click(screen.getByRole('checkbox', { name: 'Enviados' }))
    expect(filasPintadas()).toBe(2)
    await user.click(screen.getByRole('checkbox', { name: 'Ya no pendientes' }))
    expect(filasPintadas()).toBe(3)
    await user.click(screen.getByRole('checkbox', { name: 'Enviados' }))
    expect(filasPintadas()).toBe(1)
    await user.click(screen.getByRole('checkbox', { name: 'Pendientes' }))
    expect(filasPintadas()).toBe(4)
    await user.keyboard('{Escape}')
    primera.unmount()
    abrir()
    expect(await screen.findByText('6 filas · 3 pendientes · 3 sin IMEI · 4 a la vista')).toBeInTheDocument()
  })

  it('«Quitar filtros» los quita todos y desaparece', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByText(CONTADOR)
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).not.toBeInTheDocument()
    await abrirFiltro(user, 'IMEI')
    await user.click(screen.getByRole('checkbox', { name: 'Solo sin IMEI' }))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    expect(filasPintadas()).toBe(4)
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).not.toBeInTheDocument()
    expect(screen.queryByText(/a la vista/)).not.toBeInTheDocument()
  })
})

describe('Pedidos: estados vacíos y estado de la página', () => {
  it('un filtro que no deja ninguna fila lo dice y ofrece quitarlo', async () => {
    const user = userEvent.setup()
    respuesta = { filas: [MIXTAS[2]], hayMas: false }
    abrir()
    await screen.findByText('1 filas · 0 pendientes · 0 sin IMEI')
    await abrirFiltro(user, 'IMEI')
    await user.click(screen.getByRole('checkbox', { name: 'Solo sin IMEI' }))
    expect(await screen.findByText(/Ningún pedido cumple los filtros de columna/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    expect(filasPintadas()).toBe(1)
    expect(screen.queryByText(/Ningún pedido cumple/)).not.toBeInTheDocument()
  })

  it('sin filas en el periodo y sin resultados de la búsqueda: cada uno con su texto', async () => {
    respuesta = { filas: [], hayMas: false }
    abrir()
    expect(await screen.findByText('No hay pedidos en este periodo.')).toBeInTheDocument()
    fireEvent.change(buscador(), { target: { value: 'zz' } })
    expect(await screen.findByText('Ningún pedido coincide con la búsqueda.')).toBeInTheDocument()
  })

  it('al salir y volver siguen el periodo, la búsqueda y los filtros', async () => {
    const user = userEvent.setup()
    const primera = abrir()
    await screen.findByText(CONTADOR)
    await user.selectOptions(screen.getByLabelText('Periodo:'), 'Este año')
    fireEvent.change(buscador(), { target: { value: '3500' } })
    await waitFor(() => expect(ultima().searchParams.get('buscar')).toBe('3500'))
    await abrirFiltro(user, 'Plataforma')
    await user.click(screen.getByRole('checkbox', { name: 'Amazon' }))
    await user.keyboard('{Escape}')
    primera.unmount()
    abrir()
    expect(await screen.findByLabelText('Periodo:')).toHaveValue('anio')
    expect(buscador()).toHaveValue('3500')
    expect(await screen.findByText(`${CONTADOR} · 1 a la vista`)).toBeInTheDocument()
    expect(ultima().searchParams.get('buscar')).toBe('3500')
  })
})
