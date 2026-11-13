import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { maquetarJsdom } from '@/test/layoutJsdom'
import { estadoNsys, fila, fuente } from '../test/fabrica'
import { imeiValido } from '../test/imeiValido'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'

// Envíos parciales de web: la marca «falta por enviar» desde el panel, su etiqueta en la tabla y el «1/3» de los pedidos de varios móviles.
const ENVIADA = { estado: 'ENVIADA', envioFecha: '2026-11-09T10:30:00', tieneEtiqueta: true } as const
const FILAS = [
  fila({ idFila: 1, canal: 'DISTRIBUIDORES', plataforma: 'Cliente Web A', pedido: 'W-0001', ...ENVIADA }),
  fila({ idFila: 2, canal: 'AMAZON', plataforma: 'AMZ', pedido: 'W-0002', ...ENVIADA }),
  fila({ idFila: 3, canal: 'PARTICULARES', plataforma: 'Cliente Web B', pedido: 'W-0003' }),
  fila({ idFila: 4, canal: 'BACKIPHONE', plataforma: 'Cliente Web C', pedido: 'W-0004', ...ENVIADA, faltaEnviarEn: '2026-11-10T09:05:00' }),
  fila({ idFila: 5, canal: 'PARTICULARES', plataforma: 'Cliente Web D', pedido: 'W-0005', estado: 'NO_PENDIENTE', faltaEnviarEn: '2026-11-10T09:05:00' }),
]

let respuesta = FILAS
let puts: { id: string; cuerpo: unknown; clave: string | null }[] = []

afterEach(() => { vi.restoreAllMocks() })
beforeEach(() => {
  respuesta = FILAS
  puts = []
  estadoPedidos.reset()
  maquetarJsdom()
  server.use(
    http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: respuesta, hayMas: false })),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    http.get('*/api/pedidos/filas/:id/cambios', () => HttpResponse.json([])),
    http.put('*/api/pedidos/filas/:id/falta-enviar', async ({ request, params }) => {
      const cuerpo = (await request.json()) as { falta: boolean }
      puts.push({ id: String(params.id), cuerpo, clave: request.headers.get('Idempotency-Key') })
      const base = FILAS.find((f) => f.idFila === Number(params.id))!
      return HttpResponse.json({ ...base, faltaEnviarEn: cuerpo.falta ? '2026-11-13T10:00:00' : null })
    }),
  )
})

const abrir = () => renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
const tr = (pedido: string) => screen.getAllByText(pedido)[0].closest('tr')!
const abrirPanel = async (user: ReturnType<typeof userEvent.setup>, pedido: string) => {
  await user.click(within(tr(pedido)).getByRole('button', { name: pedido }))
  // El panel anterior puede seguir saliendo: se espera al de este pedido.
  return waitFor(() => {
    const paneles = screen.getAllByRole('region', { name: 'Detalle del pedido' }).filter((p) => within(p).queryAllByText(pedido).length > 0)
    expect(paneles).toHaveLength(1)
    return paneles[0]
  })
}
const esperar = () => screen.findByRole('button', { name: '5 filas' })
const pedidosVistos = () => screen.getAllByRole('button', { name: /^W-000\d$/ }).map((e) => e.textContent)

describe('Pedidos: «Falta por enviar» en el panel', () => {
  it('el botón sale solo en una fila de web editable con la etiqueta generada (ENVIADA) y sin marca', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    expect(within(await abrirPanel(user, 'W-0001')).getByRole('button', { name: 'Falta por enviar' })).toBeInTheDocument()
    // Amazon enviada: no es de web.
    const p2 = await abrirPanel(user, 'W-0002')
    expect(within(p2).queryByRole('button', { name: 'Falta por enviar' })).not.toBeInTheDocument()
    // Web pendiente: aún no hay etiqueta.
    expect(within(await abrirPanel(user, 'W-0003')).queryByRole('button', { name: 'Falta por enviar' })).not.toBeInTheDocument()
    // Ya marcada: dice desde cuándo y ofrece «Ya ha salido» en vez de marcar.
    const marcada = await abrirPanel(user, 'W-0004')
    expect(within(marcada).getByText('Envío parcial: falta por enviar desde 10/11 09:05')).toBeInTheDocument()
    expect(within(marcada).getByRole('button', { name: 'Ya ha salido' })).toBeInTheDocument()
    expect(within(marcada).queryByRole('button', { name: 'Falta por enviar' })).not.toBeInTheDocument()
    // Con una marca en un pedido que no es ENVIADA no se ve nada (se ignora).
    const reabierta = await abrirPanel(user, 'W-0005')
    expect(within(reabierta).queryByText(/Envío parcial/)).not.toBeInTheDocument()
    expect(within(reabierta).queryByRole('button', { name: /Falta por enviar|Ya ha salido/ })).not.toBeInTheDocument()
  })

  it('marcar y desmarcar mandan el cuerpo y la clave, escriben la fila en las cachés y apuntan al momento en el historial', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    expect(within(tr('W-0001')).getByText(/^Etiqueta generada/)).toBeInTheDocument()
    const panel = await abrirPanel(user, 'W-0001')
    await user.click(within(panel).getByRole('button', { name: 'Falta por enviar' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0].id).toBe('1')
    expect(puts[0].cuerpo).toEqual({ falta: true })
    expect(puts[0].clave).toBeTruthy()
    // La fila devuelta está en la caché: la tabla y el panel lo enseñan.
    expect(await within(tr('W-0001')).findByText('Envío parcial · falta por enviar')).toBeInTheDocument()
    expect(within(panel).getByText('Envío parcial: falta por enviar desde 13/11 10:00')).toBeInTheDocument()
    expect(await within(within(panel).getByRole('list', { name: 'Historial de la fila' })).findByText('Marcada: falta por enviar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3 pendientes' })).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: 'Ya ha salido' }))
    await waitFor(() => expect(puts).toHaveLength(2))
    expect(puts[1].cuerpo).toEqual({ falta: false })
    expect(puts[1].clave).toBeTruthy()
    expect(puts[1].clave).not.toBe(puts[0].clave)
    expect(await within(tr('W-0001')).findByText(/^Etiqueta generada/)).toBeInTheDocument()
    expect(await within(within(panel).getByRole('list', { name: 'Historial de la fila' })).findByText('Ya ha salido (marca quitada)')).toBeInTheDocument()
  })

  it('un 409 enseña el mensaje del servidor por la vía normal de errores', async () => {
    const user = userEvent.setup()
    server.use(http.put('*/api/pedidos/filas/:id/falta-enviar', () => HttpResponse.json({ message: 'Solo se marca en pedidos de la web' }, { status: 409 })))
    abrir()
    await esperar()
    await user.click(within(await abrirPanel(user, 'W-0001')).getByRole('button', { name: 'Falta por enviar' }))
    expect(await screen.findByText(/Solo se marca en pedidos de la web/)).toBeInTheDocument()
  })
})

