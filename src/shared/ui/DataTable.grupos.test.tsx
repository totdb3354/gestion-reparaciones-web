import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ContextMenuItem } from './context-menu'
import { DataTable, type GruposTabla } from './DataTable'

type Fila = { id: string; grupo: string; nombre: string }
const DATOS: Fila[] = [
  { id: '1', grupo: 'A', nombre: 'a1' },
  { id: '2', grupo: 'A', nombre: 'a2' },
  { id: '3', grupo: 'B', nombre: 'b1' },
  { id: '4', grupo: 'C', nombre: 'c1' },
]
const COLUMNAS: ColumnDef<Fila, string>[] = [{ accessorKey: 'nombre', header: 'Nombre', size: 200 }]

function grupos(plegados: string[] = [], conMenu = false): GruposTabla<Fila> {
  return {
    clave: (f) => f.grupo,
    desplegado: (c) => !plegados.includes(c),
    cabecera: (c, filas) => <span>Grupo {c} ({filas.length})</span>,
    menuCabecera: conMenu ? (c) => <ContextMenuItem>Acción de {c}</ContextMenuItem> : undefined,
  }
}

function Tabla({ g, onSeleccionar = vi.fn(), umbralVirtual }: { g?: GruposTabla<Fila>; onSeleccionar?: (id: string | null) => void; umbralVirtual?: number }) {
  const [sel, setSel] = useState<string | null>(null)
  return (
    <DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} grupos={g} umbralVirtual={umbralVirtual}
      seleccionada={sel} onSeleccionar={(id) => { setSel(id); onSeleccionar(id) }} />
  )
}
const textos = () => screen.getAllByRole('row').slice(1).map((r) => r.textContent)

describe('DataTable con grupos (0.9.9)', () => {
  it('sin grupos pinta las filas como siempre', () => {
    render(<Tabla />)
    expect(textos()).toEqual(['a1', 'a2', 'b1', 'c1'])
  })

  it('intercala una cabecera a todo el ancho antes de cada grupo', () => {
    render(<Tabla g={grupos()} />)
    expect(textos()).toEqual(['Grupo A (2)', 'a1', 'a2', 'Grupo B (1)', 'b1', 'Grupo C (1)', 'c1'])
    const celda = screen.getByText('Grupo A (2)').closest('td') as HTMLElement
    expect(celda).toHaveAttribute('colspan', '2') // la columna y la de relleno del ajuste fijo
    expect(celda.closest('tr')).toHaveAttribute('data-cabecera')
  })

  it('un grupo plegado pinta solo su cabecera (con todas sus filas en `filas`)', () => {
    render(<Tabla g={grupos(['A'])} />)
    expect(textos()).toEqual(['Grupo A (2)', 'Grupo B (1)', 'b1', 'Grupo C (1)', 'c1'])
  })

  it('las flechas saltan las cabeceras y las filas plegadas', () => {
    const onSeleccionar = vi.fn()
    render(<Tabla g={grupos(['B'])} onSeleccionar={onSeleccionar} />)
    fireEvent.click(screen.getByText('a2'))
    const contenedor = screen.getByRole('table').parentElement as HTMLElement
    fireEvent.keyDown(contenedor, { key: 'ArrowDown' })
    expect(onSeleccionar).toHaveBeenLastCalledWith('4')
    fireEvent.keyDown(contenedor, { key: 'ArrowUp' })
    expect(onSeleccionar).toHaveBeenLastCalledWith('2')
  })

  it('un clic en una cabecera no selecciona ninguna fila', () => {
    const onSeleccionar = vi.fn()
    render(<Tabla g={grupos()} onSeleccionar={onSeleccionar} />)
    fireEvent.click(screen.getByText('Grupo B (1)'))
    expect(onSeleccionar).not.toHaveBeenCalled()
  })

  it('la cabecera abre su menú contextual', async () => {
    render(<Tabla g={grupos([], true)} />)
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('Grupo B (1)') })
    expect(screen.getByRole('menuitem', { name: 'Acción de B' })).toBeInTheDocument()
  })

  it('con pintado parcial también intercala las cabeceras', () => {
    render(<Tabla g={grupos()} umbralVirtual={2} />)
    expect(textos()).toEqual(['Grupo A (2)', 'a1', 'a2', 'Grupo B (1)', 'b1', 'Grupo C (1)', 'c1'])
  })
})
