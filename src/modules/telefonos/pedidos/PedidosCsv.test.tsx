import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
// eslint-disable-next-line no-restricted-imports -- "Descargar CSV" vive en el menú de usuario del AppLayout real (patrón de StockPage.test.tsx).
import { AppLayout } from '@/app/shell/AppLayout'
import * as csv from '@/shared/lib/csv'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { estadoNsys, fila, fuente } from '../test/fabrica'
import { congelarHoy } from '../test/hoy'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'

congelarHoy()

/** «Descargar CSV» del menú de usuario en Pedidos: baja lo que se ve, con los filtros puestos. */
const FILAS = [
  fila({ idFila: 1, fecha: '2026-11-20', plataforma: 'Web', sku: 'i14128NegroA', pedido: 'P-1' }),
  fila({ idFila: 2, fecha: '2026-11-21', plataforma: 'Web', sku: 'i12064BlancoB', imei: '350000000000002', pedido: 'P-2' }),
  fila({ idFila: 3, fecha: '2026-11-22', plataforma: 'Web', sku: 'i13128AzulA', pedido: 'P-3' }),
]
let respuesta = FILAS

beforeEach(() => {
  respuesta = FILAS
  estadoPedidos.reset()
  server.use(
    http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: respuesta, hayMas: false })),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    http.get('*/api/solicitudes/count', () => HttpResponse.json({ value: 0 })),
    http.get('*/api/solicitudes-stock/count', () => HttpResponse.json({ value: 0 })),
    http.get('*/api/solicitudes', () => HttpResponse.json([])),
    http.get('*/api/solicitudes-stock', () => HttpResponse.json([])),
    http.get('*/api/componentes/gestionados', () => HttpResponse.json([])),
  )
})

const abrir = () => renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos', layout: <AppLayout /> })
const abrirMenu = async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: /Hola,/ }))

describe('Pedidos: Descargar CSV', () => {
  it('baja solo las filas que deja el filtro, en el orden de la tabla', async () => {
    const descargar = vi.spyOn(csv, 'descargarCsv').mockResolvedValue(undefined)
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: '2 sin IMEI' }))
    await abrirMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Descargar CSV' }))
    const [nombre, cabeceras, filas] = descargar.mock.calls[0]
    expect(nombre).toBe('pedidos_telefonos')
    expect(cabeceras[0]).toBe('Fecha')
    const enPantalla = screen.getAllByRole('row').slice(1).map((r) => r.querySelectorAll('td')[4].textContent)
    expect(filas.map((f) => f[4])).toEqual(enPantalla)
    expect(filas.map((f) => f[4]).sort()).toEqual(['P-1', 'P-3'])
    descargar.mockRestore()
  })

  it('sin filas a la vista la opción sale deshabilitada', async () => {
    respuesta = []
    const user = userEvent.setup()
    abrir()
    await screen.findByText('No hay pedidos en este periodo.')
    await abrirMenu(user)
    expect(await screen.findByRole('menuitem', { name: 'Descargar CSV' })).toHaveAttribute('aria-disabled', 'true')
  })
})
