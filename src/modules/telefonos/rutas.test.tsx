import { screen } from '@testing-library/react'
import { Smartphone } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { renderConRouter, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { enlacesTelefonos, RequiereAccesoTelefonos } from './rutas'

describe('rutas del módulo de teléfonos', () => {
  it('«Stock de teléfonos» solo para supertécnico y admin', () => {
    expect(enlacesTelefonos(SESION_SUPER)).toEqual([{ to: '/telefonos/stock', label: 'Stock de teléfonos', icono: Smartphone }])
    expect(enlacesTelefonos(SESION_ADMIN)).toHaveLength(1)
    expect(enlacesTelefonos(SESION_TEC)).toEqual([])
    expect(enlacesTelefonos(null)).toEqual([])
  })

  it('el técnico que entra por la dirección recibe el aviso y vuelve a /reparaciones', async () => {
    renderConRouter([
      { element: <RequiereAccesoTelefonos />, children: [{ path: '/telefonos/stock', element: <p>stock</p> }] },
      { path: '/reparaciones', element: <p>reparaciones</p> },
    ], { sesion: SESION_TEC, ruta: '/telefonos/stock' })
    expect(await screen.findByText('reparaciones')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Error' })).toHaveTextContent('No tienes permisos para realizar esta acción.')
  })

  it('el supertécnico entra', async () => {
    renderConRouter([{ element: <RequiereAccesoTelefonos />, children: [{ path: '/telefonos/stock', element: <p>stock</p> }] }],
      { sesion: SESION_SUPER, ruta: '/telefonos/stock' })
    expect(await screen.findByText('stock')).toBeInTheDocument()
  })
})
