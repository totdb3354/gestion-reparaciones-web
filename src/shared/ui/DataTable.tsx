import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from './context-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'
import { cn } from '@/shared/lib/utils'

type Props<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[]
  data: T[]
  vacio: string
  filaClase?: (row: T) => string
  /** Si se da, cada fila abre este menú con clic derecho (equivalente al ContextMenu de TableView). */
  menuFila?: (row: T) => ReactNode
  getRowId?: (row: T) => string
}

/** Ancho fijo de la columna, solo si la ColumnDef lo declara: TanStack rellena `size` con 150 por defecto,
 *  así que `getSize()` mentiría y le pondría ancho a todas. Sin ancho, la columna reparte lo que sobra. */
function anchoDe(size: number | undefined) {
  return size === undefined ? undefined : { width: size }
}

export function DataTable<T>({ columns, data, vacio, filaClase, menuFila, getRowId }: Props<T>) {
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table 8 devuelve funciones no memoizables; aviso conocido del React Compiler
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), getRowId })
  return (
    <div className="overflow-x-auto rounded-md bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} style={anchoDe(h.column.columnDef.size)} className="text-[12px] font-bold text-azul-medio">
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
              {/* Relleno, como el hueco en blanco del TableView: absorbe el ancho sobrante en vez de
                  repartirlo entre las columnas con tamaño. Va vacío y sin etiqueta para no cambiar el
                  nombre accesible de las filas. */}
              <TableHead />
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="py-8 text-center text-azul-gris">{vacio}</TableCell>
            </TableRow>
          )}
          {table.getRowModel().rows.map((row) => {
            const tr = (
              <TableRow key={row.id} className={cn('border-b border-fila-sep', filaClase?.(row.original))}>
                {row.getVisibleCells().map((c) => (
                  <TableCell key={c.id} style={anchoDe(c.column.columnDef.size)} className="text-[12px]">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </TableCell>
                ))}
                <TableCell />
              </TableRow>
            )
            if (!menuFila) return tr
            return (
              <ContextMenu key={row.id}>
                <ContextMenuTrigger asChild>{tr}</ContextMenuTrigger>
                <ContextMenuContent>{menuFila(row.original)}</ContextMenuContent>
              </ContextMenu>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
