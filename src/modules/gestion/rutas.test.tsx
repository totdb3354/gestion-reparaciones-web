import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderConRouter, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { RequiereAdmin } from './rutas'

const rutas = [
  {
    element: <RequiereAdmin />,
    children: [
      { path: '/gestion/tecnicos', element: <p>TECNICOS</p> },
      { path: '/gestion/logs', element: <p>LOGS</p> },
    ],
  },
  { path: '/reparaciones', element: <p>INICIO POR ROL</p> },
]

/** "Gestionar técnicos" y "Ver logs" son solo del ADMIN (MainController :826-832; el servidor responde 403 al resto). */
describe('RequiereAdmin', () => {
  it('el ADMIN entra en /gestion/tecnicos y en /gestion/logs sin aviso', async () => {
    const tecnicos = renderConRouter(rutas, { sesion: SESION_ADMIN, ruta: '/gestion/tecnicos' })
    expect(await screen.findByText('TECNICOS')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Error' })).not.toBeInTheDocument()
    tecnicos.unmount()

    renderConRouter(rutas, { sesion: SESION_ADMIN, ruta: '/gestion/logs' })
    expect(await screen.findByText('LOGS')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Error' })).not.toBeInTheDocument()
  })
  it.each([
    ['TECNICO', SESION_TEC, '/gestion/tecnicos'],
    ['SUPERTECNICO', SESION_SUPER, '/gestion/logs'],
  ])('%s por URL recibe el aviso genérico de permisos y sale a /reparaciones', async (_rol, sesion, ruta) => {
    const { router } = renderConRouter(rutas, { sesion, ruta })
    expect(await screen.findByRole('dialog', { name: 'Error' })).toHaveTextContent('No tienes permisos para realizar esta acción.')
    expect(router.state.location.pathname).toBe('/reparaciones')
    expect(screen.queryByText('TECNICOS')).not.toBeInTheDocument()
    expect(screen.queryByText('LOGS')).not.toBeInTheDocument()
  })
})
