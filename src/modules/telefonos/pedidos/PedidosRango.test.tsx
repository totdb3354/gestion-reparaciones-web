import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { estadoNsys, fila, fuente } from '../test/fabrica'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'
import { congelarHoy } from '../test/hoy'

congelarHoy()

/** 0.9.38 (spec «rango estricto»): el servidor manda el periodo y, además, las abiertas de cualquier fecha; la web las separa. */
const RECIBIDAS = [
  fila({ idFila: 1, fecha: '2026-11-05', sku: 'iFueraRetraso', fechaSalida: '2026-11-07' }),
  fila({ idFila: 2, fecha: '2026-11-14', sku: 'iFueraCancelada', marca: 'CANCELADO' }),
  fila({ idFila: 3, fecha: '2026-11-16', sku: 'iFueraPendiente', fechaSalida: '2026-11-24' }),
  fila({ idFila: 4, fecha: '2026-11-20', sku: 'iDentroPendiente' }),
  fila({ idFila: 5, fecha: '2026-11-21', sku: 'iDentroEnviada', estado: 'ENVIADA', impresaEn: '2026-11-21T10:00:00', tieneEtiqueta: true, imei: '350000000000002' }),
]

beforeEach(() => {
  estadoPedidos.reset()
  estadoPedidos.set((s) => ({ ...s, periodo: 'rango', rango: { desde: '2026-11-20', hasta: '2026-11-23' } }))
  server.use(
    http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: RECIBIDAS, hayMas: false })),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
  )
})

const abrir = () => renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
const tabla = () => screen.getByRole('region', { name: 'Tabla de pedidos' })
const aviso = () => screen.queryByRole('status', { name: 'Pendientes fuera del periodo' })

describe('Pedidos: el periodo es estricto', () => {
  it('la tabla enseña solo las del periodo y los contadores cuentan esas', async () => {
    abrir()
    await screen.findByRole('button', { name: '2 filas' })
    expect(screen.getByRole('button', { name: '1 pendientes' })).toBeInTheDocument()
    expect(within(tabla()).getByText('iDentroPendiente')).toBeInTheDocument()
    expect(within(tabla()).getByText('iDentroEnviada')).toBeInTheDocument()
    for (const sku of ['iFueraRetraso', 'iFueraCancelada', 'iFueraPendiente']) expect(within(tabla()).queryByText(sku)).toBeNull()
  })

  it('el aviso cuenta los pendientes de fuera (sin la cancelada) y los que van con retraso', async () => {
    abrir()
    await screen.findByRole('button', { name: '2 filas' })
    expect(aviso()).toHaveTextContent('Hay 2 pendientes de antes del 20/11 (1 con retraso).')
  })

  it('«Ver» enseña solo esos pendientes con su etiqueta; quitarla vuelve al periodo', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByRole('button', { name: '2 filas' })
    await user.click(within(aviso()!).getByRole('button', { name: 'Ver' }))
    expect(await screen.findByRole('button', { name: '2 filas' })).toBeInTheDocument()
    expect(within(tabla()).getByText('iFueraRetraso')).toBeInTheDocument()
    expect(within(tabla()).getByText('iFueraPendiente')).toBeInTheDocument()
    expect(within(tabla()).queryByText('iDentroPendiente')).toBeNull()
    expect(within(tabla()).queryByText('iFueraCancelada')).toBeNull()
    expect(screen.getByRole('button', { name: '1 con retraso' })).toBeInTheDocument()
    expect(aviso()).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Quitar filtro Pendientes fuera del periodo' }))
    expect(within(tabla()).getByText('iDentroPendiente')).toBeInTheDocument()
    expect(aviso()).not.toBeNull()
  })

  it('cambiar el periodo o «Quitar filtros» deja de ver los de fuera', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByRole('button', { name: '2 filas' })
    await user.click(within(aviso()!).getByRole('button', { name: 'Ver' }))
    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    expect(within(tabla()).getByText('iDentroPendiente')).toBeInTheDocument()
    await user.click(within(aviso()!).getByRole('button', { name: 'Ver' }))
    await user.selectOptions(screen.getByLabelText('Periodo:'), 'Último mes')
    expect(estadoPedidos.get().verFuera).toBe(false)
  })

  it('sin pendientes de fuera no hay aviso', async () => {
    server.use(http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: RECIBIDAS.slice(3), hayMas: false })))
    abrir()
    await screen.findByRole('button', { name: '2 filas' })
    expect(aviso()).toBeNull()
  })

  it('con una búsqueda el periodo no se aplica: salen todas y no hay aviso', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByRole('button', { name: '2 filas' })
    await user.type(screen.getByLabelText('Buscar en todo el historial'), 'i1')
    expect(await screen.findByRole('button', { name: '5 filas' }, { timeout: 3000 })).toBeInTheDocument()
    expect(aviso()).toBeNull()
  })
})
