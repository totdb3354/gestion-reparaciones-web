import { createBrowserRouter, Navigate } from 'react-router'
import { ClientesPage } from '@/modules/gestion/clientes/ClientesPage'
import { FormularioNuevoRuta } from '@/modules/taller/formulario/rutas'
import { HistorialPage } from '@/modules/taller/historial/HistorialPage'
import { HistorialPulidosPage } from '@/modules/taller/historial/HistorialPulidosPage'
import { ImeiDetallePage } from '@/modules/taller/imeis/ImeiDetallePage'
import { ImeisPage } from '@/modules/taller/imeis/ImeisPage'
import { PendientesPage } from '@/modules/taller/pendientes/PendientesPage'
import { PulidosPendientesPage } from '@/modules/taller/pendientes/PulidosPendientesPage'
import { InicioReparaciones, RequiereTecnico } from '@/modules/taller/rutas'
import { LoginPage } from './login/LoginPage'
import { RequireSesion } from './session/RequireSesion'
import { AppLayout } from './shell/AppLayout'
import { ErrorRuta } from './shell/ErrorRuta'
import { PendienteDeMigrar } from './shell/PendienteDeMigrar'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireSesion />,
    // Cualquier error no capturado dentro de la app (loader o render de una vista) acaba aquí.
    errorElement: <ErrorRuta />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/reparaciones" replace /> },
          { path: '/reparaciones', element: <InicioReparaciones /> },
          { path: '/reparaciones/asignaciones', element: <PendienteDeMigrar nombre="Asignaciones" /> },
          {
            element: <RequiereTecnico />,
            children: [
              {
                path: '/reparaciones/pendientes',
                element: <PendientesPage tipo="REPARACION" />,
                children: [{ path: 'reparar/:idAsignacion', element: <FormularioNuevoRuta glass={false} /> }],
              },
              { path: '/reparaciones/pendientes/glass', element: <PendientesPage tipo="GLASS" /> },
              { path: '/reparaciones/pendientes/pulidos', element: <PulidosPendientesPage /> },
            ],
          },
          { path: '/reparaciones/historial', element: <HistorialPage tipo="REPARACION" /> },
          { path: '/reparaciones/historial/glass', element: <HistorialPage tipo="GLASS" /> },
          { path: '/reparaciones/historial/pulidos', element: <HistorialPulidosPage /> },
          { path: '/reparaciones/imeis', element: <ImeisPage /> },
          { path: '/reparaciones/imeis/:imei', element: <ImeiDetallePage /> },
          { path: '/stock/*', element: <PendienteDeMigrar nombre="Stock" /> },
          { path: '/estadisticas/*', element: <PendienteDeMigrar nombre="Estadísticas" /> },
          { path: '/clientes', element: <ClientesPage /> },
          { path: '/gestion/tecnicos', element: <PendienteDeMigrar nombre="Gestionar técnicos" /> },
          { path: '/gestion/logs', element: <PendienteDeMigrar nombre="Ver logs" /> },
          { path: '/cuenta/cambiar-password', element: <PendienteDeMigrar nombre="Cambiar contraseña" /> },
          // Una URL desconocida (enlace viejo, ruta aún sin migrar) vuelve al panel inicial en vez de dar 404.
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])
