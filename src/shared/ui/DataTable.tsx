import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState,
} from '@tanstack/react-table'
import { observeElementRect, useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from './context-menu'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'
import { cn } from '@/shared/lib/utils'

/** Qué columna se pulsó con el botón derecho y cómo resaltarla ("📋 Copiar celda"). */
export type CeldaPulsada = { columnaId: string; resaltar: () => void }

type Props<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[]
  data: T[]
  vacio: string
  filaClase?: (row: T) => string
  /** Menú contextual de la fila (equivale al ContextMenu del TableView). */
  menuFila?: (row: T, celda: CeldaPulsada) => ReactNode
  getRowId?: (row: T) => string
  /** 'fijo' (por defecto): cada columna mide su `size` en px y lo que sobra queda en blanco, como el TableView con
   *  columna de relleno. 'estirar': las columnas se reparten el ancho proporcionalmente a `size` (política de
   *  anchos del Historial, `prefWidth = max(min, min·u)`), con scroll horizontal por debajo de la suma. */
  ajuste?: 'fijo' | 'estirar'
  seleccionada?: string | null
  onSeleccionar?: (id: string | null) => void
  /** Doble clic o Enter sobre la fila seleccionada. */
  onAbrir?: (row: T) => void
  /** Ordenación por clic en la cabecera; apagada por defecto porque el JavaFX no ordena por clic. */
  ordenacion?: boolean
  /** Altura máxima del contenedor con scroll. */
  alturaMax?: string
  /** A partir de cuántas filas se pintan solo las visibles (el TableView virtualiza siempre). */
  umbralVirtual?: number
}

/** Borra el `size: 150` que ColumnSizing inyecta por defecto: así `columnDef.size` refleja lo que declaró el consumidor. */
const COLUMNA_POR_DEFECTO = { size: undefined } as const
const ANCHO_SIN_SIZE = 150
const ALTO_FILA_ESTIMADO = 44
const MS_RESALTADO = 600
/** Ventana de reserva mientras el contenedor no tiene layout: jsdom (y un contenedor oculto) mide 0×0 y la
 *  virtualización calcularía una ventana visible de 0 px, sin pintar ninguna fila. */
const RECT_DE_RESERVA = { width: 1000, height: 600 }

