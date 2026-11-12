import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { maquetarJsdom } from '@/test/layoutJsdom'
import { candidato, estadoNsys, fila, fuente } from '../test/fabrica'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'

// Pantalla v2 (parte 1): contadores pulsables, filtros como etiquetas, la caja delante y la raya azul.
// 6 filas: pendientes 4 (1, 2, 4, 5), sin IMEI 2 (1, 4), no cuadran 1 (5), enviada 1 (3) e histórico 1 (6).
const FILAS = [
  fila({ idFila: 1, plataforma: 'Amazon', canal: 'AMAZON', sku: 'i13128AzulA', pedido: '402-0000000-0000021' }),
  fila({ idFila: 2, plataforma: 'Web', sku: 'i14128NegroA', imei: '350000000000001', pedido: '402-0000000-0000022' }),
  fila({ idFila: 3, plataforma: 'Web', sku: 'i13128AzulA', estado: 'ENVIADA', impresaEn: '2026-11-10T09:00:00', tieneEtiqueta: true, imei: '350000000000002', pedido: '402-0000000-0000023' }),
  fila({ idFila: 4, plataforma: 'Web', sku: 'i14128NegroA', pedido: '402-0000000-0000024' }),
  fila({ idFila: 5, plataforma: 'Web', imei: '350000000000003', nivel: 'MAL', motivo: 'MODELO', pedido: '402-0000000-0000025' }),
  fila({ idFila: 6, estado: 'HISTORICO', editable: false, imei: '350000000000004', pedido: '402-0000000-0000026' }),
]

let respuesta = FILAS

afterEach(() => { vi.restoreAllMocks() })

beforeEach(() => {
  respuesta = FILAS
  estadoPedidos.reset()
  maquetarJsdom()
  server.use(
    http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: respuesta, hayMas: false })),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    http.get('*/api/pedidos/filas/:id/recomendados', () => HttpResponse.json([candidato({ imei: '350000000000101', caja: 'CAJA LISTOS', nivel: 1 })])),
  )
})

const abrir = () => renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
const filasPintadas = () => screen.getAllByRole('row').length - 1
const buscador = () => screen.getByLabelText('Buscar en todo el historial')
const contador = (nombre: string) => screen.findByRole('button', { name: nombre })
const pulsado = (nombre: string) => screen.getByRole('button', { name: nombre }).getAttribute('aria-pressed')
const abrirFiltro = async (user: ReturnType<typeof userEvent.setup>, columna: string) =>
  user.click(await screen.findByRole('button', { name: `Filtrar ${columna}` }))
const tr = (pedido: string) => screen.getByText(pedido).closest('tr')!

