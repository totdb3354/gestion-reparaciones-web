import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CambioImei, FilaVista, PasadaAsociacion } from '@/shared/api/client'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { maquetarJsdom } from '@/test/layoutJsdom'
import { estadoNsys, fila, filaAmazon, fuente, pasada } from '../test/fabrica'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'
import { congelarHoy } from '../test/hoy'

congelarHoy()

// Amazon sale «sin asociar» hasta que el libro de ventas asocia el IMEI al pedido: columna, panel, «1/n», filtro, píldora y lista «para revisar».
const ASOC = { asociadaEn: '2026-11-13T09:30:00', asociadaOrigen: 'LIBRO' } as const
const FILAS: FilaVista[] = [
  filaAmazon({ idFila: 1, pedido: '111-1111111-1111111', sku: 'skuSinAsociar' }),
  filaAmazon({ idFila: 2, pedido: '222-2222222-2222222', sku: 'skuAsociada', ...ASOC }),
  filaAmazon({ idFila: 3, pedido: '333-3333333-3333333', sku: 'skuStockroom', canal: 'AMAZON_STOCKROOM' }),
  fila({ idFila: 4, pedido: 'W-0004', sku: 'skuWeb' }),
  filaAmazon({ idFila: 5, pedido: '555-5555555-5555555', sku: 'skuHistorico', asociadaEn: '2026-11-12T08:05:00', asociadaOrigen: 'HISTORICO' }),
]

let respuesta: FilaVista[] = FILAS
let pasadas: PasadaAsociacion[] = []
let cambios: Record<string, CambioImei[]> = {}

afterEach(() => { vi.restoreAllMocks() })
beforeEach(() => {
  respuesta = FILAS
  pasadas = []
  cambios = {}
  estadoPedidos.reset()
  maquetarJsdom()
  server.use(
    http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: respuesta, hayMas: false })),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
    http.get('*/api/pedidos/asociaciones', () => HttpResponse.json({ canales: pasadas })),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    http.get('*/api/pedidos/filas/:id/cambios', ({ params }) => HttpResponse.json(cambios[String(params.id)] ?? [])),
  )
})

const abrir = () => renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
const esperar = (n = respuesta.length) => screen.findByRole('button', { name: `${n} filas` })
const tr = (sku: string) => screen.getAllByText(sku)[0].closest('tr')!
const abrirPanel = async (user: ReturnType<typeof userEvent.setup>, sku: string) => {
  // El botón de la columna «Pedido» es el que lleva aria-pressed (la celda del IMEI no).
  const botones = within(tr(sku)).getAllByRole('button')
  await user.click(botones.find((b) => b.hasAttribute('aria-pressed'))!)
  return screen.findByRole('region', { name: 'Detalle del pedido' })
}
const cerrarPanel = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(within(screen.getByRole('region', { name: 'Detalle del pedido' })).getByRole('button', { name: 'Cerrar' }))
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Detalle del pedido' })).not.toBeInTheDocument())
}