describe('Pedidos: el envío parcial en la tabla', () => {
  it('lleva la etiqueta ámbar en vez de «Etiqueta generada»; una marca en un NO_PENDIENTE se ignora', async () => {
    abrir()
    await esperar()
    expect(within(tr('W-0004')).getByText('Envío parcial · falta por enviar')).toBeInTheDocument()
    expect(within(tr('W-0004')).queryByText(/Etiqueta generada/)).not.toBeInTheDocument()
    expect(within(tr('W-0005')).getByText('Ya no está pendiente')).toBeInTheDocument()
  })

  it('cuenta como pendiente: contador, filtro «Pendientes» y su propia opción «Falta por enviar»', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    // W-0003 (pendiente) + W-0004 (envío parcial).
    await user.click(screen.getByRole('button', { name: '2 pendientes' }))
    expect(pedidosVistos()).toEqual(['W-0003', 'W-0004'])
    await user.click(screen.getByRole('button', { name: '5 filas' }))
    await user.click(screen.getByRole('button', { name: 'Filtrar Enviado' }))
    await user.click(screen.getByRole('checkbox', { name: /Falta por enviar/ }))
    expect(pedidosVistos()).toEqual(['W-0004'])
  })
})

describe('Pedidos: «1/3» en los pedidos de varios móviles', () => {
  it('numera las filas del pedido en su orden; el pedido de una fila y el histórico no llevan marca', async () => {
    respuesta = [
      fila({ idFila: 11, canal: 'PARTICULARES', plataforma: 'Cliente Web A', pedido: 'M-3', imei: imeiValido(1) }),
      fila({ idFila: 12, canal: 'PARTICULARES', plataforma: 'Cliente Web A', pedido: 'M-3', imei: imeiValido(2) }),
      fila({ idFila: 13, canal: 'PARTICULARES', plataforma: 'Cliente Web B', pedido: 'M-1' }),
      fila({ idFila: 14, canal: 'PARTICULARES', plataforma: 'Cliente Web A', pedido: 'M-3' }),
      fila({ idFila: 15, canal: 'PARTICULARES', plataforma: 'Cliente Web C', pedido: 'M-3', estado: 'HISTORICO', editable: false }),
    ]
    abrir()
    await screen.findByRole('button', { name: '5 filas' })
    const marcas = screen.getAllByRole('row').slice(1).map((r) => r.querySelector('[data-numero-pedido]')?.textContent ?? null)
    expect(marcas).toEqual(['1/3', '2/3', null, '3/3', null])
  })
})

describe('Pedidos: un 409 al guardar el IMEI recarga las filas', () => {
  it('recarga en el acto, deja el aviso con el mensaje del servidor y no queda fallo con reintento', async () => {
    const user = userEvent.setup()
    let cargas = 0
    server.use(
      http.get('*/api/pedidos/filas', () => { cargas++; return HttpResponse.json({ filas: respuesta, hayMas: false }) }),
      http.put('*/api/pedidos/filas/:id/imei', () => HttpResponse.json({ message: 'Otra persona lo ha cambiado' }, { status: 409 })),
    )
    abrir()
    await esperar()
    const antes = cargas
    await user.click(within(tr('W-0003')).getByRole('button', { name: /pulsa para poner el IMEI/ }))
    await user.keyboard(imeiValido(7))
    expect(await screen.findByText(/Pedido W-0003: Otra persona lo ha cambiado/)).toBeInTheDocument()
    await waitFor(() => expect(cargas).toBeGreaterThan(antes))
    expect(screen.queryByText(/pulsa para reintentar/)).not.toBeInTheDocument()
    expect(estadoPedidos.get().fallosImei).toEqual({})
  })
})
