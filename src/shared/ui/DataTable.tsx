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
                <TableHead key={h.id} className="text-[12px] font-bold text-azul-medio">
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-8 text-center text-azul-gris">{vacio}</TableCell>
            </TableRow>
          )}
          {table.getRowModel().rows.map((row) => {
            const tr = (
              <TableRow key={row.id} className={cn('border-b border-fila-sep', filaClase?.(row.original))}>
                {row.getVisibleCells().map((c) => (
                  <TableCell key={c.id} className="text-[12px]">{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>
                ))}
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
