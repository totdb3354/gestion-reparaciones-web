import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from './DataTable'

type Fila = { nombre: string; nota: string }

const DATOS: Fila[] = [{ nombre: 'WEB', nota: 'sin ancho' }]

// Una columna con ancho declarado y otra sin él: la segunda debe repartirse lo que sobra, sin ancho inline.
const COLUMNAS: ColumnDef<Fila, string>[] = [
  { accessorKey: 'nombre', header: 'Nombre', size: 340 },
  { accessorKey: 'nota', header: 'Nota' },
]

describe('DataTable (anchos del TableView)', () => {
  it('solo pone ancho inline en las columnas que declaran size', () => {
    render(<DataTable columns={COLUMNAS} data={DATOS} vacio="Sin filas" />)
    const conAncho = screen.getByRole('columnheader', { name: 'Nombre' })
    const sinAncho = screen.getByRole('columnheader', { name: 'Nota' })
    expect(conAncho).toHaveStyle({ width: '340px' })
    // TanStack rellena `size` con 150 por defecto: sin `defaultColumn: { size: undefined }` esta
    // columna acabaría con un width inline de 150 px y nunca se estiraría.
    expect(sinAncho).not.toHaveAttribute('style')

    const fila = screen.getByRole('row', { name: /^WEB sin ancho$/ })
    const celdas = within(fila).getAllByRole('cell')
    expect(celdas[0]).toHaveStyle({ width: '340px' })
    expect(celdas[1]).not.toHaveAttribute('style')
  })

  it('cierra la tabla con una columna de relleno vacía y sin etiqueta', () => {
    render(<DataTable columns={COLUMNAS} data={DATOS} vacio="Sin filas" />)
    const cabeceras = screen.getAllByRole('columnheader')
    expect(cabeceras).toHaveLength(3)
    expect(cabeceras[2]).toBeEmptyDOMElement()
    expect(cabeceras[2]).not.toHaveAttribute('aria-label')

    const celdas = within(screen.getByRole('row', { name: /^WEB sin ancho$/ })).getAllByRole('cell')
    expect(celdas).toHaveLength(3)
    expect(celdas[2]).toBeEmptyDOMElement()
    expect(celdas[2]).not.toHaveAttribute('aria-label')
  })

  it('el mensaje de vacío ocupa todas las columnas que se pintan, aunque estén agrupadas', () => {
    // `columns.length` aquí es 1 (el grupo); las hojas que se pintan son 2, más el relleno.
    const agrupadas: ColumnDef<Fila, string>[] = [
      { id: 'grupo', header: 'Grupo', columns: COLUMNAS },
    ]
    render(<DataTable columns={agrupadas} data={[]} vacio="Sin filas" />)
    const hojas = within(screen.getAllByRole('row')[1]).getAllByRole('columnheader')
    const celda = screen.getByRole('cell', { name: 'Sin filas' })
    expect(hojas).toHaveLength(3)
    expect(celda).toHaveAttribute('colspan', String(hojas.length))
  })
})