export function DataTable<T>({
  columns,
  data,
  vacio,
  filaClase,
  menuFila,
  getRowId,
  ajuste = 'fijo',
  seleccionada = null,
  onSeleccionar,
  onAbrir,
  ordenacion = false,
  alturaMax = 'calc(100dvh - 330px)',
  umbralVirtual = 200,
}: Props<T>) {
  const [orden, setOrden] = useState<SortingState>([])
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table 8 devuelve funciones no memoizables; aviso conocido del React Compiler
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSorting: ordenacion,
    state: { sorting: ordenacion ? orden : [] },
    onSortingChange: setOrden,
    getRowId,
    defaultColumn: COLUMNA_POR_DEFECTO,
  })
  const hojas = table.getVisibleLeafColumns()
  const anchos = hojas.map((c) => c.columnDef.size ?? ANCHO_SIN_SIZE)
  const suma = anchos.reduce((a, b) => a + b, 0)
  const filas = table.getRowModel().rows

  const contenedorRef = useRef<HTMLDivElement>(null)
  const filaRefs = useRef(new Map<string, HTMLTableRowElement>())
  const virtual = filas.length > umbralVirtual
  const virtualizador = useVirtualizer({
    count: filas.length,
    getScrollElement: () => contenedorRef.current,
    estimateSize: () => ALTO_FILA_ESTIMADO,
    overscan: 8,
    enabled: virtual,
    // Sin layout (jsdom, o la tabla aún oculta) el contenedor mide 0 y la fila también: con el rectángulo de
    // reserva y el alto estimado la virtualización pinta un puñado de filas en vez de ninguna o las 500.
    initialRect: RECT_DE_RESERVA,
    observeElementRect: (v, cb) => observeElementRect(v, (r) => cb(r.height > 0 ? r : RECT_DE_RESERVA)),
    measureElement: (el) => el.getBoundingClientRect().height || ALTO_FILA_ESTIMADO,
  })

  const [columnaPulsada, setColumnaPulsada] = useState<string>('')
  const [resaltada, setResaltada] = useState<{ fila: string; columna: string } | null>(null)
  useEffect(() => {
    if (!resaltada) return
    const t = setTimeout(() => setResaltada(null), MS_RESALTADO)
    return () => clearTimeout(t)
  }, [resaltada])

  function desplazarA(indice: number) {
    if (virtual) virtualizador.scrollToIndex(indice)
    else filaRefs.current.get(filas[indice].id)?.scrollIntoView({ block: 'nearest' })
  }

  const desplazadaRef = useRef<string | null>(null)
  // Selección impuesta desde fuera (p. ej. el maestro de IMEIs reseleccionando el IMEI al volver del detalle, o el
  // enlace "Id Rep. Anterior"): si la fila no está a la vista, desplazar hasta ella con tres filas de contexto por
  // encima (calco de tabla.scrollTo(idx - 3)). Con una selección por clic la fila ya está a la vista y no pasa nada.
  // Un refresco de datos (poll) cambia la identidad de `filas` sin cambiar `seleccionada`: no debe volver a
  // desplazar, así que se recuerda en `desplazadaRef` la última selección ya desplazada y solo se actúa cuando
  // `seleccionada` cambia desde fuera (o cuando las filas llegan después de fijarla).
  useEffect(() => {
    if (seleccionada === desplazadaRef.current) return
    if (seleccionada === null) {
      desplazadaRef.current = null
      return
    }
    const idx = filas.findIndex((r) => r.id === seleccionada)
    if (idx < 0) return
    if (virtual) {
      if (!virtualizador.getVirtualItems().some((v) => v.index === idx)) virtualizador.scrollToIndex(Math.max(0, idx - 3), { align: 'start' })
    } else {
      filaRefs.current.get(seleccionada)?.scrollIntoView({ block: 'nearest' })
    }
    desplazadaRef.current = seleccionada
  }, [seleccionada, filas, virtual, virtualizador])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!onSeleccionar || filas.length === 0) return
    const idx = seleccionada === null ? -1 : filas.findIndex((r) => r.id === seleccionada)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const nuevo = e.key === 'ArrowDown' ? Math.min(idx + 1, filas.length - 1) : Math.max(idx - 1, 0)
      onSeleccionar(filas[nuevo].id)
      desplazarA(nuevo)
    } else if (e.key === 'Enter' && idx >= 0 && onAbrir) {
      e.preventDefault()
      onAbrir(filas[idx].original)
    }
  }

  function pintarFila(row: Row<T>, indice: number) {
    const id = row.id
    const sel = seleccionada === id
    const tr = (
      <TableRow
        key={id}
        data-index={indice}
        ref={(el: HTMLTableRowElement | null) => {
          if (el) {
            filaRefs.current.set(id, el)
            if (virtual) virtualizador.measureElement(el)
          } else {
            filaRefs.current.delete(id)
          }
        }}
        data-state={sel ? 'selected' : undefined}
        aria-selected={onSeleccionar ? sel : undefined}
        className={cn(
          'border-b border-fila-sep',
          filaClase?.(row.original),
          onSeleccionar && 'cursor-default data-[state=selected]:bg-azul-medio data-[state=selected]:text-crema',
        )}
        onClick={() => onSeleccionar?.(id)}
        onDoubleClick={() => onAbrir?.(row.original)}
        onContextMenu={(e) => {
          setColumnaPulsada((e.target as HTMLElement).closest('td')?.dataset.columna ?? '')
          onSeleccionar?.(id)
        }}
      >
        {row.getVisibleCells().map((c) => (
          <TableCell
            key={c.id}
            data-columna={c.column.id}
            className={cn('text-[12px]', resaltada?.fila === id && resaltada.columna === c.column.id && 'bg-fila-modificada-bg')}
          >
            {flexRender(c.column.columnDef.cell, c.getContext())}
          </TableCell>
        ))}
      </TableRow>
    )
    if (!menuFila) return tr
    const celda: CeldaPulsada = { columnaId: columnaPulsada, resaltar: () => setResaltada({ fila: id, columna: columnaPulsada }) }
    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>{tr}</ContextMenuTrigger>
        <ContextMenuContent>{menuFila(row.original, celda)}</ContextMenuContent>
      </ContextMenu>
    )
  }

  const items = virtual ? virtualizador.getVirtualItems() : null
  const total = virtual ? virtualizador.getTotalSize() : 0
  const arriba = items && items.length > 0 ? items[0].start : 0
  const abajo = items && items.length > 0 ? total - items[items.length - 1].end : 0

  return (
    <div
      ref={contenedorRef}
      tabIndex={onSeleccionar ? 0 : undefined}
      onKeyDown={onKeyDown}
      className="overflow-auto rounded-md bg-superficie outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      style={{ maxHeight: alturaMax }}
    >
      <table
        className={cn('table-fixed caption-bottom text-sm', ajuste === 'estirar' && 'w-full')}
        style={ajuste === 'estirar' ? { minWidth: suma } : { width: suma }}
      >
        <colgroup>
          {hojas.map((c, i) => (
            <col key={c.id} style={{ width: ajuste === 'estirar' ? `${(anchos[i] / suma) * 100}%` : anchos[i] }} />
          ))}
        </colgroup>
        <TableHeader className="sticky top-0 z-10 bg-crema">
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => {
                const dir = h.column.getIsSorted()
                const contenido = h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())
                return (
                  <TableHead
                    key={h.id}
                    colSpan={h.colSpan}
                    aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
                    className="text-[12px] font-bold text-azul-medio"
                  >
                    {ordenacion && h.column.getCanSort() ? (
                      <button type="button" className="cursor-pointer" onClick={h.column.getToggleSortingHandler()}>
                        {contenido}
                      </button>
                    ) : (
                      contenido
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {filas.length === 0 && (
            <TableRow>
              <TableCell colSpan={hojas.length} className="py-8 text-center text-azul-gris">{vacio}</TableCell>
            </TableRow>
          )}
          {!virtual && filas.map((r, i) => pintarFila(r, i))}
          {virtual && items && (
            <>
              {arriba > 0 && <tr aria-hidden style={{ height: arriba }}><td colSpan={hojas.length} /></tr>}
              {items.map((vi) => pintarFila(filas[vi.index], vi.index))}
              {abajo > 0 && <tr aria-hidden style={{ height: abajo }}><td colSpan={hojas.length} /></tr>}
            </>
          )}
        </TableBody>
      </table>
    </div>
  )
}
