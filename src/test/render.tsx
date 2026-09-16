import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { SessionProvider } from '@/shared/session/SessionProvider'
import { crearQueryClient } from '@/shared/api/queryClient'
import { guardarSesion, type Sesion } from '@/shared/session/storage'
import { AlertaProvider } from '@/shared/ui/AlertaProvider'

type Opciones = { sesion?: Sesion | null; ruta?: string; rutas?: ReactElement; layout?: ReactElement; patron?: string }

/** Render con el QueryClient de producción (única diferencia: sin reintentos), SessionProvider y MemoryRouter.
 *  `rutas` permite añadir <Route>s auxiliares. `layout` monta `ui` como ruta hija de ese elemento (mismo patrón
 *  sin-path que `router.tsx`: `<Route element={layout}><Route path={patron ?? ruta} element={ui} /></Route>`),
 *  para los tests que necesitan el layout real (p. ej. `AppLayout` por su `TopBar`/menú de usuario); `patron`
 *  solo hace falta si la ruta a testear no coincide literalmente con `ruta` (p. ej. un patrón con parámetros).
 *  Al compartir fábrica con main.tsx, los tests observan la misma política de errores (diálogo ante cualquier
 *  fallo que no sea sesión expirada o desconexión). */
export function renderConProviders(ui: ReactElement, { sesion = null, ruta = '/', rutas, layout, patron }: Opciones = {}) {
  if (sesion) guardarSesion(sesion)
  const qc = crearQueryClient({ retry: false })
  const rutaUi = layout ? (
    <Route element={layout}>
      <Route path={patron ?? ruta} element={ui} />
    </Route>
  ) : (
    <Route path={ruta} element={ui} />
  )
  return render(
    <QueryClientProvider client={qc}>
      <SessionProvider>
        <AlertaProvider>
          <MemoryRouter initialEntries={[ruta]}>
            <Routes>
              {rutaUi}
              {rutas}
            </Routes>
          </MemoryRouter>
        </AlertaProvider>
      </SessionProvider>
    </QueryClientProvider>,
  )
}

export const SESION_SUPER: Sesion = { idUsu: 7, nombreUsuario: 'tecnico_f', rol: 'SUPERTECNICO', idTec: 3, token: 'jwt-super' }
export const SESION_TEC: Sesion = { idUsu: 8, nombreUsuario: 'tecnico_n', rol: 'TECNICO', idTec: 4, token: 'jwt-tec' }
export const SESION_ADMIN: Sesion = { idUsu: 1, nombreUsuario: 'admin', rol: 'ADMIN', idTec: null, token: 'jwt-admin' }
