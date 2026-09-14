import { createBrowserRouter, Navigate } from 'react-router'
import { LoginPage } from './login/LoginPage'
import { RequireSesion } from './session/RequireSesion'

const Placeholder = ({ nombre }: { nombre: string }) => <p className="p-6">Pendiente de migrar: {nombre}</p>

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireSesion />,
    children: [
      { path: '/', element: <Navigate to="/reparaciones" replace /> },
      { path: '/reparaciones/*', element: <Placeholder nombre="Reparaciones" /> },
      { path: '/stock/*', element: <Placeholder nombre="Stock" /> },
      { path: '/estadisticas/*', element: <Placeholder nombre="Estadísticas" /> },
      { path: '/clientes', element: <Placeholder nombre="Clientes" /> },
    ],
  },
])
