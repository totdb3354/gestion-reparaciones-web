import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Route } from 'react-router'
import { renderConProviders, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { AppLayout } from './AppLayout'

describe('barra superior (calco de MainView)', () => {
  it('muestra título, versión, los 4 botones y el saludo para cualquier rol', () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC })
    expect(screen.getByText('FSGR:')).toBeInTheDocument()
    expect(screen.getByText(/Gestión de Stock y Reparaciones V\.\d+\.\d+\.\d+/)).toBeInTheDocument()
    for (const b of ['Reparaciones', 'Stock', 'Estadísticas', 'Clientes']) {
      expect(screen.getByRole('link', { name: b })).toBeInTheDocument()
    }
    expect(screen.getByText('Hola, zara')).toBeInTheDocument()
  })
  it('el menú de usuario de un técnico no tiene opciones de admin y "Descargar CSV" va deshabilitado', async () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC })
    await userEvent.click(screen.getByRole('button', { name: /Hola, zara/ }))
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
  it('la campana no se muestra en este sub-proyecto (ni al supertécnico)', () => {
    renderConProviders(<AppLayout />, { sesion: SESION_SUPER })
    expect(screen.queryByRole('button', { name: /solicitudes/i })).not.toBeInTheDocument()
  })
  it('Cerrar Sesión borra la sesión y lleva al login', async () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC, rutas: <Route path="/login" element={<p>LOGIN</p>} /> })
    await userEvent.click(screen.getByRole('button', { name: /Hola, zara/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cerrar Sesión' }))
    expect(await screen.findByText('LOGIN')).toBeInTheDocument()
    expect(sessionStorage.getItem('fsgr.sesion')).toBeNull()
  })
})
