import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { importacion, listaImportaciones } from '../test/fabrica'
import { PildoraNsys } from './PildoraNsys'

const abrirPildora = () => renderConProviders(<PildoraNsys />, { sesion: SESION_SUPER })
const popover = () => screen.queryByRole('dialog', { name: 'Importaciones de NSYS' })

describe('píldora de NSYS: lista de importaciones (spec 0.9.18 §4.11)', () => {
  it('el botón lleva el texto de la píldora como nombre: Chromium no lo saca del role=status de dentro (E2E de preprod)', async () => {
    abrirPildora()
    const estado = await screen.findByRole('status')
    await waitFor(() => expect(estado.textContent).not.toMatch(/comprobando/))
    expect(estado.textContent).toMatch(/^NSYS: /)
    expect(estado.closest('button')).toHaveAttribute('aria-label', estado.textContent)
  })

  it('al pulsarla abre las últimas importaciones con su resultado, sus cambios, sus segundos, el motivo y los huecos', async () => {
    server.use(http.get('*/api/stock-telefonos/importaciones', () => HttpResponse.json(listaImportaciones({ importaciones: [
      importacion({ fechaExportacion: '2026-10-16T13:31:00', resultado: 'EN_CURSO', cambios: 0, segundos: null }),
      importacion({ fechaExportacion: '2026-10-16T13:01:00', resultado: 'OK', cambios: 1, segundos: 17 }),
      importacion({ fechaExportacion: '2026-10-16T12:01:00', resultado: 'RECHAZADO', cambios: 0, segundos: 2, motivo: 'Trae 10 filas…' }),
      importacion({ fechaExportacion: '2026-10-16T11:31:00', resultado: 'ERROR', cambios: 0, segundos: 4, motivo: 'Error al leer de Drive o al guardar; ver el registro del servidor' }),
    ] }))))
    const user = userEvent.setup()
    abrirPildora()
    await user.click(await screen.findByRole('button', { name: /^NSYS: / }))
    const filas = await within(await screen.findByRole('dialog', { name: 'Importaciones de NSYS' })).findAllByRole('listitem')
    expect(filas).toHaveLength(5)
    expect(filas[0]).toHaveTextContent('en curso')
    expect(within(filas[0]).getByText('en curso')).toHaveClass('bg-badge-neutro-bg')
    expect(filas[1]).toHaveTextContent('1 cambio')
    expect(filas[1]).toHaveTextContent('17 s')
    expect(within(filas[1]).getByText('OK')).toHaveClass('bg-fila-recibido-bg')
    expect(filas[2].textContent).toMatch(/^⚠ falta un Items entre (16\/10 )?12:01 y (16\/10 )?13:01$/)
    expect(within(filas[3]).getByText('RECHAZADO')).toHaveClass('bg-fila-solicitud-bg')
    expect(filas[3]).toHaveTextContent('Trae 10 filas…')
    expect(within(filas[4]).getByText('ERROR')).toHaveClass('bg-urgente-bg')
    expect(filas[4]).toHaveTextContent('Error al leer de Drive o al guardar; ver el registro del servidor')
  })

  it('pide la lista al abrirse, no la vuelve a pedir mientras sigue abierta y pide otra al volver a abrirla', async () => {
    let pedidas = 0
    server.use(http.get('*/api/stock-telefonos/importaciones', () => {
      pedidas++
      return HttpResponse.json(listaImportaciones())
    }))
    const user = userEvent.setup()
    abrirPildora()
    const boton = await screen.findByRole('button', { name: /^NSYS: / })
    await user.click(boton)
    expect(await within(await screen.findByRole('dialog', { name: 'Importaciones de NSYS' })).findAllByRole('listitem')).toHaveLength(1)
    expect(pedidas).toBe(1)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(popover()).not.toBeInTheDocument())
    await user.click(boton)
    await screen.findByRole('dialog', { name: 'Importaciones de NSYS' })
    await waitFor(() => expect(pedidas).toBe(2))
    await user.click(document.body)
    await waitFor(() => expect(popover()).not.toBeInTheDocument())
  })

  it('la línea del histórico sale con histórico y no sale sin él', async () => {
    const user = userEvent.setup()
    const { unmount } = abrirPildora()
    await user.click(await screen.findByRole('button', { name: /^NSYS: / }))
    expect(await screen.findByText('Todavía no hay importaciones.')).toBeInTheDocument()
    expect(screen.queryByText(/^Histórico/)).not.toBeInTheDocument()
    unmount()
    server.use(http.get('*/api/stock-telefonos/importaciones', () => HttpResponse.json(listaImportaciones({
      historico: { total: 2, hechos: 1, ultimo: '2024-01-02T09:01:00', hasta: '2026-10-16T14:31:00' },
    }))))
    abrirPildora()
    await user.click(await screen.findByRole('button', { name: /^NSYS: / }))
    expect(await screen.findByText('Histórico: 1 fichero hecho, hasta el Items del 02/01/2024; termina en el del 16/10/2026')).toBeInTheDocument()
  })
})
