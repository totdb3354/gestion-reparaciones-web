import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CambioImei, FilaVista } from '@/shared/api/client'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { maquetarJsdom } from '@/test/layoutJsdom'
import { estadoNsys, fila, fuente } from '../test/fabrica'
import { imeiValido } from '../test/imeiValido'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'

// Las marcas de la fila (En espera de stock, En revisión, Pendiente de color, Cancelado) con nota: desde la celda del IMEI y desde el panel.
const MARCADA = { marcaEn: '2026-11-12T09:30:00', marcaPor: 'Supertécnico 1' } as const
const FILAS = [
  fila({ idFila: 1, pedido: 'M-0001' }),
  fila({ idFila: 2, pedido: 'M-0002', marca: 'ESPERA_STOCK', marcaNota: 'llega el lunes', ...MARCADA }),
  fila({ idFila: 3, pedido: 'M-0003', marca: 'EN_REVISION', ...MARCADA }),
  fila({ idFila: 4, pedido: 'M-0004', marca: 'PENDIENTE_COLOR', marcaNota: 'cliente por confirmar', ...MARCADA }),
  fila({ idFila: 5, pedido: 'M-0005', marca: 'CANCELADO', ...MARCADA }),
]

let respuesta: FilaVista[] = FILAS
let puts: { id: string; cuerpo: { marca: string | null; nota: string | null; marcaAnterior: string | null }; clave: string | null }[] = []
let putsImei: { id: string; imei: string | null }[] = []
let cambios: Record<string, CambioImei[]> = {}

afterEach(() => { vi.restoreAllMocks() })
beforeEach(() => {
  respuesta = FILAS
  puts = []
  putsImei = []
  cambios = {}
  estadoPedidos.reset()
  maquetarJsdom()
  server.use(
    http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: respuesta, hayMas: false })),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    http.get('*/api/pedidos/filas/:id/cambios', ({ params }) => HttpResponse.json(cambios[String(params.id)] ?? [])),
    http.put('*/api/pedidos/filas/:id/marca', async ({ request, params }) => {
      const cuerpo = (await request.json()) as (typeof puts)[number]['cuerpo']
      puts.push({ id: String(params.id), cuerpo, clave: request.headers.get('Idempotency-Key') })
      const base = FILAS.find((f) => f.idFila === Number(params.id))!
      return HttpResponse.json({ ...base, marca: cuerpo.marca, marcaNota: cuerpo.marca ? cuerpo.nota : null, marcaEn: cuerpo.marca ? '2026-11-13T10:00:00' : null, marcaPor: cuerpo.marca ? 'Supertécnico 1' : null })
    }),
    http.put('*/api/pedidos/filas/:id/imei', async ({ request, params }) => {
      const cuerpo = (await request.json()) as { imei: string | null }
      putsImei.push({ id: String(params.id), imei: cuerpo.imei })
      return HttpResponse.json(fila({ idFila: Number(params.id), pedido: 'M-0001', imei: cuerpo.imei }))
    }),
  )
})

const abrir = () => renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
const tr = (pedido: string) => screen.getAllByText(pedido)[0].closest('tr')!
const esperar = (n = FILAS.length) => screen.findByRole('button', { name: `${n} filas` })
const celda = (pedido: string) => within(tr(pedido)).getAllByRole('button')[0]
const abrirPanel = async (user: ReturnType<typeof userEvent.setup>, pedido: string) => {
  await user.click(within(tr(pedido)).getByRole('button', { name: pedido }))
  return waitFor(() => {
    const paneles = screen.getAllByRole('region', { name: 'Detalle del pedido' }).filter((p) => within(p).queryAllByText(pedido).length > 0)
    expect(paneles).toHaveLength(1)
    return paneles[0]
  })
}
const desplegable = () => screen.findByRole('dialog', { name: 'Poner el IMEI' })
const vistos = () => screen.getAllByRole('button', { name: /^M-000\d$/ }).map((e) => e.textContent)

