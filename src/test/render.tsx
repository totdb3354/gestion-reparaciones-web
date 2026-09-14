import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { SessionProvider } from '@/app/session/SessionProvider'
import { guardarSesion, type Sesion } from '@/app/session/storage'
import { ConexionError, SesionExpiradaError } from '@/shared/api/errors'
import { AlertaProvider } from '@/shared/ui/AlertaProvider'
import { emitirError } from '@/shared/ui/alertas'

type Opciones = { sesion?: Sesion | null; ruta?: string; rutas?: ReactElement }

/** Render con QueryClient (sin reintentos), SessionProvider y MemoryRouter. `rutas` permite añadir <Route>s auxiliares.
 *  El QueryCache.onError replica el de main.tsx para que los tests observen el mismo comportamiento (diálogo de error
 *  ante cualquier fallo de consulta que no sea sesión expirada o desconexión). */
export function renderConProviders(ui: ReactElement, { sesion = null, ruta = '/', rutas }: Opciones = {}) {
  if (sesion) guardarSesion(sesion)
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    queryCache: new QueryCache({
      onError(error) {
        if (error instanceof SesionExpiradaError || error instanceof ConexionError) return
        emitirError(error instanceof Error ? error.message : String(error))
      },
    }),
  })
  return render(
    <QueryClientProvider client={qc}>
      <SessionProvider>
        <AlertaProvider>
          <MemoryRouter initialEntries={[ruta]}>
            <Routes>
              <Route path={ruta} element={ui} />
              {rutas}
            </Routes>
          </MemoryRouter>
        </AlertaProvider>
      </SessionProvider>
    </QueryClientProvider>,
  )
}

export const SESION_SUPER: Sesion = { idUsu: 7, nombreUsuario: 'fati', rol: 'SUPERTECNICO', idTec: 3, token: 'jwt-super' }
export const SESION_TEC: Sesion = { idUsu: 8, nombreUsuario: 'zara', rol: 'TECNICO', idTec: 4, token: 'jwt-tec' }
export const SESION_ADMIN: Sesion = { idUsu: 1, nombreUsuario: 'admin', rol: 'ADMIN', idTec: null, token: 'jwt-admin' }