describe('Pedidos v2: contadores pulsables', () => {
  it('cada contador deja justo las filas que dice y se ve marcado; «filas» los quita', async () => {
    const user = userEvent.setup()
    abrir()
    await contador('6 filas')
    expect(pulsado('6 filas')).toBe('true')
    for (const [nombre, n] of [['4 pendientes', 4], ['2 sin IMEI', 2], ['1 no cuadran', 1]] as const) {
      await user.click(screen.getByRole('button', { name: nombre }))
      expect(filasPintadas()).toBe(n)
      expect(pulsado(nombre)).toBe('true')
      expect(pulsado('6 filas')).toBe('false')
    }
    await user.click(screen.getByRole('button', { name: '6 filas' }))
    expect(filasPintadas()).toBe(6)
  })

  it('«sin IMEI» incluye las enviadas sin IMEI; «no cuadran» es el nivel MAL', async () => {
    const user = userEvent.setup()
    respuesta = [...FILAS, fila({ idFila: 7, estado: 'ENVIADA', pedido: '402-0000000-0000027' })]
    abrir()
    await user.click(await contador('3 sin IMEI'))
    expect(filasPintadas()).toBe(3)
    expect(tr('402-0000000-0000027')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '1 no cuadran' }))
    expect(tr('402-0000000-0000025')).toBeInTheDocument()
  })

  it('pulsar uno sustituye los filtros de columna y no toca el buscador ni el periodo', async () => {
    const user = userEvent.setup()
    abrir()
    await contador('6 filas')
    await user.selectOptions(screen.getByLabelText('Periodo:'), 'Este año')
    fireEvent.change(buscador(), { target: { value: 'a' } }) // con un solo carácter no es búsqueda
    await abrirFiltro(user, 'Plataforma')
    await user.click(screen.getByRole('checkbox', { name: /^Fonestore/ }))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Quitar filtro Plataforma: Fonestore' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '1 no cuadran' }))
    expect(screen.queryByRole('button', { name: 'Quitar filtro Plataforma: Fonestore' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar filtro No cuadran' })).toBeInTheDocument()
    expect(buscador()).toHaveValue('a')
    expect(screen.getByLabelText('Periodo:')).toHaveValue('anio')
  })

  it('con varios filtros a la vez no hay ningún contador marcado', async () => {
    const user = userEvent.setup()
    abrir()
    await contador('6 filas')
    await abrirFiltro(user, 'IMEI')
    await user.click(screen.getByRole('checkbox', { name: 'Solo sin IMEI' }))
    await user.click(screen.getByRole('checkbox', { name: 'No cuadran' }))
    for (const n of ['6 filas', '4 pendientes', '2 sin IMEI', '1 no cuadran']) expect(pulsado(n)).toBe('false')
  })
})

describe('Pedidos v2: filtros como etiquetas', () => {
  it('cada filtro puesto es una etiqueta en la caja del buscador y su ✕ quita solo ese', async () => {
    const user = userEvent.setup()
    abrir()
    await contador('6 filas')
    await abrirFiltro(user, 'Plataforma')
    await user.click(screen.getByRole('checkbox', { name: /^Fonestore/ }))
    await user.keyboard('{Escape}')
    await abrirFiltro(user, 'IMEI')
    await user.click(screen.getByRole('checkbox', { name: 'Solo sin IMEI' }))
    await user.click(screen.getByRole('checkbox', { name: 'No cuadran' }))
    await user.keyboard('{Escape}')
    await abrirFiltro(user, 'Enviado')
    await user.click(screen.getByRole('checkbox', { name: /^Pendientes/ }))
    await user.keyboard('{Escape}')
    const caja = buscador().parentElement!
    for (const t of ['Plataforma: Fonestore', 'Sin IMEI', 'No cuadran', 'Pendientes']) expect(caja).toHaveTextContent(t)
    await user.click(screen.getByRole('button', { name: 'Quitar filtro Sin IMEI' }))
    expect(screen.queryByRole('button', { name: 'Quitar filtro Sin IMEI' })).not.toBeInTheDocument()
    for (const t of ['Plataforma: Fonestore', 'No cuadran', 'Pendientes']) expect(screen.getByRole('button', { name: `Quitar filtro ${t}` })).toBeInTheDocument()
    expect(filasPintadas()).toBe(1) // Web + no cuadran + pendientes: solo la 5
    await user.click(screen.getByRole('button', { name: 'Quitar filtro No cuadran' }))
    expect(filasPintadas()).toBe(3) // Web pendientes: 2, 4 y 5
    await user.click(screen.getByRole('button', { name: 'Quitar filtro Pendientes' }))
    await user.click(screen.getByRole('button', { name: 'Quitar filtro Plataforma: Fonestore' }))
    expect(filasPintadas()).toBe(6)
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).not.toBeInTheDocument()
  })

  it('«Quitar filtros» quita todas las etiquetas y vacía el buscador', async () => {
    const user = userEvent.setup()
    abrir()
    await contador('6 filas')
    fireEvent.change(buscador(), { target: { value: 'a' } })
    await user.click(screen.getByRole('button', { name: '2 sin IMEI' }))
    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    expect(buscador()).toHaveValue('')
    expect(filasPintadas()).toBe(6)
    expect(screen.queryByRole('button', { name: /Quitar filtro / })).not.toBeInTheDocument()
  })

  it('el filtro de «Enviado» tiene cinco casillas con su recuento y el histórico no cuenta como enviado', async () => {
    const user = userEvent.setup()
    abrir()
    await contador('6 filas')
    await abrirFiltro(user, 'Enviado')
    expect(screen.getAllByRole('checkbox').map((c) => c.closest('label')!.textContent)).toEqual(['Pendientes4', 'Etiqueta generada0', 'Enviados1', 'Ya no pendientes0', 'Histórico de la hoja1'])
    await user.click(screen.getByRole('checkbox', { name: /^Enviados/ }))
    expect(filasPintadas()).toBe(1)
    await user.click(screen.getByRole('checkbox', { name: /^Histórico de la hoja/ }))
    expect(filasPintadas()).toBe(2)
  })

  it('la casilla «No cuadran» del filtro de IMEI deja las del IMEI en naranja y marca el contador', async () => {
    const user = userEvent.setup()
    abrir()
    await contador('6 filas')
    await abrirFiltro(user, 'IMEI')
    await user.click(screen.getByRole('checkbox', { name: 'No cuadran' }))
    expect(filasPintadas()).toBe(1)
    expect(pulsado('1 no cuadran')).toBe('true')
  })
})

