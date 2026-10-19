import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { Route } from 'react-router'
import { handlersNotificaciones } from '@/modules/taller/notificaciones/test/handlers'
import { renderConProviders, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { AppLayout } from './AppLayout'

describe('barra superior (calco de MainView)', () => {
  it('muestra título, versión y saludo, y ya no tiene botones de sección (0.9.14: la navegación va en la columna)', () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC })
    expect(screen.getByText('FSGR:')).toBeInTheDocument()
    expect(screen.getByText(/Gestión de Stock y Reparaciones V\.\d+\.\d+\.\d+/)).toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/'])
    expect(screen.getByText('Hola, tecnico_n')).toBeInTheDocument()
  })
  it('el menú de usuario de un técnico no tiene opciones de admin y "Descargar CSV" va deshabilitado', async () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC })
    await userEvent.click(screen.getByRole('button', { name: /Hola, tecnico_n/ }))
    expect(screen.queryByText('Gestionar técnicos')).not.toBeInTheDocument()
    expect(screen.queryByText('Ver logs')).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Descargar CSV' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('menuitem', { name: 'Cambiar contraseña' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Cerrar Sesión' })).toBeInTheDocument()
  })
  it('el menú del admin ya no tiene Gestión: Técnicos y Logs están en la columna (0.9.14)', async () => {
    renderConProviders(<AppLayout />, { sesion: SESION_ADMIN })
    await userEvent.click(screen.getByRole('button', { name: /Hola, admin/ }))
    expect(screen.queryByRole('menuitem', { name: 'Gestionar técnicos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Ver logs' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Cambiar contraseña' })).toBeInTheDocument()
  })
  it('"Cambiar contraseña" ya no navega a /cuenta/cambiar-password (la ruta desaparece; el diálogo lo abre en el sitio)', async () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC, ruta: '/stock', rutas: <Route path="/cuenta/cambiar-password" element={<p>CUENTA</p>} /> })
    await userEvent.click(screen.getByRole('button', { name: /Hola, tecnico_n/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cambiar contraseña' }))
    expect(screen.queryByText('CUENTA')).not.toBeInTheDocument()
    expect(await screen.findByRole('dialog', { name: 'Cambiar contraseña' })).toBeInTheDocument()
  })
  it('TopBar: la campana va a la izquierda del usuario, solo para el supertécnico', async () => {
    server.use(...handlersNotificaciones())
    renderConProviders(<AppLayout />, { sesion: SESION_SUPER })
    const campana = await screen.findByRole('button', { name: 'Notificaciones' })
    const usuario = screen.getByRole('button', { name: /Hola, tecnico_f/ })
    expect(campana.compareDocumentPosition(usuario) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(campana.parentElement).toBe(usuario.parentElement)
    // Separación de 10 px: el gap de la barra
    expect(campana.parentElement).toHaveClass('gap-2.5')
  })
  it('técnico y admin no tienen campana', () => {
    for (const sesion of [SESION_TEC, SESION_ADMIN]) {
      const { unmount } = renderConProviders(<AppLayout />, { sesion })
      expect(screen.queryByRole('button', { name: 'Notificaciones' })).not.toBeInTheDocument()
      unmount()
      localStorage.clear()
    }
  })
  it('Cerrar Sesión borra la sesión y lleva al login', async () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC, rutas: <Route path="/login" element={<p>LOGIN</p>} /> })
    await userEvent.click(screen.getByRole('button', { name: /Hola, tecnico_n/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cerrar Sesión' }))
    expect(await screen.findByText('LOGIN')).toBeInTheDocument()
    expect(localStorage.getItem('fsgr.sesion')).toBeNull()
  })
})

describe('"Cambiar contraseña" desde el menú de usuario (spec §6.3, G6)', () => {
  // En /reparaciones el lateral de TECNICO y SUPERTECNICO pide los contadores: sin handler, MSW corta la petición,
  // sale el diálogo modal de conexión y el menú queda con pointer-events: none. Mismo handler que la Task 13.
  beforeEach(() => {
    server.use(http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json({ reparaciones: 0, glass: 0, pulidos: 0 })))
  })
  it.each([
    ['técnico', SESION_TEC, /Hola, tecnico_n/],
    ['supertécnico', SESION_SUPER, /Hola, tecnico_f/],
    ['admin', SESION_ADMIN, /Hola, admin/],
  ])('%s: abre el diálogo sobre la vista actual, sin navegar', async (_rol, sesion, saludo) => {
    server.use(...handlersNotificaciones())
    renderConProviders(<AppLayout />, {
      sesion, ruta: '/reparaciones',
      rutas: <Route path="/cuenta/cambiar-password" element={<p>RUTA VIEJA</p>} />,
    })
    await userEvent.click(screen.getByRole('button', { name: saludo }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cambiar contraseña' }))
    const dlg = await screen.findByRole('dialog', { name: 'Cambiar contraseña' })
    expect(within(dlg).getByLabelText('Contraseña actual')).toBeInTheDocument()
    expect(screen.queryByText('RUTA VIEJA')).not.toBeInTheDocument()
    expect(screen.getByText('FSGR:')).toBeInTheDocument()
  })
  it('"Cancelar" lo cierra y el menú se puede volver a abrir (sin pointer-events colgados)', async () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC, ruta: '/reparaciones' })
    await userEvent.click(screen.getByRole('button', { name: /Hola, tecnico_n/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cambiar contraseña' }))
    const dlg = await screen.findByRole('dialog', { name: 'Cambiar contraseña' })
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cambiar contraseña' })).not.toBeInTheDocument())
    expect(document.body.style.pointerEvents).not.toBe('none')
    await userEvent.click(screen.getByRole('button', { name: /Hola, tecnico_n/ }))
    expect(await screen.findByRole('menuitem', { name: 'Cambiar contraseña' })).toBeInTheDocument()
  })
  it('guardar con éxito cierra el diálogo, avisa y deja al usuario en la misma vista', async () => {
    server.use(http.patch('*/api/auth/cambiar-password', () => new HttpResponse(null, { status: 204 })))
    renderConProviders(<AppLayout />, { sesion: SESION_TEC, ruta: '/reparaciones' })
    await userEvent.click(screen.getByRole('button', { name: /Hola, tecnico_n/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cambiar contraseña' }))
    const dlg = await screen.findByRole('dialog', { name: 'Cambiar contraseña' })
    await userEvent.type(within(dlg).getByLabelText('Contraseña actual'), 'secreta1')
    await userEvent.type(within(dlg).getByLabelText('Nueva contraseña'), 'nueva-larga-123')
    await userEvent.type(within(dlg).getByLabelText('Confirmar nueva contraseña'), 'nueva-larga-123')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('dialog', { name: 'Mensaje' })).toHaveTextContent('Contraseña cambiada correctamente.')
    expect(screen.queryByRole('dialog', { name: 'Cambiar contraseña' })).not.toBeInTheDocument()
    expect(screen.getByText('Hola, tecnico_n')).toBeInTheDocument()
  })
})

describe('indicador de NSYS en la barra superior (0.9.18, spec §4.12)', () => {
  const estado = (nivel: string) => ({ ultimaExportacion: nivel === 'SIN_DATOS' ? null : '2026-10-16T13:31:00', nivel, ultimoFallo: null, motivoFallo: null })

  it.each([['supertécnico', SESION_SUPER], ['admin', SESION_ADMIN]])('%s: sale con SIN_DATOS y lleva a Stock de teléfonos', async (_rol, sesion) => {
    server.use(...handlersNotificaciones(), http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estado('SIN_DATOS'))))
    renderConProviders(<AppLayout />, { sesion, rutas: <Route path="/telefonos/stock" element={<p>STOCK DE TELÉFONOS</p>} /> })
    await userEvent.click(await screen.findByRole('link', { name: 'NSYS sin datos' }))
    expect(await screen.findByText('STOCK DE TELÉFONOS')).toBeInTheDocument()
  })

  it.each(['RETRASO', 'OK'])('con %s no sale', async (nivel) => {
    let pedidas = 0
    server.use(...handlersNotificaciones(), http.get('*/api/stock-telefonos/estado', () => {
      pedidas++
      return HttpResponse.json(estado(nivel))
    }))
    renderConProviders(<AppLayout />, { sesion: SESION_SUPER })
    await waitFor(() => expect(pedidas).toBe(1))
    expect(screen.queryByRole('link', { name: 'NSYS sin datos' })).not.toBeInTheDocument()
  })

  it('el técnico no pregunta el estado de NSYS ni ve el indicador', async () => {
    let pedidas = 0
    server.use(http.get('*/api/stock-telefonos/estado', () => {
      pedidas++
      return HttpResponse.json(estado('SIN_DATOS'))
    }))
    renderConProviders(<AppLayout />, { sesion: SESION_TEC })
    expect(screen.getByText('FSGR:')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 50))
    expect(pedidas).toBe(0)
    expect(screen.queryByRole('link', { name: 'NSYS sin datos' })).not.toBeInTheDocument()
  })
})
