import { screen } from '@testing-library/react'
import { Building2, Package, ShoppingCart } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { renderConRouter, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { enlacesStock, RequiereAccesoPedidos } from './rutas'

describe('enlaces de la columna de Stock', () => {
  it('SUPERTECNICO y ADMIN: los tres, cada uno con su icono (0.9.10)', () => {
    for (const sesion of [SESION_SUPER, SESION_ADMIN]) {
      expect(enlacesStock(sesion).map((e) => [e.label, e.to, e.icono])).toEqual([
        ['Stock actual', '/stock', Package],
        ['Pedidos', '/stock/pedidos', ShoppingCart],
        ['Proveedores', '/stock/proveedores', Building2],
      ])
    }
  })
  it('TECNICO y sin sesión: solo «Stock actual» (0.9.16)', () => {
    for (const sesion of [SESION_TEC, null]) {
      expect(enlacesStock(sesion).map((e) => e.label)).toEqual(['Stock actual'])
    }
  })
})

const rutas = [
  {
    element: <RequiereAccesoPedidos />,
    children: [
      { path: '/stock/pedidos', element: <p>PEDIDOS</p> },
      { path: '/stock/pedidos/otros', element: <p>OTROS</p> },
      { path: '/stock/proveedores', element: <p>PROVEEDORES</p> },
    ],
  },
  { path: '/stock', element: <p>STOCK ACTUAL</p> },
]

/** Pedidos y Proveedores (0.9.16, spec «El técnico sin Pedidos ni Proveedores» §3.2): SUPERTECNICO y ADMIN; el servidor
 *  responde 403 al resto. */
describe('RequiereAccesoPedidos', () => {
  it.each([
    ['SUPERTECNICO', SESION_SUPER, '/stock/pedidos', 'PEDIDOS'],
    ['ADMIN', SESION_ADMIN, '/stock/proveedores', 'PROVEEDORES'],
  ] as const)('%s entra sin aviso', async (_rol, sesion, ruta, texto) => {
    renderConRouter(rutas, { sesion, ruta })
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Error' })).not.toBeInTheDocument()
  })
  it.each(['/stock/pedidos', '/stock/pedidos/otros', '/stock/proveedores'])('el TECNICO en %s recibe el aviso genérico y sale a /stock', async (ruta) => {
    const { router } = renderConRouter(rutas, { sesion: SESION_TEC, ruta })
    expect(await screen.findByRole('dialog', { name: 'Error' })).toHaveTextContent('No tienes permisos para realizar esta acción.')
    expect(router.state.location.pathname).toBe('/stock')
    expect(screen.getByText('STOCK ACTUAL')).toBeInTheDocument()
    for (const texto of ['PEDIDOS', 'OTROS', 'PROVEEDORES']) expect(screen.queryByText(texto)).not.toBeInTheDocument()
  })
})
