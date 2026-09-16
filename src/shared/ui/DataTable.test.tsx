import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ColumnDef } from '@tanstack/react-table'
import { ContextMenuItem } from './context-menu'
import { DataTable } from './DataTable'

type Fila = { id: string; nombre: string; nota: string }

const DATOS: Fila[] = [
  { id: '1', nombre: 'WEB', nota: 'a' },
  { id: '2', nombre: 'OTRO', nota: 'b' },
  { id: '3', nombre: 'AMAZON', nota: 'c' },
]
const COLUMNAS: ColumnDef<Fila, string>[] = [
  { accessorKey: 'nombre', header: 'Nombre', size: 340 },
  { accessorKey: 'nota', header: 'Nota', size: 130 },
]

describe('DataTable', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fija los anchos con un colgroup y sin columna de relleno (ajuste fijo)', () => {
    const { container } = render(<DataTable columns={COLUMNAS} data={DATOS} vacio="Sin filas" />)
    const cols = container.querySelectorAll('col')
    expect(cols).toHaveLength(2)
    expect(cols[0]).toHaveStyle({ width: '340px' })
    expect(cols[1]).toHaveStyle({ width: '130px' })
    expect(container.querySelector('table')).toHaveStyle({ width: '470px' })
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    expect(within(screen.getByRole('row', { name: /^WEB a$/ })).getAllByRole('cell')).toHaveLength(2)
  })

  it('en ajuste estirar reparte porcentajes sobre la suma y fija el mínimo', () => {
    const { container } = render(<DataTable columns={COLUMNAS} data={DATOS} vacio="Sin filas" ajuste="estirar" />)
    const cols = container.querySelectorAll('col')
    expect(cols[0].style.width).toMatch(/^72\.34/)
    expect(cols[1].style.width).toMatch(/^27\.65/)
    expect(container.querySelector('table')).toHaveStyle({ minWidth: '470px' })
    expect(container.querySelector('table')).toHaveClass('w-full')
  })

  it('el mensaje de vacío ocupa todas las columnas que se pintan', () => {
    render(<DataTable columns={COLUMNAS} data={[]} vacio="Sin filas" />)
    expect(screen.getByRole('cell', { name: 'Sin filas' })).toHaveAttribute('colspan', '2')
  })

  it('selecciona con clic, mueve con las flechas y abre con Enter o doble clic', async () => {
    const onSeleccionar = vi.fn()
    const onAbrir = vi.fn()
    const { rerender } = render(<DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} seleccionada={null} onSeleccionar={onSeleccionar} onAbrir={onAbrir} />)
    await userEvent.click(screen.getByText('OTRO'))
    expect(onSeleccionar).toHaveBeenLastCalledWith('2')
    rerender(<DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} seleccionada="2" onSeleccionar={onSeleccionar} onAbrir={onAbrir} />)
    const fila = screen.getByRole('row', { name: /^OTRO b$/ })
    expect(fila).toHaveAttribute('data-state', 'selected')
    expect(fila).toHaveAttribute('aria-selected', 'true')
    expect(fila).toHaveClass('data-[state=selected]:bg-azul-medio')
    const contenedor = screen.getByRole('table').parentElement!
    contenedor.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(onSeleccionar).toHaveBeenLastCalledWith('3')
    await userEvent.keyboard('{ArrowUp}')
    expect(onSeleccionar).toHaveBeenLastCalledWith('1')
    await userEvent.keyboard('{Enter}')
    expect(onAbrir).toHaveBeenLastCalledWith(DATOS[1])
    await userEvent.dblClick(screen.getByText('AMAZON'))
    expect(onAbrir).toHaveBeenLastCalledWith(DATOS[2])
  })

  it('el menú contextual recibe la columna pulsada y puede resaltar la celda', async () => {
    const { container } = render(
      <DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id}
        menuFila={(f, celda) => <ContextMenuItem onSelect={celda.resaltar}>{`copiar ${f.nombre} ${celda.columnaId}`}</ContextMenuItem>} />,
    )
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('b') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'copiar OTRO nota' }))
    const celda = within(screen.getByRole('row', { name: /^OTRO b$/ })).getAllByRole('cell')[1]
    expect(celda).toHaveClass('bg-fila-modificada-bg')
    expect(container.querySelector('tbody')).not.toBeNull()
  })

  it('ordena por clic en la cabecera solo si se pide', async () => {
    render(<DataTable columns={COLUMNAS} data={DATOS} vacio="" ordenacion />)
    await userEvent.click(screen.getByRole('button', { name: 'Nombre' }))
    const nombres = screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent)
    expect(nombres).toEqual(['AMAZON', 'OTRO', 'WEB'])
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toHaveAttribute('aria-sort', 'ascending')
  })

  it('sin ordenación las cabeceras no son botones', () => {
    render(<DataTable columns={COLUMNAS} data={DATOS} vacio="" />)
    expect(screen.queryByRole('button', { name: 'Nombre' })).not.toBeInTheDocument()
  })

  it('si la selección cambia desde fuera, desplaza la tabla hasta la fila (restauración al volver de un detalle)', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    const { rerender } = render(<DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} seleccionada={null} onSeleccionar={() => {}} />)
    expect(scrollIntoView).not.toHaveBeenCalled()
    rerender(<DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} seleccionada="3" onSeleccionar={() => {}} />)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.instances[0]).toBe(screen.getByRole('row', { name: /^AMAZON c$/ }))
  })

  it('un refresco de datos con la misma selección no vuelve a desplazar la tabla', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    const { rerender } = render(<DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} seleccionada="3" onSeleccionar={() => {}} />)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    rerender(<DataTable columns={COLUMNAS} data={[...DATOS]} vacio="" getRowId={(f) => f.id} seleccionada="3" onSeleccionar={() => {}} />)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    rerender(<DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} seleccionada="1" onSeleccionar={() => {}} />)
    expect(scrollIntoView).toHaveBeenCalledTimes(2)
  })

  it('si la selección llega antes que las filas, desplaza cuando aparecen', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    const { rerender } = render(<DataTable columns={COLUMNAS} data={[]} vacio="" getRowId={(f) => f.id} seleccionada="3" onSeleccionar={() => {}} />)
    expect(scrollIntoView).not.toHaveBeenCalled()
    rerender(<DataTable columns={COLUMNAS} data={DATOS} vacio="" getRowId={(f) => f.id} seleccionada="3" onSeleccionar={() => {}} />)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('por encima del umbral solo pinta las filas visibles (virtualización)', () => {
    const muchas: Fila[] = Array.from({ length: 500 }, (_, i) => ({ id: String(i), nombre: `F${i}`, nota: 'x' }))
    render(<DataTable columns={COLUMNAS} data={muchas} vacio="" getRowId={(f) => f.id} umbralVirtual={100} />)
    const filas = screen.getAllByRole('row').length - 1
    expect(filas).toBeGreaterThan(5)
    expect(filas).toBeLessThan(100)
    expect(screen.getByText('F0')).toBeInTheDocument()
    expect(screen.queryByText('F499')).not.toBeInTheDocument()
  })
})