describe('Pedidos: la marca en la celda del IMEI', () => {
  it('se elige marca y nota en el desplegable y se guarda con marcaAnterior y clave de idempotencia; la celda enseña la etiqueta y la nota en el title', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    await user.click(celda('M-0001'))
    const d = within(await desplegable())
    await user.selectOptions(d.getByRole('combobox', { name: 'Marca' }), 'ESPERA_STOCK')
    await user.type(d.getByRole('textbox', { name: 'Nota de la marca' }), '  sin stock en B  ')
    await user.click(d.getByRole('button', { name: 'Guardar marca' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0].id).toBe('1')
    expect(puts[0].cuerpo).toEqual({ marca: 'ESPERA_STOCK', nota: 'sin stock en B', marcaAnterior: '' })
    expect(puts[0].clave).toBeTruthy()
    // La fila devuelta está en la caché: la celda enseña la etiqueta, sin IMEI ocupa el sitio de «pulsa para poner el IMEI…».
    await waitFor(() => expect(within(tr('M-0001')).getByText('En espera de stock')).toBeInTheDocument())
    expect(within(tr('M-0001')).queryByText(/pulsa para poner el IMEI/)).not.toBeInTheDocument()
    expect(within(tr('M-0001')).getAllByRole('button')[0]).toHaveAttribute('title', expect.stringContaining('En espera de stock — sin stock en B'))
    // Se cierra al guardar.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Poner el IMEI' })).not.toBeInTheDocument())
  })

  it('las filas con marca la enseñan en su celda, con la nota en el title; sin nota, solo la marca', async () => {
    abrir()
    await esperar()
    expect(within(tr('M-0002')).getByText('En espera de stock')).toBeInTheDocument()
    expect(celda('M-0002')).toHaveAttribute('title', expect.stringContaining('En espera de stock — llega el lunes'))
    expect(within(tr('M-0003')).getByText('En revisión')).toBeInTheDocument()
    expect(within(tr('M-0004')).getByText('Pendiente de color')).toBeInTheDocument()
    expect(within(tr('M-0005')).getByText('Cancelado', { selector: '[data-marca]' })).toBeInTheDocument()
    // Solo la fila sin marca invita a poner el IMEI.
    expect(screen.getAllByText(/pulsa para poner el IMEI/)).toHaveLength(1)
  })

  it('con IMEI, la etiqueta va tras el IMEI', async () => {
    respuesta = [fila({ idFila: 7, pedido: 'M-0007', imei: imeiValido(7), marca: 'EN_REVISION', ...MARCADA })]
    abrir()
    await esperar(1)
    expect(within(tr('M-0007')).getByText(imeiValido(7))).toBeInTheDocument()
    expect(within(tr('M-0007')).getByText('En revisión')).toBeInTheDocument()
  })

  it('el desplegable abre con el foco en el IMEI y escribir un IMEI con el lector sigue guardando igual, también con una marca puesta', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    await user.click(celda('M-0002'))
    const d = within(await desplegable())
    expect(d.getByRole('textbox', { name: 'IMEI' })).toHaveFocus()
    expect(d.getByRole('combobox', { name: 'Marca' })).toHaveValue('ESPERA_STOCK')
    await user.keyboard(imeiValido(5))
    await waitFor(() => expect(putsImei).toEqual([{ id: '2', imei: imeiValido(5) }]))
    expect(puts).toEqual([])
  })

  it('«Quitar la marca» manda marca null con marcaAnterior', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    await user.click(celda('M-0002'))
    await user.click(within(await desplegable()).getByRole('button', { name: 'Quitar la marca' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0].cuerpo).toEqual({ marca: null, nota: null, marcaAnterior: 'ESPERA_STOCK' })
    await waitFor(() => expect(within(tr('M-0002')).queryByText('En espera de stock')).not.toBeInTheDocument())
  })

  it('un 409 por marcaAnterior recarga las filas y deja el aviso con el mensaje del servidor, sin estado de fallo', async () => {
    const user = userEvent.setup()
    let cargas = 0
    server.use(
      http.get('*/api/pedidos/filas', () => { cargas++; return HttpResponse.json({ filas: respuesta, hayMas: false }) }),
      http.put('*/api/pedidos/filas/:id/marca', () => HttpResponse.json({ message: 'Otra persona ha cambiado la marca de esta fila mientras tanto. Recarga y vuelve a intentarlo.' }, { status: 409 })),
    )
    abrir()
    await esperar()
    const antes = cargas
    await user.click(celda('M-0001'))
    const d = within(await desplegable())
    await user.selectOptions(d.getByRole('combobox', { name: 'Marca' }), 'CANCELADO')
    await user.click(d.getByRole('button', { name: 'Guardar marca' }))
    expect(await screen.findByText(/Pedido M-0001: Otra persona ha cambiado la marca/)).toBeInTheDocument()
    await waitFor(() => expect(cargas).toBeGreaterThan(antes))
    expect(estadoPedidos.get().fallosImei).toEqual({})
  })
})

