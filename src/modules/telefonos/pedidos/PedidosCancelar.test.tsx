import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FilaVista } from '@/shared/api/client'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { maquetarJsdom } from '@/test/layoutJsdom'
import { estadoNsys, fila, fuente } from '../test/fabrica'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'
import { congelarHoy } from '../test/hoy'

congelarHoy()

// «Cancelar móvil» y «Quitar cancelación» del panel (spec 2026-11-23), con datos inventados.
const ENVIADA = { estado: 'ENVIADA', envioFecha: '2026-11-09T10:30:00', tieneEtiqueta: true } as const
const MARCADA = { marcaEn: '2026-11-12T09:30:00', marcaPor: 'Supertécnico 1' } as const
const FILAS = [
  fila({ idFila: 1, pedido: 'C-0001', imei: '350000000000011', marca: 'EN_REVISION', ...MARCADA }),
  fila({ idFila: 2, canal: 'PARTICULARES', plataforma: 'Cliente Web A', pedido: 'C-0002', imei: '350000000000022', ...ENVIADA, faltaEnviarEn: '2026-11-10T09:05:00' }),
  fila({ idFila: 3, canal: 'PARTICULARES', plataforma: 'Cliente Web B', pedido: 'C-0003', imei: '350000000000033', ...ENVIADA, marca: 'CANCELADO', marcaNota: 'cliente lo anula', ...MARCADA }),
]

let puts: { id: string; cuerpo: { marca: string | null; nota: string | null; marcaAnterior: string | null } }[] = []

afterEach(() => { vi.restoreAllMocks() })
beforeEach(() => {
  puts = []
  estadoPedidos.reset()
  maquetarJsdom()
  server.use(
    http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: FILAS, hayMas: false })),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    http.get('*/api/pedidos/filas/:id/cambios', () => HttpResponse.json([])),
    http.put('*/api/pedidos/filas/:id/marca', async ({ request, params }) => {
      const cuerpo = (await request.json()) as (typeof puts)[number]['cuerpo']
      puts.push({ id: String(params.id), cuerpo })
      const base = FILAS.find((f) => f.idFila === Number(params.id))!
      const cancelada = cuerpo.marca === 'CANCELADO'
      const vuelta: FilaVista = { ...base, marca: cuerpo.marca, marcaNota: cuerpo.marca ? cuerpo.nota : null,
        marcaEn: cuerpo.marca ? '2026-11-13T10:00:00' : null, marcaPor: cuerpo.marca ? 'Supertécnico 1' : null,
        faltaEnviarEn: cancelada ? null : base.faltaEnviarEn }
      return HttpResponse.json(vuelta)
    }),
  )
})

const abrir = () => renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
const tr = (pedido: string) => screen.getAllByText(pedido)[0].closest('tr')!
const esperar = () => screen.findByRole('button', { name: `${FILAS.length} filas` })
const abrirPanel = async (user: ReturnType<typeof userEvent.setup>, pedido: string) => {
  await user.click(within(tr(pedido)).getByRole('button', { name: pedido }))
  return waitFor(() => {
    const paneles = screen.getAllByRole('region', { name: 'Detalle del pedido' }).filter((p) => within(p).queryAllByText(pedido).length > 0)
    expect(paneles).toHaveLength(1)
    return paneles[0]
  })
}

describe('Pedidos: cancelar el móvil desde el panel', () => {
  it('«Cancelar móvil» abre la confirmación; «Volver» no manda nada', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    const panel = await abrirPanel(user, 'C-0001')
    await user.click(within(panel).getByRole('button', { name: 'Cancelar móvil' }))
    const d = within(await screen.findByRole('dialog', { name: '¿Cancelar este móvil?' }))
    expect(d.getByText('Pedido C-0001, IMEI 350000000000011.')).toBeInTheDocument()
    expect(d.getByText('No saldrá en este pedido y su IMEI quedará libre para otro pedido.')).toBeInTheDocument()
    expect(d.getByText('Sustituye a la marca «En revisión».')).toBeInTheDocument()
    await user.click(d.getByRole('button', { name: 'Volver' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '¿Cancelar este móvil?' })).not.toBeInTheDocument())
    expect(puts).toHaveLength(0)
  })

  it('Escape cierra la confirmación sin mandar nada', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    const panel = await abrirPanel(user, 'C-0001')
    await user.click(within(panel).getByRole('button', { name: 'Cancelar móvil' }))
    await screen.findByRole('dialog', { name: '¿Cancelar este móvil?' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '¿Cancelar este móvil?' })).not.toBeInTheDocument())
    expect(puts).toHaveLength(0)
  })

  it('confirmar manda CANCELADO con la nota y la marca anterior; en una fila con falta avisa de que se quita', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    const panel = await abrirPanel(user, 'C-0002')
    await user.click(within(panel).getByRole('button', { name: 'Cancelar móvil' }))
    const d = within(await screen.findByRole('dialog', { name: '¿Cancelar este móvil?' }))
    expect(d.getByText('Se quitará también «Falta por enviar».')).toBeInTheDocument()
    await user.type(d.getByRole('textbox', { name: 'Nota de la cancelación' }), '  no cabe  ')
    await user.click(d.getByRole('button', { name: 'Cancelar el móvil' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toEqual({ id: '2', cuerpo: { marca: 'CANCELADO', nota: 'no cabe', marcaAnterior: '' } })
    await waitFor(() => expect(within(panel).getByRole('button', { name: 'Quitar cancelación' })).toBeInTheDocument())
    expect(within(panel).queryByText(/Envío parcial/)).not.toBeInTheDocument()
  })

  it('una fila cancelada enseña quién y cuándo, sin desplegable ni «Falta por enviar»; «Quitar cancelación» confirma y manda marca null', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    const panel = await abrirPanel(user, 'C-0003')
    expect(within(panel).getByText('cliente lo anula')).toBeInTheDocument()
    expect(within(panel).getByText(/Cancelado por Supertécnico 1 el 12\/11\/2026 09:30/)).toBeInTheDocument()
    expect(within(panel).queryByRole('combobox', { name: 'Marca' })).not.toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: /Falta por enviar|Ya ha salido/ })).not.toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Cancelar móvil' })).not.toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Quitar cancelación' }))
    const d = within(await screen.findByRole('dialog', { name: '¿Quitar la cancelación?' }))
    expect(d.getByText('«Falta por enviar» no vuelve: si hace falta, márcala otra vez.')).toBeInTheDocument()
    await user.click(d.getByRole('button', { name: 'Quitar cancelación' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toEqual({ id: '3', cuerpo: { marca: null, nota: null, marcaAnterior: 'CANCELADO' } })
  })

  it('un 409 del duplicado al quitar la cancelación sale en el aviso y la fila sigue cancelada', async () => {
    const user = userEvent.setup()
    server.use(http.put('*/api/pedidos/filas/:id/marca', () =>
      HttpResponse.json({ message: 'Este IMEI ya está en el pedido 37400 (fila del 20/11)' }, { status: 409 })))
    abrir()
    await esperar()
    const panel = await abrirPanel(user, 'C-0003')
    await user.click(within(panel).getByRole('button', { name: 'Quitar cancelación' }))
    const d = within(await screen.findByRole('dialog', { name: '¿Quitar la cancelación?' }))
    await user.click(d.getByRole('button', { name: 'Quitar cancelación' }))
    expect(await screen.findByText('Pedido C-0003: Este IMEI ya está en el pedido 37400 (fila del 20/11)')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Quitar cancelación' })).toBeInTheDocument()
  })
})
