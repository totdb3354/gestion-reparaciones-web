import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER, SESION_TEC } from '@/test/render'
import { estaConectado } from '@/shared/api/conexion'
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
  it('coloca el título en su línea y "Nuevo cliente" junto al filtro, como el JavaFX', async () => {
    renderConProviders(<ClientesPage />, { sesion: SESION_SUPER })
    await screen.findByText('WEB')
    const filtro = screen.getByRole('button', { name: 'Cliente' })
    const nuevo = screen.getByRole('button', { name: 'Nuevo cliente' })
    const fila = filtro.parentElement
    expect(fila).toBe(nuevo.parentElement)
    expect(fila).not.toContainElement(screen.getByRole('heading', { name: 'Clientes' }))
    // el botón va pegado al filtro, no empujado al borde derecho de la vista
    expect(nuevo).not.toHaveClass('ml-auto')
  })
  it('da a Nombre y Estado el ancho del TableView y rellena el resto sin ensuciar las filas', async () => {
    renderConProviders(<ClientesPage />, { sesion: SESION_TEC })
    await screen.findByText('WEB')
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toHaveStyle({ width: '340px' })
    expect(screen.getByRole('columnheader', { name: 'Estado' })).toHaveStyle({ width: '130px' })
    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
    const fila = screen.getByRole('row', { name: /^WEB Activo$/ })
    const celdas = within(fila).getAllByRole('cell')
    expect(celdas[0]).toHaveStyle({ width: '340px' })
    expect(celdas[1]).toHaveStyle({ width: '130px' })
    // la columna de relleno no aporta texto ni etiqueta: las filas siguen llamándose como sus datos
    expect(celdas[2]).toBeEmptyDOMElement()
    expect(celdas[2]).not.toHaveAttribute('aria-label')
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
    // "Nombre del cliente:" cabe en una línea, como el TextInputDialog del JavaFX
    expect(within(dlg).getByText('Nombre del cliente:')).toHaveClass('whitespace-nowrap')
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
  it('si tiene-telefonos cae sin conexión, el diálogo trae el detalle técnico como en el JavaFX', async () => {
    // Es una consulta suelta (no pasa por el QueryCache), así que el aviso lo pone el `.catch` de MenuCliente:
    // sin tratar el ConexionError mostraría el genérico "Sin conexión con el servidor." en vez del detalle.
    server.use(http.get('*/api/clientes/:id/tiene-telefonos', () => HttpResponse.error()))
    renderConProviders(<ClientesPage />, { sesion: SESION_SUPER })
    await screen.findByText('WEB')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('WEB') })
    const aviso = await screen.findByText(/^Sin conexión con el servidor: .+/)
    expect(aviso.closest('[role="dialog"]')).not.toBeNull()
  })
  it('Desactivar envía PATCH con activo=false y updatedAt', async () => {
    let body: unknown = null
    server.use(http.patch('*/api/clientes/1/activo', async ({ request }) => { body = await request.json(); return new HttpResponse(null, { status: 204 }) }))
    renderConProviders(<ClientesPage />, { sesion: SESION_SUPER })
    await screen.findByText('WEB')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('WEB') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Desactivar' }))
    await waitFor(() => expect(body).toEqual({ activo: false, updatedAt: '2026-09-01T10:00:00' }))
  })
  it('editar sin cambiar el nombre no llama a la API', async () => {
    let llamado = false
    server.use(http.put('*/api/clientes/2', () => { llamado = true; return new HttpResponse(null, { status: 200 }) }))
    renderConProviders(<ClientesPage />, { sesion: SESION_SUPER })
    await screen.findByText('OTRO')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('OTRO') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }))
    const dlg = screen.getByRole('dialog', { name: 'Editar cliente' })
    await userEvent.click(within(dlg).getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(llamado).toBe(false)
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
  it('un fallo de conexión al editar activa el banner y avisa con el diálogo global', async () => {
    renderConProviders(<ClientesPage />, { sesion: SESION_SUPER })
    await screen.findByText('OTRO')
    // El PUT falla y, además, la recarga que dispara `onSettled` también falla (sin conexión real ambas
    // caerían): así `estaConectado()` no se autocura con un refetch de éxito y sirve de barrera estable.
    server.use(
      http.put('*/api/clientes/2', () => HttpResponse.error()),
      http.get('*/api/clientes', () => HttpResponse.error()),
    )
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('OTRO') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }))
    const dlg = screen.getByRole('dialog', { name: 'Editar cliente' })
    const input = within(dlg).getByLabelText('Nombre:')
    await userEvent.clear(input)
    await userEvent.type(input, 'Otros')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(estaConectado()).toBe(false))
    // El diálogo lo pone el MutationCache (la acción del usuario no se ha guardado), no `avisarEdicion`:
    // la vista sigue callándose ante los errores que ya gestiona un mecanismo global, así que solo hay uno.
    const error = await screen.findByRole('dialog', { name: 'Error' })
    expect(within(error).getByText(/^Sin conexión con el servidor: .+/)).toBeInTheDocument()
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
  it('si falla la carga muestra el error en un diálogo (y no finge una lista vacía)', async () => {
    server.use(http.get('*/api/clientes', () => HttpResponse.json({ message: 'Sin permisos de prueba' }, { status: 403 })))
    renderConProviders(<ClientesPage />, { sesion: SESION_TEC })
    expect(await screen.findByRole('dialog', { name: 'Error' })).toBeInTheDocument()
    expect(screen.getByText('No tienes permisos para realizar esta acción.')).toBeInTheDocument()
  })
})
