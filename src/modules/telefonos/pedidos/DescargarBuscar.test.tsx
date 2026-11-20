import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { DescargarBuscar, nombreListado } from './DescargarBuscar'

let pedidas: string[] = []
let guardados: string[] = []

beforeEach(() => {
  pedidas = []
  guardados = []
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { guardados.push(this.download) })
})
afterEach(() => { vi.restoreAllMocks() })

const xlsx = () => new HttpResponse(new Blob(['PK']), {
  headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'attachment; filename="Listado 18-11 09h30.xlsx"',
    'X-Filas': '3',
  },
})

describe('DescargarBuscar («Listado»)', () => {
  it('el nombre lleva día y hora de Madrid sin «:»', () => {
    expect(nombreListado(new Date('2026-11-18T08:30:00Z'))).toBe('Listado 18-11 09h30.xlsx')
    expect(nombreListado(new Date('2026-07-01T22:05:00Z'))).toBe('Listado 02-07 00h05.xlsx')
  })

  it('un clic pide el listado sin plataforma y guarda el xlsx con el nombre del Content-Disposition', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/pedidos/buscar', ({ request }) => {
      pedidas.push(new URL(request.url).search)
      return xlsx()
    }))
    renderConProviders(<DescargarBuscar />, { sesion: SESION_SUPER })
    await user.click(screen.getByRole('button', { name: 'Listado' }))
    await waitFor(() => expect(guardados).toEqual(['Listado 18-11 09h30.xlsx']))
    expect(pedidas).toEqual([''])
  })

  it('un error sale por el diálogo de errores de siempre', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/pedidos/buscar', () => HttpResponse.json({ message: 'No se pudo generar' }, { status: 422 })))
    renderConProviders(<DescargarBuscar />, { sesion: SESION_SUPER })
    await user.click(screen.getByRole('button', { name: 'Listado' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('No se pudo generar')
    expect(guardados).toEqual([])
  })

  it('el botón está deshabilitado mientras descarga', async () => {
    const user = userEvent.setup()
    let soltar: () => void = () => {}
    server.use(http.get('*/api/pedidos/buscar', async () => {
      await new Promise<void>((r) => { soltar = r })
      return xlsx()
    }))
    renderConProviders(<DescargarBuscar />, { sesion: SESION_SUPER })
    await user.click(screen.getByRole('button', { name: 'Listado' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Listado' })).toBeDisabled())
    soltar()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Listado' })).toBeEnabled())
    expect(guardados).toEqual(['Listado 18-11 09h30.xlsx'])
  })
})
