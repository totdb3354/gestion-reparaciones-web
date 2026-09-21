import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, RouterProvider, Routes, createMemoryRouter, type RouteObject } from 'react-router'
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
 *  fallo que no sea sesión expirada o desconexión). Devuelve también el `queryClient`, para que un test pueda forzar
 *  la recarga de una consulta (lo que en producción hacen el sondeo o el foco de la ventana). */
export function renderConProviders(ui: ReactElement, { sesion = null, ruta = '/', rutas, layout, patron }: Opciones = {}) {
  if (sesion) guardarSesion(sesion)
  const qc = crearQueryClient({ retry: false })
  const rutaUi = layout ? (
    <Route element={layout}>
      <Route path={patron ?? ruta} element={ui} />
    </Route>
  ) : (
    <Route path={patron ?? ruta} element={ui} />
  )
  const resultado = render(
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
  return { ...resultado, queryClient: qc }
}

/** Igual que renderConProviders (mismo QueryClient de producción sin reintentos, SessionProvider y AlertaProvider) pero con
 *  un data router en memoria (createMemoryRouter + RouterProvider): hace falta para lo que exige data router, como
 *  useBlocker, y para probar rutas hijas con <Outlet />. Devuelve el `router` para navegar desde el test
 *  (`await act(() => router.navigate(-1))`). */
export function renderConRouter(
  rutas: RouteObject[],
  { sesion = null, ruta = '/' }: { sesion?: Sesion | null; ruta?: string } = {},
): ReturnType<typeof render> & { queryClient: QueryClient; router: ReturnType<typeof createMemoryRouter> } {
  if (sesion) guardarSesion(sesion)
  const qc = crearQueryClient({ retry: false })
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] })
  const resultado = render(
    <QueryClientProvider client={qc}>
      <SessionProvider>
        <AlertaProvider>
          <RouterProvider router={router} />
        </AlertaProvider>
      </SessionProvider>
    </QueryClientProvider>,
  )
  return { ...resultado, queryClient: qc, router }
}

export const SESION_SUPER: Sesion = { idUsu: 7, nombreUsuario: 'tecnico_f', rol: 'SUPERTECNICO', idTec: 3, token: 'jwt-super' }
export const SESION_TEC: Sesion = { idUsu: 8, nombreUsuario: 'tecnico_n', rol: 'TECNICO', idTec: 4, token: 'jwt-tec' }
export const SESION_ADMIN: Sesion = { idUsu: 1, nombreUsuario: 'admin', rol: 'ADMIN', idTec: null, token: 'jwt-admin' }