describe('Pedidos: la columna «Pedido» en Amazon', () => {
  it('una fila de Amazon sin asociar dice «sin asociar» y no enseña el número, ni en la celda ni en su title', async () => {
    abrir()
    await esperar()
    const f = tr('skuSinAsociar')
    expect(within(f).getByRole('button', { name: 'sin asociar' })).toBeInTheDocument()
    expect(f.innerHTML).not.toContain('111-1111111-1111111')
    expect(within(tr('skuStockroom')).getByRole('button', { name: 'sin asociar' })).toBeInTheDocument()
    expect(tr('skuStockroom').innerHTML).not.toContain('333-3333333-3333333')
  })

  it('una fila de la hoja sin número de pedido deja la celda en blanco, no «sin asociar» (0.9.41)', async () => {
    // El histórico de PEDIDOS 2026 casi nunca trae el número, y sus filas no tienen canal: no es «falta asociar», es que no lo hay.
    respuesta = [fila({ idFila: 6, pedido: null, sku: 'skuHojaSinNumero', plataforma: 'AMZ', canal: null, estado: 'HISTORICO', editable: false })]
    abrir()
    await esperar()
    const celda = within(tr('skuHojaSinNumero')).getByRole('button', { name: 'Ver el detalle del pedido' })
    expect(celda).toHaveTextContent(/^$/)
    expect(screen.queryByText('sin asociar')).not.toBeInTheDocument()
  })

  it('asociada enseña el número; una web, siempre', async () => {
    abrir()
    await esperar()
    expect(within(tr('skuAsociada')).getByRole('button', { name: '222-2222222-2222222' })).toBeInTheDocument()
    expect(within(tr('skuHistorico')).getByRole('button', { name: '555-5555555-5555555' })).toBeInTheDocument()
    expect(within(tr('skuWeb')).getByRole('button', { name: 'W-0004' })).toBeInTheDocument()
    expect(screen.queryByText('333-3333333-3333333')).not.toBeInTheDocument()
  })

  it('el panel dice «Pedido: sin asociar», o el número y desde dónde y cuándo se asoció', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    let panel = within(await abrirPanel(user, 'skuSinAsociar'))
    expect(panel.getByText('sin asociar')).toBeInTheDocument()
    expect(screen.queryByText('111-1111111-1111111')).not.toBeInTheDocument()
    await cerrarPanel(user)

    panel = within(await abrirPanel(user, 'skuAsociada'))
    expect(panel.getByText(/222-2222222-2222222/)).toBeInTheDocument()
    expect(panel.getByText('asociado desde el libro de ventas el 13/11 09:30')).toBeInTheDocument()
    await cerrarPanel(user)

    panel = within(await abrirPanel(user, 'skuHistorico'))
    expect(panel.getByText('asociado desde el histórico de la hoja el 12/11 08:05')).toBeInTheDocument()
  })

  it('una web no dice nada de asociación en el panel', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    const panel = within(await abrirPanel(user, 'skuWeb'))
    expect(panel.getByText('W-0004')).toBeInTheDocument()
    expect(panel.queryByText(/asociado/)).not.toBeInTheDocument()
    expect(panel.queryByText('sin asociar')).not.toBeInTheDocument()
  })

  it('el «1/n» de Amazon solo cuenta entre las filas asociadas; el de una web, como siempre', async () => {
    respuesta = [
      filaAmazon({ idFila: 1, pedido: 'AMZ-A', sku: 'sku1', ...ASOC }),
      filaAmazon({ idFila: 2, pedido: 'AMZ-A', sku: 'sku2' }),
      filaAmazon({ idFila: 3, pedido: 'AMZ-A', sku: 'sku3', ...ASOC }),
      filaAmazon({ idFila: 4, pedido: 'AMZ-B', sku: 'sku4' }),
      filaAmazon({ idFila: 5, pedido: 'AMZ-B', sku: 'sku5' }),
      fila({ idFila: 6, pedido: 'W-1', sku: 'sku6' }),
      fila({ idFila: 7, pedido: 'W-1', sku: 'sku7' }),
    ]
    abrir()
    await esperar(7)
    const num = (sku: string) => within(tr(sku)).queryByTitle('Móviles de este pedido')?.textContent ?? null
    expect([num('sku1'), num('sku2'), num('sku3')]).toEqual(['1/2', null, '2/2'])
    expect([num('sku4'), num('sku5')]).toEqual([null, null])
    expect([num('sku6'), num('sku7')]).toEqual(['1/2', '2/2'])
  })
})

