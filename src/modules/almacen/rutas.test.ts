import { Building2, Package, ShoppingCart } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { enlacesStock } from './rutas'

describe('enlaces de la columna de Stock', () => {
  it('cada enlace lleva su icono (0.9.10)', () => {
    expect(enlacesStock().map((e) => [e.label, e.icono])).toEqual([
      ['Stock actual', Package],
      ['Pedidos', ShoppingCart],
      ['Proveedores', Building2],
    ])
  })
})
