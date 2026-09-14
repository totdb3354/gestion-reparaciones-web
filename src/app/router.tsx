import { createBrowserRouter, Navigate } from 'react-router'
import { LoginPage } from './login/LoginPage'
import { RequireSesion } from './session/RequireSesion'
import { AppLayout } from './shell/AppLayout'
import { PendienteDeMigrar } from './shell/PendienteDeMigrar'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireSesion />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/reparaciones" replace /> },
          { path: '/reparaciones/*', element: <PendienteDeMigrar nombre="Reparaciones" /> },
          { path: '/stock/*', element: <PendienteDeMigrar nombre="Stock" /> },
          { path: '/estadisticas/*', element: <PendienteDeMigrar nombre="Estadísticas" /> },
          { path: '/clientes', element: <PendienteDeMigrar nombre="Clientes" /> },
          { path: '/gestion/tecnicos', element: <PendienteDeMigrar nombre="Gestionar técnicos" /> },
          { path: '/gestion/logs', element: <PendienteDeMigrar nombre="Ver logs" /> },
          { path: '/cuenta/cambiar-password', element: <PendienteDeMigrar nombre="Cambiar contraseña" /> },
        ],
      },
    ],
  },
])
