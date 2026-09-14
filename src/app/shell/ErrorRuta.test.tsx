import { render, screen } from '@testing-library/react'
import { Navigate, Route, RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { renderConProviders, SESION_TEC } from '@/test/render'
import { RequireSesion } from '../session/RequireSesion'
import { ErrorRuta } from './ErrorRuta'
import { PendienteDeMigrar } from './PendienteDeMigrar'

describe('ErrorRuta', () => {
  it('con una respuesta de error muestra código y estado, y el enlace de vuelta', async () => {
    const router = createMemoryRouter([
      {
        path: '/',
        loader: () => {
          throw new Response('', { status: 404, statusText: 'Not Found' })
        },
        element: <p>NUNCA</p>,
        errorElement: <ErrorRuta />,
      },
    ])
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('Error')).toBeInTheDocument()
    expect(screen.getByText('404 Not Found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/')
    expect(screen.queryByText('NUNCA')).not.toBeInTheDocument()
  })

  it('con un error corriente muestra su mensaje', async () => {
    const router = createMemoryRouter([
      {
        path: '/',
        loader: () => {
          throw new Error('La vista ha reventado')
        },
        element: <p>NUNCA</p>,
        errorElement: <ErrorRuta />,
      },
    ])
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('La vista ha reventado')).toBeInTheDocument()
  })
})

// El data router de router.tsx no se puede montar con renderConProviders, así que el árbol de rutas
// se replica aquí (RequireSesion + redirección de "/" + comodín) para comprobar el comodín.
describe('ruta comodín', () => {
  it('una URL desconocida con sesión acaba en el panel inicial', async () => {
    renderConProviders(<Navigate to="/no-existe" replace />, {
      sesion: SESION_TEC,
      ruta: '/arranque',
      rutas: (
        <Route element={<RequireSesion />}>
          <Route path="/" element={<Navigate to="/reparaciones" replace />} />
          <Route path="/reparaciones/*" element={<PendienteDeMigrar nombre="Reparaciones" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ),
    })
    expect(await screen.findByRole('heading', { name: 'Reparaciones' })).toBeInTheDocument()
  })
})
