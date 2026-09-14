import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER, SESION_TEC } from '@/test/render'
import { ClientesPage } from './ClientesPage'

const clientes = [
  { idCli: 1, nombre: 'WEB', activo: true, updatedAt: '2026-09-01T10:00:00' },
  { idCli: 2, nombre: 'OTRO', activo: true, updatedAt: '2026-09-01T10:00:00' },
  { idCli: 3, nombre: 'Antiguo', activo: false, updatedAt: '2026-09-01T10:00:00' },
]

beforeEach(() => {
  server.use(
    http.get('*/api/clientes', () => HttpResponse.json(clientes)),
    http.get('*/api/clientes/:id/tiene-telefonos', ({ params }) => HttpResponse.json({ value: params.id === '1' })),
  )
})

describe('ClientesPage', () => {
  it('lista nombre y estado, y el filtro solo ofrece activos', async () => {
    renderConProviders(<ClientesPage />, { sesion: SESION_SUPER })
    expect(await screen.findByText('Antiguo')).toBeInTheDocument()
    expect(screen.getAllByText('Activo')).toHaveLength(2)
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cliente' }))
    expect(screen.getByRole('checkbox', { name: 'WEB' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Antiguo' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'WEB' }))
    await userEvent.keyboard('{Escape}')
    const tabla = within(screen.getByRole('table'))
    expect(tabla.queryByText('OTRO')).not.toBeInTheDocument()
    expect(tabla.queryByText('Antiguo')).not.toBeInTheDocument()
    expect(tabla.getByText('WEB')).toBeInTheDocument()
  })
  it('un técnico no ve "Nuevo cliente" ni menú contextual', async () => {
    renderConProviders(<ClientesPage />, { sesion: SESION_TEC })
    await screen.findByText('WEB')
    expect(screen.queryByRole('button', { name: 'Nuevo cliente' })).not.toBeInTheDocument()
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('WEB') })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
  it('crea un cliente con el diálogo "Nuevo cliente" y recarga', async () => {
    let creado: unknown = null
    server.use(http.post('*/api/clientes', async ({ request }) => { creado = await request.json(); return new HttpResponse(null, { status: 201 }) }))
    renderConProviders(<ClientesPage />, { sesion: SESION_SUPER })
    await screen.findByText('WEB')
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo cliente' }))
    const dlg = screen.getByRole('dialog', { name: 'Nuevo cliente' })
    await userEvent.type(within(dlg).getByLabelText('Nombre del cliente:'), '  Amazon  ')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(creado).toEqual({ nombre: 'Amazon' }))
  })
  it('el menú contextual ofrece Desactivar/Editar y Borrar solo si no tiene teléfonos', async () => {
    renderConProviders(<ClientesPage />, { sesion: SESION_SUPER })
    await screen.findByText('WEB')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('WEB') })
    expect(await screen.findByRole('menuitem', { name: 'Desactivar' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Borrar' })).not.toBeInTheDocument())
    await userEvent.keyboard('{Escape}')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('OTRO') })
    expect(await screen.findByRole('menuitem', { name: 'Borrar' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Desactivar' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('Antiguo') })
    expect(await screen.findByRole('menuitem', { name: 'Activar' })).toBeInTheDocument()
  })
  it('editar envía nombre y updatedAt; un 409 muestra el aviso y recarga', async () => {
    let body: unknown = null
    server.use(http.put('*/api/clientes/2', async ({ request }) => { body = await request.json(); return new HttpResponse(null, { status: 409 }) }))
    renderConProviders(<ClientesPage />, { sesion: SESION_SUPER })
    await screen.findByText('OTRO')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('OTRO') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }))
    const dlg = screen.getByRole('dialog', { name: 'Editar cliente' })
    const input = within(dlg).getByLabelText('Nombre:')
    expect(input).toHaveValue('OTRO')
    await userEvent.clear(input)
    await userEvent.type(input, 'Otros')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Aceptar' }))
    expect(await screen.findByText('El cliente fue modificado por otro usuario. Se recargan los datos.')).toBeInTheDocument()
    expect(body).toEqual({ nombre: 'Otros', updatedAt: '2026-09-01T10:00:00' })
  })
  it('borrar pide confirmación con el texto exacto y llama a DELETE', async () => {
    let borrado = false
    server.use(http.delete('*/api/clientes/2', () => { borrado = true; return new HttpResponse(null, { status: 204 }) }))
    renderConProviders(<ClientesPage />, { sesion: SESION_SUPER })
    await screen.findByText('OTRO')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('OTRO') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Borrar' }))
    expect(screen.getByRole('dialog', { name: 'Borrar cliente' })).toBeInTheDocument()
    expect(screen.getByText('¿Seguro que quieres borrar el cliente "OTRO"? Esta acción no se puede deshacer.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(borrado).toBe(true))
  })
  it('sin clientes muestra el placeholder', async () => {
    server.use(http.get('*/api/clientes', () => HttpResponse.json([])))
    renderConProviders(<ClientesPage />, { sesion: SESION_TEC })
    expect(await screen.findByText('Sin clientes')).toBeInTheDocument()
  })
})
