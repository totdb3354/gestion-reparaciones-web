import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { SessionProvider } from '@/app/session/SessionProvider'
import { guardarSesion, type Sesion } from '@/app/session/storage'

type Opciones = { sesion?: Sesion | null; ruta?: string; rutas?: ReactElement }

/** Render con QueryClient (sin reintentos), SessionProvider y MemoryRouter. `rutas` permite añadir <Route>s auxiliares. */
export function renderConProviders(ui: ReactElement, { sesion = null, ruta = '/', rutas }: Opciones = {}) {
  if (sesion) guardarSesion(sesion)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SessionProvider>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path={ruta} element={ui} />
            {rutas}
          </Routes>
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  )
}

export const SESION_SUPER: Sesion = { idUsu: 7, nombreUsuario: 'fati', rol: 'SUPERTECNICO', idTec: 3, token: 'jwt-super' }
export const SESION_TEC: Sesion = { idUsu: 8, nombreUsuario: 'zara', rol: 'TECNICO', idTec: 4, token: 'jwt-tec' }
export const SESION_ADMIN: Sesion = { idUsu: 1, nombreUsuario: 'admin', rol: 'ADMIN', idTec: null, token: 'jwt-admin' }
