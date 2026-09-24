import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Route } from 'react-router'
import { act } from '@testing-library/react'
import { ultimaRutaStock } from '@/modules/almacen/estado'
import { handlersNotificaciones } from '@/modules/taller/notificaciones/test/handlers'
import { renderConProviders, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { AppLayout } from './AppLayout'

describe('barra superior (calco de MainView)', () => {
  it('muestra título, versión, los 4 botones y el saludo para cualquier rol', () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC })
    expect(screen.getByText('FSGR:')).toBeInTheDocument()
    expect(screen.getByText(/Gestión de Stock y Reparaciones V\.\d+\.\d+\.\d+/)).toBeInTheDocument()
    for (const b of ['Reparaciones', 'Stock', 'Estadísticas', 'Clientes']) {
      expect(screen.getByRole('link', { name: b })).toBeInTheDocument()
    }
    expect(screen.getByText('Hola, tecnico_n')).toBeInTheDocument()
  })
  it('"Stock" lleva a la última pestaña de Stock visitada (caché de vista del JavaFX) y no se marca fuera de /stock', () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC, ruta: '/reparaciones' })
    expect(screen.getByRole('link', { name: 'Stock' })).toHaveAttribute('href', '/stock')
    act(() => ultimaRutaStock.set('/stock/proveedores'))
    expect(screen.getByRole('link', { name: 'Stock' })).toHaveAttribute('href', '/stock/proveedores')
    expect(screen.getByRole('link', { name: 'Stock' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Reparaciones' })).toHaveAttribute('aria-current', 'page')
  })
  it.each(['/stock', '/stock/pedidos', '/stock/proveedores'])('"Stock" sigue activo en %s aunque apunte a otra pestaña', (ruta) => {
    ultimaRutaStock.set(ruta === '/stock' ? '/stock/proveedores' : '/stock')
    renderConProviders(<AppLayout />, { sesion: SESION_TEC, ruta })
    const stock = screen.getByRole('link', { name: 'Stock' })
    expect(stock).toHaveAttribute('aria-current', 'page')
    expect(stock).toHaveClass('bg-azul-noche', 'text-texto-nav-activo')
    expect(screen.getByRole('link', { name: 'Reparaciones' })).not.toHaveAttribute('aria-current')
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
  it('el admin ve además "Gestionar técnicos" y "Ver logs"', async () => {
    renderConProviders(<AppLayout />, { sesion: SESION_ADMIN })
    await userEvent.click(screen.getByRole('button', { name: /Hola, admin/ }))
    expect(screen.getByRole('menuitem', { name: 'Gestionar técnicos' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Ver logs' })).toBeInTheDocument()
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
      sessionStorage.clear()
    }
  })
  it('Cerrar Sesión borra la sesión y lleva al login', async () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC, rutas: <Route path="/login" element={<p>LOGIN</p>} /> })
    await userEvent.click(screen.getByRole('button', { name: /Hola, tecnico_n/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cerrar Sesión' }))
    expect(await screen.findByText('LOGIN')).toBeInTheDocument()
    expect(sessionStorage.getItem('fsgr.sesion')).toBeNull()
  })
})
