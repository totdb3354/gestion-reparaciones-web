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

/** Ancho fijo de la columna, solo si la ColumnDef lo declara. `column.columnDef` es la definición ya
 *  resuelta (`{ ...defaultColumnDef, ...columnDef }`) y el feature ColumnSizing mete ahí `size: 150`, así
 *  que sin el `defaultColumn` de abajo esto le pondría 150 px a todas. Sin ancho, la columna reparte lo
 *  que sobra; `getSize()` sigue devolviendo 150 y por eso no se usa. */
function anchoDe(size: number | undefined) {
  return size === undefined ? undefined : { width: size }
}

export function DataTable<T>({ columns, data, vacio, filaClase, menuFila, getRowId }: Props<T>) {
  // `defaultColumn: { size: undefined }` borra el `size: 150` que ColumnSizing inyecta en la definición por
  // defecto: así `columnDef.size` es `undefined` en las columnas sin ancho y el valor del consumidor en las
  // que sí lo declaran.
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table 8 devuelve funciones no memoizables; aviso conocido del React Compiler
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), getRowId, defaultColumn: { size: undefined } })
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
              {/* hojas visibles (las cabeceras que de verdad se pintan) + el relleno: `columns.length` se
                  desincronizaría en cuanto hubiera columnas agrupadas u ocultas */}
              <TableCell colSpan={table.getVisibleLeafColumns().length + 1} className="py-8 text-center text-azul-gris">{vacio}</TableCell>
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