describe('Pedidos v2: el estado como etiqueta y el histórico', () => {
  it('la fila enviada va en texto normal con su etiqueta; la del histórico, en gris, sin edición y con «De la hoja»', async () => {
    const user = userEvent.setup()
    abrir()
    await contador('6 filas')
    const enviada = tr('402-0000000-0000023')
    expect(enviada).toHaveTextContent('Enviado 10/11')
    expect(enviada.querySelector('td')!.className).not.toMatch(/bg-|text-\[#8b93a1\]/)
    const historica = tr('402-0000000-0000026')
    expect(historica).toHaveTextContent('De la hoja')
    expect(historica.querySelector('td')).toHaveClass('bg-[#fafbfc]')
    await user.click(screen.getByText('350000000000004'))
    expect(screen.queryByRole('textbox', { name: 'IMEI' })).not.toBeInTheDocument()
  })

  it('el histórico sale mezclado por defecto, sin ningún filtro, y cuenta en «filas»', async () => {
    abrir()
    await contador('6 filas')
    expect(filasPintadas()).toBe(6)
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).not.toBeInTheDocument()
  })
})

describe('Pedidos v2: la caja delante y la fila marcada', () => {
  const celdaVacia = async () => (await screen.findAllByRole('button', { name: /pulsa para poner el IMEI/ }))[0]

  it('cada recomendado empieza por la caja, resaltada; el título dice dónde buscarlo; el IMEI sigue en su span', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await celdaVacia())
    await user.click(await screen.findByRole('button', { name: 'Ver recomendados' }))
    const c = await screen.findByRole('button', { name: /350000000000101/ })
    const spans = c.querySelectorAll('span')
    expect(spans[0]).toHaveTextContent('CAJA LISTOS')
    expect(spans[0]).toHaveClass('font-bold')
    expect(spans[1]).toHaveTextContent(/^350000000000101$/)
    expect(screen.getByText('i13128AzulA', { selector: 'span.normal-case' }).parentElement).toHaveTextContent('Recomendados para i13128AzulA · dónde buscarlo')
  })

  it('la última celda abierta deja su fila marcada (fondo y raya azules), se guarde o no, y pasa a la siguiente que se abra', async () => {
    const user = userEvent.setup()
    abrir()
    await contador('6 filas')
    expect(document.querySelector('tr[data-aqui]')).toBeNull()
    await user.click(await celdaVacia())
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(tr('402-0000000-0000021')).toHaveAttribute('data-aqui')
    expect(tr('402-0000000-0000021').querySelector('td')).toHaveClass('shadow-[inset_4px_0_0_#2f6fe0]', 'bg-seleccion-suave')
    // La raya es solo color: la celda del IMEI de esa fila lo dice también con texto, y solo esa.
    expect(screen.getAllByText('Fila en la que estás')).toHaveLength(1)
    expect(tr('402-0000000-0000021')).toContainElement(screen.getByText('Fila en la que estás'))
    await user.click(screen.getByRole('button', { name: /350000000000003/ }))
    expect(document.querySelectorAll('tr[data-aqui]')).toHaveLength(1)
    expect(tr('402-0000000-0000025')).toHaveAttribute('data-aqui')
  })

  it('la raya sigue tras filtrar y al llegar filas nuevas, y pulsar el histórico no la mueve', async () => {
    const user = userEvent.setup()
    const { queryClient } = abrir()
    await user.click(await celdaVacia())
    await user.keyboard('{Escape}')
    await user.click(screen.getByText('350000000000004')) // histórico: no se abre
    expect(tr('402-0000000-0000021')).toHaveAttribute('data-aqui')
    await user.click(screen.getByRole('button', { name: '4 pendientes' }))
    expect(tr('402-0000000-0000021')).toHaveAttribute('data-aqui')
    respuesta = [...FILAS, fila({ idFila: 10, pedido: '402-0000000-0000030' })]
    await queryClient.invalidateQueries()
    await screen.findByText('402-0000000-0000030')
    expect(document.querySelectorAll('tr[data-aqui]')).toHaveLength(1)
    expect(tr('402-0000000-0000021')).toHaveAttribute('data-aqui')
    await user.click(screen.getByRole('button', { name: '7 filas' }))
    expect(tr('402-0000000-0000021')).toHaveAttribute('data-aqui')
  })
})
