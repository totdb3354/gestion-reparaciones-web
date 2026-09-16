import { QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { crearQueryClient } from '@/shared/api/queryClient'
import { crearStore } from '@/shared/lib/store'
import { server } from '@/test/server'
import { SessionProvider, useSession } from './SessionProvider'
import { guardarSesion, type Sesion } from './storage'

const TECNICO: Sesion = { idUsu: 90, nombreUsuario: 'tecnico1', rol: 'TECNICO', idTec: 1, token: 'jwt-tecnico1' }

type Contexto = ReturnType<typeof useSession>

/** Expone en cada render el contexto de sesión (mismo patrón que ProbeSesion de LoginPage.test.tsx). */
function Sonda({ exponer }: { exponer: (ctx: Contexto) => void }) {
  exponer(useSession())
  return null
}

/** Monta el provider con una sesión guardada y devuelve el contexto vivo (login/logout). */
function montar() {
  guardarSesion(TECNICO)
  const ctx: { actual?: Contexto } = {}
  render(
    <QueryClientProvider client={crearQueryClient()}>
      <SessionProvider>
        <Sonda exponer={(c) => { ctx.actual = c }} />
      </SessionProvider>
    </QueryClientProvider>,
  )
  return ctx
}

// Calco del JavaFX, que al volver al login descarta las vistas y con ellas sus filtros: el estado que sobrevive al cambio
// de ruta (crearStore) no sobrevive al cambio de usuario en la misma pestaña.
describe('SessionProvider: los stores de estado no pasan de una sesión a otra', () => {
  it('cerrar sesión vuelve los stores a su valor inicial', () => {
    const filtro = crearStore('')
    const ctx = montar()
    filtro.set('350000000000011')
    act(() => ctx.actual!.logout())
    expect(filtro.get()).toBe('')
  })

  it('entrar vuelve los stores a su valor inicial', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.json(TECNICO)))
    const filtro = crearStore('')
    const ctx = montar()
    filtro.set('350000000000011')
    await act(() => ctx.actual!.login('tecnico1', 'clave'))
    expect(filtro.get()).toBe('')
  })
})
