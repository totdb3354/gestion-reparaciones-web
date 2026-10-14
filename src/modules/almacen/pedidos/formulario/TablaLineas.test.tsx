import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { PROVEEDORES } from './datosPrueba'
import { lineaCompraVacia, type LineaCompra } from './lineas'
import { TablaLineas } from './TablaLineas'

const base = {
  primera: { cabecera: 'Componente', ancho: 175, celda: (l: LineaCompra) => <span>{l.idCom ?? '—'}</span> },
  lineas: [{ ...lineaCompraVacia(1, 2), idProv: 1 }],
  proveedores: PROVEEDORES,
  vacio: 'Vacía',
  seleccionada: null,
  desplazarA: null,
  onSeleccionar: vi.fn(),
  onCambiar: vi.fn(),
  onQuitar: vi.fn(),
}

describe('TablaLineas', () => {
  it('sin columna Proveedor (recuadros de «Nuevo pedido», 0.9.9): seis columnas', () => {
    renderConProviders(<TablaLineas<LineaCompra> {...base} proveedor={null} />, { sesion: SESION_SUPER })
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Componente', 'Cant.', 'P.Unit.', 'Urg.', 'Total EUR', ''])
  })
  it('con columna Proveedor, su celda va la segunda', () => {
    renderConProviders(<TablaLineas<LineaCompra> {...base} proveedor={() => <span>ACME fijo</span>} />, { sesion: SESION_SUPER })
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Componente', 'Proveedor', 'Cant.', 'P.Unit.', 'Urg.', 'Total EUR', ''])
    expect(screen.getAllByRole('cell')[1]).toHaveTextContent('ACME fijo')
  })
  it('sin líneas, una fila con el texto de vacío', () => {
    renderConProviders(<TablaLineas<LineaCompra> {...base} lineas={[]} proveedor={null} />, { sesion: SESION_SUPER })
    expect(screen.getByText('Vacía')).toBeInTheDocument()
  })
})