describe('Pedidos: filtro «Sin asociar»', () => {
  it('dentro del filtro de IMEI, con su recuento (solo Amazon); filtra, sale como etiqueta y se quita', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    await user.click(screen.getByRole('button', { name: 'Filtrar IMEI' }))
    const filtro = within(await screen.findByRole('dialog', { name: 'Filtro de IMEI' }))
    const casilla = filtro.getByRole('checkbox', { name: /Sin asociar/ })
    expect(casilla.closest('label')).toHaveTextContent('2')
    await user.click(casilla)
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(3))
    expect(screen.getAllByText(/^sku/).map((e) => e.textContent).sort()).toEqual(['skuSinAsociar', 'skuStockroom'])
    await user.click(screen.getByRole('button', { name: 'Quitar filtro Sin asociar' }))
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(6))
  })

  it('con el filtro puesto, el contador «filas» ya no está pulsado', async () => {
    estadoPedidos.set((s) => ({ ...s, sinAsociar: true }))
    abrir()
    await esperar()
    expect(screen.getByRole('button', { name: `${FILAS.length} filas` })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('Pedidos: la píldora «Asociación Amazon»', () => {
  it('sin pasadas no sale', async () => {
    abrir()
    await esperar()
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText(/Asociación Amazon/)).not.toBeInTheDocument()
  })

  it('con pasadas dice la hora de la última y cuántas quedaron para revisar', async () => {
    pasadas = [
      pasada({ canal: 'AMAZON', cuando: '2026-11-13T09:30:00', paraRevisar: 1, revisar: [{ pedido: '111-1', imei: '350000000000001', motivo: 'SIN_HUECO', vistoEn: '2026-11-13T09:30:00', detalle: null }] }),
      pasada({ canal: 'AMAZON_STOCKROOM', cuando: '2026-11-13T10:15:00', paraRevisar: 2, revisar: [
        { pedido: '333-3', imei: '350000000000002', motivo: 'YA_SALIO', vistoEn: '2026-11-13T10:15:00', detalle: null },
        { pedido: '444-4', imei: '350000000000003', motivo: 'PEDIDO_AJENO', vistoEn: '2026-11-13T10:15:00', detalle: null },
      ] }),
    ]
    abrir()
    await esperar()
    expect(await screen.findByRole('button', { name: /Asociación Amazon: 10:15 · 3 para revisar/ })).toBeInTheDocument()
  })

  it('al pulsarla abre la lista con el pedido, el IMEI y el motivo en palabras', async () => {
    const user = userEvent.setup()
    pasadas = [
      pasada({ canal: 'AMAZON', cuando: '2026-11-13T09:30:00', confirmadas: 4, paraRevisar: 2, revisar: [
        { pedido: '111-1', imei: '350000000000001', motivo: 'SIN_HUECO', vistoEn: '2026-11-13T09:30:00', detalle: null },
        { pedido: '222-2', imei: '350000000000002', motivo: 'CANCELADO', vistoEn: '2026-11-13T09:30:00', detalle: null },
      ] }),
      pasada({ canal: 'AMAZON_STOCKROOM', cuando: '2026-11-13T09:40:00', paraRevisar: 2, revisar: [
        { pedido: '333-3', imei: '350000000000003', motivo: 'YA_SALIO', vistoEn: '2026-11-13T09:40:00', detalle: null },
        { pedido: '444-4', imei: '350000000000004', motivo: 'PEDIDO_AJENO', vistoEn: '2026-11-13T09:40:00', detalle: null },
      ] }),
    ]
    abrir()
    await esperar()
    await user.click(await screen.findByRole('button', { name: /Asociación Amazon/ }))
    const lista = within(await screen.findByRole('dialog', { name: 'Asociación de Amazon' }))
    const linea = (pedido: string) => lista.getByText(pedido).closest('li')!
    expect(linea('111-1')).toHaveTextContent('350000000000001')
    expect(linea('111-1')).toHaveTextContent('el pedido no tiene hueco')
    expect(linea('222-2')).toHaveTextContent('solo quedan filas canceladas')
    expect(linea('333-3')).toHaveTextContent('el móvil ya salió en otro pedido')
    expect(linea('444-4')).toHaveTextContent('el pedido no está en el ERP')
  })

  it('un motivo que la web no conoce se enseña tal cual', async () => {
    const user = userEvent.setup()
    pasadas = [pasada({ paraRevisar: 1, revisar: [{ pedido: '9-9', imei: '350000000000009', motivo: 'RARO', vistoEn: '2026-11-13T09:30:00', detalle: null }] }), pasada({ canal: 'AMAZON_STOCKROOM' })]
    abrir()
    await esperar()
    await user.click(await screen.findByRole('button', { name: /Asociación Amazon: 09:30 · 1 para revisar/ }))
    expect(within(await screen.findByRole('dialog', { name: 'Asociación de Amazon' })).getByText('9-9').closest('li')).toHaveTextContent('RARO')
  })

  it('un motivo del libro con detalle enseña el texto y el detalle', async () => {
    const user = userEvent.setup()
    pasadas = [pasada({ paraRevisar: 1, revisar: [{ pedido: '402-0000000-0000001', imei: '350000000000001', motivo: 'OTRO_MODELO', vistoEn: '2026-11-13T09:30:00', detalle: 'el pedido es A y el móvil es B' }] }), pasada({ canal: 'AMAZON_STOCKROOM' })]
    abrir()
    await esperar()
    await user.click(await screen.findByRole('button', { name: /Asociación Amazon: 09:30 · 1 para revisar/ }))
    expect(within(await screen.findByRole('dialog', { name: 'Asociación de Amazon' })).getByText('402-0000000-0000001').closest('li'))
      .toHaveTextContent('el móvil del libro no cuadra con el pedido: el pedido es A y el móvil es B')
  })

  it('sin error, el detalle dice la version del libro que se leyo', async () => {
    const user = userEvent.setup()
    pasadas = [
      pasada({ canal: 'AMAZON', libroModificado: '2026-11-13T08:45:00' }),
      pasada({ canal: 'AMAZON_STOCKROOM' }),
    ]
    abrir()
    await esperar()
    await user.click(await screen.findByRole('button', { name: /Asociación Amazon: 09:30/ }))
    const detalle = within(await screen.findByRole('dialog', { name: 'Asociación de Amazon' }))
    expect(detalle.getAllByText(/Libro leído/)).toHaveLength(1)
    expect(detalle.getByText('Libro leído: versión del 13/11 08:45')).toBeInTheDocument()
  })

  it('con error en un canal, la pildora se pone en ambar y el detalle dice desde cuando y por que', async () => {
    const user = userEvent.setup()
    pasadas = [
      pasada({ canal: 'AMAZON', libroModificado: '2026-11-13T08:45:00' }),
      pasada({ canal: 'AMAZON_STOCKROOM', error: 'archivo bloqueado', errorEn: '2026-11-13T10:00:00', paraRevisar: 1, revisar: [{ pedido: '333-3', imei: '350000000000002', motivo: 'YA_SALIO', vistoEn: '2026-11-13T09:40:00', detalle: null }] }),
    ]
    abrir()
    await esperar()
    const boton = await screen.findByRole('button', { name: 'Libros de Amazon: con errores' })
    expect(boton.querySelector('.bg-ambar')).not.toBeNull()
    await user.click(boton)
    const detalle = within(await screen.findByRole('dialog', { name: 'Asociación de Amazon' }))
    expect(detalle.getByText('No se pudo leer el libro desde 13/11 10:00: archivo bloqueado')).toBeInTheDocument()
    expect(detalle.getByText('Libro leído: versión del 13/11 08:45')).toBeInTheDocument()
    expect(detalle.getByText('333-3')).toBeInTheDocument()
  })

    it('sin nada para revisar lo dice y la lista no tiene filas', async () => {
    const user = userEvent.setup()
    pasadas = [pasada({ confirmadas: 3 })]
    abrir()
    await esperar()
    await user.click(await screen.findByRole('button', { name: /Asociación Amazon: 09:30 · 0 para revisar/ }))
    expect(within(await screen.findByRole('dialog', { name: 'Asociación de Amazon' })).getByText('Nada para revisar.')).toBeInTheDocument()
  })
})

describe('Pedidos: ayuda e historial', () => {
  it('la ayuda explica «sin asociar»', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    await user.click(screen.getByRole('button', { name: 'Ayuda de Pedidos' }))
    const ayuda = within(await screen.findByRole('dialog', { name: 'Cómo se lee esta tabla' }))
    expect(ayuda.getByText('sin asociar')).toBeInTheDocument()
    expect(ayuda.getByText(/Amazon: el pedido sale cuando lo asocia el libro de ventas/)).toBeInTheDocument()
  })

  it('el historial enseña «Pedido asociado» y «IMEI intercambiado con la fila n»', async () => {
    const user = userEvent.setup()
    cambios['2'] = [
      { usuario: null, fecha: '2026-11-13T09:30:00', imeiAnterior: null, imeiNuevo: null, tipo: 'ASOCIADA', detalle: 'LIBRO' },
      { usuario: null, fecha: '2026-11-13T09:30:00', imeiAnterior: '350000000000001', imeiNuevo: '350000000000002', tipo: 'IMEI_INTERCAMBIADO', detalle: 'con la fila 12' },
      { usuario: null, fecha: '2026-11-12T08:00:00', imeiAnterior: null, imeiNuevo: null, tipo: 'ASOCIADA', detalle: 'HISTORICO' },
    ]
    abrir()
    await esperar()
    const panel = within(await abrirPanel(user, 'skuAsociada'))
    const historial = await panel.findByRole('list', { name: 'Historial de la fila' })
    expect(within(historial).getByText('Pedido asociado (libro de ventas)')).toBeInTheDocument()
    expect(within(historial).getByText('IMEI intercambiado con la fila 12')).toBeInTheDocument()
    expect(within(historial).getByText('Pedido asociado (histórico de la hoja)')).toBeInTheDocument()
  })
})
