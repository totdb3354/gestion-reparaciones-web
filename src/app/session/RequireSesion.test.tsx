import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Navigate, Route } from 'react-router'
import { describe, expect, it } from 'vitest'
import { renderConProviders, SESION_TEC } from '@/test/render'
import { borrarSesion } from '@/shared/session/storage'
import { useSession } from '@/shared/session/SessionProvider'
import { RequireSesion, RUTA_CAMBIO_OBLIGATORIO } from './RequireSesion'

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

  it('"Cerrar Sesión" en otra pestaña del navegador lleva esta a /login', async () => {
    renderConProviders(<Navigate to="/privado" replace />, {
      sesion: SESION_TEC,
      rutas: (
        <>
          <Route path="/login" element={<p>LOGIN</p>} />
          <Route element={<RequireSesion />}>
            <Route path="/privado" element={<p>PRIVADO</p>} />
          </Route>
        </>
      ),
    })
    await screen.findByText('PRIVADO')
    // La otra pestaña borra la sesión compartida; a esta le llega el evento storage.
    borrarSesion()
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'fsgr.sesion', newValue: null, storageArea: localStorage }))
    })
    expect(await screen.findByText('LOGIN')).toBeInTheDocument()
    expect(screen.queryByText('PRIVADO')).not.toBeInTheDocument()
  })
})

describe('RequireSesion con la contraseña temporal del administrador', () => {
  const montar = (ruta: string) =>
    renderConProviders(<Navigate to={ruta} replace />, {
      sesion: { ...SESION_TEC, passwordTemporal: true },
      rutas: (
        <Route element={<RequireSesion />}>
          <Route path="/privado" element={<p>PRIVADO</p>} />
          <Route path={RUTA_CAMBIO_OBLIGATORIO} element={<p>CAMBIO</p>} />
        </Route>
      ),
    })

  it('cualquier ruta lleva al cambio obligatorio', async () => {
    montar('/privado')
    expect(await screen.findByText('CAMBIO')).toBeInTheDocument()
    expect(screen.queryByText('PRIVADO')).not.toBeInTheDocument()
  })

  it('el propio cambio obligatorio sí se pinta (no hay bucle de redirecciones)', async () => {
    montar(RUTA_CAMBIO_OBLIGATORIO)
    expect(await screen.findByText('CAMBIO')).toBeInTheDocument()
  })

  it('sin la marca, el cambio obligatorio no se pinta: lleva al inicio', async () => {
    renderConProviders(<Navigate to={RUTA_CAMBIO_OBLIGATORIO} replace />, {
      sesion: SESION_TEC,
      // El arranque no puede estar en '/', que es adonde lleva la guarda: se redirigirían el uno al otro en bucle.
      ruta: '/entrada',
      rutas: (
        <Route element={<RequireSesion />}>
          <Route path="/" element={<p>INICIO</p>} />
          <Route path={RUTA_CAMBIO_OBLIGATORIO} element={<p>CAMBIO</p>} />
        </Route>
      ),
    })
    expect(await screen.findByText('INICIO')).toBeInTheDocument()
    expect(screen.queryByText('CAMBIO')).not.toBeInTheDocument()
  })

  it('si otra pestaña cambia la contraseña, esta sale sola del cambio obligatorio', async () => {
    const sesion = { ...SESION_TEC, passwordTemporal: true }
    renderConProviders(<Navigate to={RUTA_CAMBIO_OBLIGATORIO} replace />, {
      sesion,
      ruta: '/entrada',
      rutas: (
        <Route element={<RequireSesion />}>
          <Route path="/" element={<p>INICIO</p>} />
          <Route path={RUTA_CAMBIO_OBLIGATORIO} element={<p>CAMBIO</p>} />
        </Route>
      ),
    })
    await screen.findByText('CAMBIO')
    // La otra pestaña guarda la misma sesión (mismo token) ya sin la marca; a esta le llega el evento storage.
    const nueva = JSON.stringify({ ...sesion, passwordTemporal: false })
    localStorage.setItem('fsgr.sesion', nueva)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'fsgr.sesion', newValue: nueva, storageArea: localStorage }))
    })
    expect(await screen.findByText('INICIO')).toBeInTheDocument()
    expect(screen.queryByText('CAMBIO')).not.toBeInTheDocument()
  })

  it('sin la marca la aplicación se abre con normalidad', async () => {
    renderConProviders(<Navigate to="/privado" replace />, {
      sesion: SESION_TEC,
      rutas: (
        <Route element={<RequireSesion />}>
          <Route path="/privado" element={<p>PRIVADO</p>} />
          <Route path={RUTA_CAMBIO_OBLIGATORIO} element={<p>CAMBIO</p>} />
        </Route>
      ),
    })
    expect(await screen.findByText('PRIVADO')).toBeInTheDocument()
  })
})

function ProbeLogout({ exponerQc }: { exponerQc: (qc: QueryClient) => void }) {
  const qc = useQueryClient()
  const { logout } = useSession()
  exponerQc(qc)
  return <button onClick={logout}>Salir</button>
}

describe('logout', () => {
  it('borra la sesión guardada y limpia la caché de queries', async () => {
    let qc: QueryClient | undefined
    renderConProviders(<ProbeLogout exponerQc={(c) => { qc = c }} />, { sesion: SESION_TEC, ruta: '/x' })
    qc!.setQueryData(['x'], 1)
    expect(qc!.getQueryCache().getAll()).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Salir' }))

    expect(localStorage.getItem('fsgr.sesion')).toBeNull()
    expect(qc!.getQueryCache().getAll()).toHaveLength(0)
  })
})
