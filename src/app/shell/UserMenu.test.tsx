import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { handlersNotificaciones } from '@/modules/taller/notificaciones/test/handlers'
import { CLAVE_TEXTO } from '@/shared/lib/useTextoGrande'
import { renderConProviders, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { AppLayout } from './AppLayout'

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.texto
})

describe('"Texto grande" en el menú de usuario (web 0.8.3)', () => {
  it.each([
    ['TECNICO', SESION_TEC],
    ['SUPERTECNICO', SESION_SUPER],
    ['ADMIN', SESION_ADMIN],
  ] as const)('%s: el ítem está tras "Cambiar contraseña" y antes de "Cerrar Sesión", desmarcado', async (_rol, sesion) => {
    server.use(...handlersNotificaciones())
    renderConProviders(<AppLayout />, { sesion })
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`Hola, ${sesion.nombreUsuario}`) }))
    const item = screen.getByRole('menuitemcheckbox', { name: 'Texto grande' })
    expect(item).toHaveAttribute('aria-checked', 'false')
    const nombres = Array.from(screen.getByRole('menu').querySelectorAll('[role^="menuitem"]')).map((e) => e.textContent)
    const i = nombres.indexOf('Texto grande')
    expect(nombres[i - 1]).toBe('Cambiar contraseña')
    expect(nombres[i + 1]).toBe('Cerrar Sesión')
  })

  it('marcarlo aplica el zoom en <html> y lo guarda; al reabrir sale marcado; desmarcarlo lo quita', async () => {
    renderConProviders(<AppLayout />, { sesion: SESION_TEC })
    await userEvent.click(screen.getByRole('button', { name: /Hola, tecnico_n/ }))
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Texto grande' }))
    expect(document.documentElement).toHaveAttribute('data-texto', 'grande')
    expect(localStorage.getItem(CLAVE_TEXTO)).toBe('grande')
    await userEvent.click(screen.getByRole('button', { name: /Hola, tecnico_n/ }))
    const item = screen.getByRole('menuitemcheckbox', { name: 'Texto grande' })
    expect(item).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(item)
    expect(document.documentElement).not.toHaveAttribute('data-texto')
    expect(localStorage.getItem(CLAVE_TEXTO)).toBeNull()
  })

  it('con "Texto grande" ya aplicado al arrancar, el ítem sale marcado', async () => {
    document.documentElement.dataset.texto = 'grande'
    renderConProviders(<AppLayout />, { sesion: SESION_TEC })
    await userEvent.click(screen.getByRole('button', { name: /Hola, tecnico_n/ }))
    expect(screen.getByRole('menuitemcheckbox', { name: 'Texto grande' })).toHaveAttribute('aria-checked', 'true')
  })
})