describe('Pedidos: la marca en el panel', () => {
  it('enseña la marca, la nota, quién y cuándo; permite cambiarla y quitarla', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    const panel = await abrirPanel(user, 'M-0002')
    expect(within(panel).getByText('En espera de stock', { selector: 'span' })).toBeInTheDocument()
    expect(within(panel).getByText('llega el lunes')).toBeInTheDocument()
    expect(within(panel).getByText('Puesta por Supertécnico 1 el 12/11/2026 09:30')).toBeInTheDocument()
    // Cambiar la marca.
    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Marca' }), 'EN_REVISION')
    await user.click(within(panel).getByRole('button', { name: 'Guardar marca' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0].cuerpo).toEqual({ marca: 'EN_REVISION', nota: 'llega el lunes', marcaAnterior: 'ESPERA_STOCK' })
    await waitFor(() => expect(within(tr('M-0002')).getByText('En revisión')).toBeInTheDocument())
    // Quitarla.
    await user.click(within(panel).getByRole('button', { name: 'Quitar la marca' }))
    await waitFor(() => expect(puts).toHaveLength(2))
    expect(puts[1].cuerpo).toMatchObject({ marca: null, marcaAnterior: 'EN_REVISION' })
    expect(puts[1].clave).not.toBe(puts[0].clave)
    await waitFor(() => expect(within(panel).getByText('Sin marca.')).toBeInTheDocument())
  })

  it('sin marca, ofrece ponerla', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    const panel = await abrirPanel(user, 'M-0001')
    expect(within(panel).getByText('Sin marca.')).toBeInTheDocument()
    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Marca' }), 'PENDIENTE_COLOR')
    await user.click(within(panel).getByRole('button', { name: 'Guardar marca' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0].cuerpo).toEqual({ marca: 'PENDIENTE_COLOR', nota: null, marcaAnterior: '' })
  })

  it('el historial enseña «Marca» con su nota, «Marca quitada» y «Marca quitada al poner el IMEI»', async () => {
    const user = userEvent.setup()
    cambios = {
      '2': [
        { usuario: 'Supertécnico 1', fecha: '2026-11-12T09:30:00', imeiAnterior: null, imeiNuevo: null, tipo: 'MARCA', detalle: 'ESPERA_STOCK — llega el lunes' },
        { usuario: 'Supertécnico 1', fecha: '2026-11-11T09:30:00', imeiAnterior: null, imeiNuevo: null, tipo: 'MARCA_QUITADA', detalle: 'EN_REVISION' },
        { usuario: 'Supertécnico 1', fecha: '2026-11-10T09:30:00', imeiAnterior: null, imeiNuevo: imeiValido(3), tipo: 'IMEI', detalle: null },
        { usuario: 'Supertécnico 1', fecha: '2026-11-10T09:29:00', imeiAnterior: null, imeiNuevo: null, tipo: 'MARCA_QUITADA', detalle: 'ESPERA_STOCK — al poner el IMEI' },
      ],
    }
    abrir()
    await esperar()
    const panel = await abrirPanel(user, 'M-0002')
    const lista = within(await within(panel).findByRole('list', { name: 'Historial de la fila' }))
    expect(await lista.findByText('Marca: En espera de stock — llega el lunes')).toBeInTheDocument()
    expect(lista.getByText('Marca quitada (En revisión)')).toBeInTheDocument()
    expect(lista.getByText('Marca quitada al poner el IMEI (En espera de stock)')).toBeInTheDocument()
  })
})

describe('Pedidos: efectos de las marcas en la tabla', () => {
  it('«Cancelado» sustituye al estado en la celda de envío y no cuenta como pendiente; En espera de stock y En revisión sí', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    expect(within(tr('M-0005')).getAllByText('Cancelado')).toHaveLength(2) // la etiqueta de la marca y la del envío
    expect(within(tr('M-0005')).queryByText('Pendiente')).not.toBeInTheDocument()
    expect(within(tr('M-0002')).getByText('Pendiente')).toBeInTheDocument()
    // 4 pendientes: todas menos la cancelada.
    await user.click(screen.getByRole('button', { name: '4 pendientes' }))
    expect(vistos()).toEqual(['M-0001', 'M-0002', 'M-0003', 'M-0004'])
  })

  it('«Cancelado» gana también a «Falta por enviar» y a una etiqueta generada', async () => {
    respuesta = [fila({ idFila: 9, pedido: 'M-0009', canal: 'DISTRIBUIDORES', estado: 'ENVIADA', envioFecha: '2026-11-09T10:30:00', faltaEnviarEn: '2026-11-10T09:05:00', marca: 'CANCELADO', ...MARCADA })]
    abrir()
    await esperar(1)
    expect(within(tr('M-0009')).queryByText(/falta por enviar|Etiqueta generada/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '0 pendientes' })).toBeInTheDocument()
  })

  it('el filtro «Enviado» gana «Cancelado», con su recuento', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    await user.click(screen.getByRole('button', { name: 'Filtrar Enviado' }))
    const opcion = screen.getByRole('checkbox', { name: /Cancelado/ })
    await user.click(opcion)
    expect(vistos()).toEqual(['M-0005'])
  })

  it('el filtro «Con marca» del IMEI trae una casilla por marca con su recuento y filtra', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    await user.click(screen.getByRole('button', { name: 'Filtrar IMEI' }))
    const grupo = within(screen.getByRole('group', { name: 'Con marca' }))
    for (const m of ['En espera de stock', 'En revisión', 'Pendiente de color', 'Cancelado']) {
      expect(grupo.getByRole('checkbox', { name: new RegExp(`^${m}`) })).toBeInTheDocument()
    }
    expect(grupo.getByRole('checkbox', { name: /^En espera de stock\s*1$/ })).toBeInTheDocument()
    await user.click(grupo.getByRole('checkbox', { name: /^En revisión/ }))
    await user.click(grupo.getByRole('checkbox', { name: /^Cancelado/ }))
    expect(vistos()).toEqual(['M-0003', 'M-0005'])
    expect(screen.getByRole('button', { name: 'Quitar filtro Con marca: En revisión' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar filtro Con marca: En revisión' }))
    expect(vistos()).toEqual(['M-0005'])
  })
})
