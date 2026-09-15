import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Navigate, Route } from 'react-router'
import { describe, expect, it } from 'vitest'
import { renderConProviders, SESION_TEC } from '@/test/render'
import { useSession } from './SessionProvider'
import { RequireSesion } from './RequireSesion'

// La ruta fija de renderConProviders (path={ruta}) coincidiría con "/privado" si la usáramos también
// para la ruta protegida (misma puntuación, gana la primera declarada): por eso `ui` navega hasta ahí
// y la estructura real (login + RequireSesion) vive en `rutas`, sin pisarse.
describe('RequireSesion', () => {
  it('con sesión renderiza la ruta hija', async () => {
    renderConProviders(<Navigate to="/privado" replace />, {
      sesion: SESION_TEC,
      rutas: (
        <Route element={<RequireSesion />}>
          <Route path="/privado" element={<p>PRIVADO</p>} />
        </Route>
      ),
    })
    await waitFor(() => expect(screen.getByText('PRIVADO')).toBeInTheDocument())
  })

  it('sin sesión redirige a /login', async () => {
    renderConProviders(<Navigate to="/privado" replace />, {
      rutas: (
        <>
          <Route path="/login" element={<p>LOGIN</p>} />
          <Route element={<RequireSesion />}>
            <Route path="/privado" element={<p>PRIVADO</p>} />
          </Route>
        </>
      ),
    })
    await waitFor(() => expect(screen.getByText('LOGIN')).toBeInTheDocument())
    expect(screen.queryByText('PRIVADO')).not.toBeInTheDocument()
  })
})

function ProbeLogout({ exponerQc }: { exponerQc: (qc: QueryClient) => void }) {
  const qc = useQueryClient()
  const { logout } = useSession()
  exponerQc(qc)
  return <button onClick={logout}>Salir</button>
}

describe('logout', () => {
  it('borra sessionStorage y limpia la caché de queries', async () => {
    let qc: QueryClient | undefined
    renderConProviders(<ProbeLogout exponerQc={(c) => { qc = c }} />, { sesion: SESION_TEC, ruta: '/x' })
    qc!.setQueryData(['x'], 1)
    expect(qc!.getQueryCache().getAll()).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Salir' }))

    expect(sessionStorage.getItem('fsgr.sesion')).toBeNull()
    expect(qc!.getQueryCache().getAll()).toHaveLength(0)
  })
})
