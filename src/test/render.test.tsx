import { act, screen } from '@testing-library/react'
import { Outlet, useBlocker, useParams } from 'react-router'
import { describe, expect, it } from 'vitest'
import { useSession } from '@/shared/session/SessionProvider'
import { SESION_TEC, renderConRouter } from './render'

function Lista() {
  const { sesion } = useSession()
  return (
    <div>
      <p>Lista de {sesion?.nombreUsuario ?? 'nadie'}</p>
      <Outlet />
    </div>
  )
}
function Hijo() {
  const { idAsignacion } = useParams()
  // useBlocker exige data router: con MemoryRouter + Routes lanzaría. Que monte ya demuestra que el router es de datos.
  const bloqueo = useBlocker(false)
  return <p>Formulario {idAsignacion} ({bloqueo.state})</p>
}

describe('renderConRouter (data router en memoria)', () => {
  const rutas = [{ path: '/reparaciones/pendientes', element: <Lista />, children: [{ path: 'reparar/:idAsignacion', element: <Hijo /> }] }]

  it('monta rutas anidadas con los providers de siempre', () => {
    const { queryClient } = renderConRouter(rutas, { sesion: SESION_TEC, ruta: '/reparaciones/pendientes/reparar/A20260916_1' })
    expect(screen.getByText('Lista de tecnico_n')).toBeInTheDocument()
    expect(screen.getByText('Formulario A20260916_1 (unblocked)')).toBeInTheDocument()
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(false)
  })
  it('expone router.navigate: navegar y volver atrás', async () => {
    const { router } = renderConRouter(rutas, { ruta: '/reparaciones/pendientes' })
    expect(screen.getByText('Lista de nadie')).toBeInTheDocument()
    expect(screen.queryByText(/^Formulario/)).not.toBeInTheDocument()
    await act(() => router.navigate('/reparaciones/pendientes/reparar/AG20260916_2'))
    expect(screen.getByText('Formulario AG20260916_2 (unblocked)')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reparaciones/pendientes/reparar/AG20260916_2')
    await act(() => router.navigate(-1))
    expect(screen.queryByText(/^Formulario/)).not.toBeInTheDocument()
  })
})
