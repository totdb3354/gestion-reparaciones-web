import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { DescargarBuscar } from './DescargarBuscar'

let pedidas: (string | null)[] = []
let guardados: string[] = []

beforeEach(() => {
  pedidas = []
  guardados = []
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { guardados.push(this.download) })
})
afterEach(() => { vi.restoreAllMocks() })

const xlsx = (plataforma: string) => new HttpResponse(new Blob(['PK']), {
  headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="Buscar ${plataforma} 18-11.xlsx"`,
    'X-Filas': '3',
  },
})

describe('DescargarBuscar', () => {
  it('el botón abre un menú con AMZ, FNSK y Webs', async () => {
    const user = userEvent.setup()
    renderConProviders(<DescargarBuscar />, { sesion: SESION_SUPER })
    await user.click(screen.getByRole('button', { name: 'Descargar para buscar' }))
    expect(screen.getByRole('button', { name: 'AMZ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'FNSK' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Webs' })).toBeInTheDocument()
  })

  it('elegir FNSK pide plataforma=FNSK y guarda el xlsx con el nombre del Content-Disposition', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/pedidos/buscar', ({ request }) => {
      const p = new URL(request.url).searchParams.get('plataforma')
      pedidas.push(p)
      return xlsx(p ?? '')
    }))
    renderConProviders(<DescargarBuscar />, { sesion: SESION_SUPER })
    await user.click(screen.getByRole('button', { name: 'Descargar para buscar' }))
    await user.click(screen.getByRole('button', { name: 'FNSK' }))
    await waitFor(() => expect(guardados).toEqual(['Buscar FNSK 18-11.xlsx']))
    expect(pedidas).toEqual(['FNSK'])
  })

  it('un error sale por el diálogo de errores de siempre', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/pedidos/buscar', () => HttpResponse.json({ message: 'Plataforma no valida' }, { status: 422 })))
    renderConProviders(<DescargarBuscar />, { sesion: SESION_SUPER })
    await user.click(screen.getByRole('button', { name: 'Descargar para buscar' }))
    await user.click(screen.getByRole('button', { name: 'AMZ' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Plataforma no valida')
    expect(guardados).toEqual([])
  })

  it('el botón está deshabilitado mientras descarga', async () => {
    const user = userEvent.setup()
    let soltar: () => void = () => {}
    server.use(http.get('*/api/pedidos/buscar', async () => {
      await new Promise<void>((r) => { soltar = r })
      return xlsx('WEBS')
    }))
    renderConProviders(<DescargarBuscar />, { sesion: SESION_SUPER })
    await user.click(screen.getByRole('button', { name: 'Descargar para buscar' }))
    await user.click(screen.getByRole('button', { name: 'Webs' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Descargar para buscar/ })).toBeDisabled())
    soltar()
    await waitFor(() => expect(screen.getByRole('button', { name: /Descargar para buscar/ })).toBeEnabled())
    expect(guardados).toEqual(['Buscar WEBS 18-11.xlsx'])
  })
})
