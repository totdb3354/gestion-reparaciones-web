import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState,
} from '@tanstack/react-table'
import { measureElement as medirElementoPorDefecto, observeElementRect, useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type SyntheticEvent } from 'react'
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
   *  anchos del Historial, `prefWidth = max(min, min·u)`), con scroll horizontal por debajo de la suma; si alguna
   *  columna declara `maxSize` (el maxWidth del FXML), no pasa de él y lo que cede queda en blanco (`anchosEstirados`). */
  ajuste?: 'fijo' | 'estirar'
  seleccionada?: string | null
  /** Selección hecha en la propia tabla (clic, clic derecho, flechas).
   *  La página debe aplicar el id de forma síncrona (p. ej. `onSeleccionar={setSeleccionada}`): la marca que distingue esta
   *  selección de una impuesta desde fuera solo vale para el primer efecto de desplazamiento que corre después. */
  onSeleccionar?: (id: string | null) => void
  /** Filas que quedan por encima de la seleccionada cuando la selección llega desde fuera y la tabla se desplaza: con 0
   *  (por defecto) la fila queda justo debajo de la cabecera, como `tabla.scrollTo(i)`; con 3, como
   *  `tabla.scrollTo(Math.max(0, idx - 3))`. */
  filasContexto?: number
  /** Petición de la página para volver a desplazar hasta `seleccionada` y enfocar la tabla aunque la selección no haya
   *  cambiado: cada valor nuevo cuenta como una petición (p. ej. un contador que sube en cada clic). Calco de
   *  `select(i); scrollTo(i); requestFocus()` del enlace "Id Rep. Anterior", que actúa en cada clic aunque esa fila ya
   *  esté seleccionada. Si la fila no está en la tabla no hace nada, y la petición no queda pendiente. */
  pedirDesplazamiento?: number
  /** Doble clic o Enter sobre la fila seleccionada. */
  onAbrir?: (row: T) => void
  /** Ordenación por clic en la cabecera; apagada por defecto porque el JavaFX no ordena por clic. */
  ordenacion?: boolean
  /** Altura máxima del contenedor con scroll. */
  alturaMax?: string
  /** A partir de cuántas filas se pintan solo las visibles (el TableView virtualiza siempre). */
  umbralVirtual?: number
  /** Alto de cada fila de datos en px (calco de `setFixedCellSize`); también es el alto que usa la virtualización.
   *  En una tabla CSS el alto de un `<tr>` es un mínimo: una celda más alta estira la fila en vez de recortarse. */
  altoFila?: number
}

/** Borra el `size: 150` que ColumnSizing inyecta por defecto: así `columnDef.size` refleja lo que declaró el consumidor. */
const COLUMNA_POR_DEFECTO = { size: undefined } as const
const ANCHO_SIN_SIZE = 150
const ALTO_FILA_ESTIMADO = 44
const MS_RESALTADO = 600
/** Ventana de reserva mientras el contenedor no tiene layout: jsdom (y un contenedor oculto) mide 0×0 y la
 *  virtualización calcularía una ventana visible de 0 px, sin pintar ninguna fila. */
const RECT_DE_RESERVA = { width: 1000, height: 600 }

/** Anchos en px del ajuste 'estirar' con topes, calco de aplicarAnchosDetalle del JavaFX: cada columna pide
 *  max(min, min·u), con u = disponible / Σmin, y se acota a [min, max] por su cuenta (TableColumnBase.doSetWidth →
 *  boundedSize, donde un tope menor que el mínimo deja el mínimo). Lo que cede una columna topada queda en blanco: no
 *  se reparte entre las demás. No redondea: los anchos pueden ser fraccionarios, como los double del TableView. */
export function anchosEstirados(minimos: number[], maximos: (number | undefined)[], disponible: number): number[] {
  const sumaMinimos = minimos.reduce((a, b) => a + b, 0)
  const u = sumaMinimos > 0 ? disponible / sumaMinimos : 1
  return minimos.map((min, i) => {
    const preferido = Math.max(min, min * u)
    const tope = maximos[i]
    return tope === undefined ? preferido : Math.min(preferido, Math.max(min, tope))
  })
}

/** Tope de ancho declarado en la columna; el `maxSize` que TanStack pone por defecto (MAX_SAFE_INTEGER) no cuenta. */
function topeDeColumna(maxSize: number | undefined): number | undefined {
  return maxSize !== undefined && maxSize < Number.MAX_SAFE_INTEGER ? maxSize : undefined
}

/** React propaga los eventos de lo que se pinta en un portal por el árbol de componentes, no por el DOM: el menú
 *  contextual de la fila (o un popup abierto desde una celda) haría llegar sus teclas y clics al contenedor y a la fila.
 *  La tabla solo atiende los que nacen dentro de su propio DOM. */
function nacioDentro(e: SyntheticEvent) {
  return e.currentTarget.contains(e.target as Node)
}

/** Desplaza solo el contenedor de la tabla hasta `fila`, como el VirtualFlow del TableView, que solo mueve su propia
 *  lista (`scrollIntoView` movería también la página y cualquier otro ancestro con scroll). La cabecera es sticky y tapa
 *  la parte de arriba del contenedor, así que se descuenta su alto medido. 'arriba' deja la fila justo debajo de la
 *  cabecera (`scrollTo(i)` → `scrollToTop`); 'cercana' mueve lo justo para que se vea entera (las flechas).
 *  Un `<tr>` estático tiene la `<table>` como offsetParent y la tabla empieza arriba del todo del contenido del
 *  contenedor, así que su offsetTop es su posición dentro del scroll (con la cabecera incluida). */
function desplazarContenedor(contenedor: HTMLElement, fila: HTMLElement, altoCabecera: number, alinear: 'arriba' | 'cercana') {
  const bajoCabecera = Math.max(0, fila.offsetTop - altoCabecera)
  if (alinear === 'arriba' || contenedor.scrollTop > bajoCabecera) {
    contenedor.scrollTop = bajoCabecera
    return
  }
  const alFinal = fila.offsetTop + fila.offsetHeight - contenedor.clientHeight
  if (contenedor.scrollTop < alFinal) contenedor.scrollTop = alFinal
}

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
  filasContexto = 0,
  pedirDesplazamiento,
  onAbrir,
  ordenacion = false,
  alturaMax = 'calc(100dvh - 330px)',
  umbralVirtual = 200,
  altoFila,
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
  const topes = hojas.map((c) => topeDeColumna(c.columnDef.maxSize))
  const conTopes = ajuste === 'estirar' && topes.some((t) => t !== undefined)
  const filas = table.getRowModel().rows

  const contenedorRef = useRef<HTMLDivElement>(null)
  const cabeceraRef = useRef<HTMLTableSectionElement>(null)
  const filaRefs = useRef(new Map<string, HTMLTableRowElement>())

  // Con topes, los porcentajes no bastan (una columna topada deja de crecer y lo que cede queda en blanco): se mide el
  // ancho útil del contenedor y los anchos se pintan en px. contentRect excluye la barra de scroll vertical, como
  // clientWidth, pero es fraccionario: redondeado hacia abajo, la tabla nunca pasa del ancho real (clientWidth puede
  // redondear hacia arriba y sacar una barra de scroll horizontal por medio píxel). Sin medida (jsdom, tabla oculta)
  // se quedan los porcentajes.
  const [anchoContenedor, setAnchoContenedor] = useState(0)
  useLayoutEffect(() => {
    const contenedor = contenedorRef.current
    if (!conTopes || !contenedor) return
    const observador = new ResizeObserver((entradas) => {
      const ultima = entradas[entradas.length - 1]
      if (ultima) setAnchoContenedor(Math.floor(ultima.contentRect.width))
    })
    observador.observe(contenedor)
    return () => observador.disconnect()
  }, [conTopes])
  const anchosPx = conTopes && anchoContenedor > 0 ? anchosEstirados(anchos, topes, anchoContenedor) : null
  const virtual = filas.length > umbralVirtual
  const virtualizador = useVirtualizer({
    count: filas.length,
    getScrollElement: () => contenedorRef.current,
    estimateSize: () => altoFila ?? ALTO_FILA_ESTIMADO,
    overscan: 8,
    enabled: virtual,
    // Sin layout (jsdom, o la tabla aún oculta) el contenedor mide 0 y la fila también: con el rectángulo de
    // reserva y el alto estimado la virtualización pinta un puñado de filas en vez de ninguna o las 500.
    initialRect: RECT_DE_RESERVA,
    observeElementRect: (v, cb) => observeElementRect(v, (r) => cb(r.height > 0 ? r : RECT_DE_RESERVA)),
    // Medición por defecto de la librería (usa la caché y el borderBoxSize del ResizeObserver en navegador real);
    // en jsdom no hay ResizeObserver ni layout, así que devuelve 0 y cae al alto estimado (o al alto de fila fijo).
    measureElement: (el, entry, inst) => medirElementoPorDefecto(el, entry, inst) || (altoFila ?? ALTO_FILA_ESTIMADO),
  })

  const [columnaPulsada, setColumnaPulsada] = useState<string>('')
  const [resaltada, setResaltada] = useState<{ fila: string; columna: string } | null>(null)
  useEffect(() => {
    if (!resaltada) return
    const t = setTimeout(() => setResaltada(null), MS_RESALTADO)
    return () => clearTimeout(t)
  }, [resaltada])

  // Flechas: la fila a la que se llega se acerca lo justo para verse entera.
  function desplazarA(indice: number) {
    if (virtual) {
      virtualizador.scrollToIndex(indice)
      return
    }
    const contenedor = contenedorRef.current
    const fila = filaRefs.current.get(filas[indice].id)
    if (contenedor && fila) desplazarContenedor(contenedor, fila, cabeceraRef.current?.offsetHeight ?? 0, 'cercana')
  }

  // Última selección hecha en la propia tabla (clic, clic derecho, flechas): esa fila ya está a la vista (las flechas
  // la acercan con desplazarA), así que el efecto de abajo no desplaza por ella.
  const seleccionInternaRef = useRef<string | null>(null)
  function seleccionarDesdeTabla(id: string) {
    if (!onSeleccionar) return
    seleccionInternaRef.current = id
    onSeleccionar(id)
  }

  const desplazadaRef = useRef<string | null>(null)
  const peticionAtendidaRef = useRef(pedirDesplazamiento)
  // Selección impuesta desde fuera (el enlace "Id Rep. Anterior", o el maestro de IMEIs reseleccionando el IMEI al
  // volver del detalle): desplazar siempre el contenedor hasta dejar justo debajo de la cabecera la fila `filasContexto`
  // posiciones por encima, calco de tabla.scrollTo(i) (enlace) y de tabla.scrollTo(Math.max(0, idx - 3))
  // (restaurarSeleccion). El TableView desplaza aunque la fila ya se vea.
  // Un refresco de datos (poll) cambia la identidad de `filas` sin cambiar `seleccionada`: no debe volver a
  // desplazar, así que se recuerda en `desplazadaRef` la última selección ya atendida y solo se actúa cuando
  // `seleccionada` cambia (o cuando las filas llegan después de fijarla), o cuando llega una petición nueva
  // (`pedirDesplazamiento`), que además enfoca la tabla.
  useEffect(() => {
    // La marca de origen interno solo vale para el primer efecto después del clic o la tecla que la puso.
    const interna = seleccionInternaRef.current !== null && seleccionInternaRef.current === seleccionada
    seleccionInternaRef.current = null
    // Cada petición se atiende una sola vez, esté o no su fila en la tabla: si la fila apareciera más tarde (al quitar
    // un filtro), la tabla no debe quitarle el foco a lo que el usuario esté usando en ese momento.
    const pedida = pedirDesplazamiento !== peticionAtendidaRef.current
    peticionAtendidaRef.current = pedirDesplazamiento
    if (seleccionada === desplazadaRef.current && !pedida) return
    if (seleccionada === null) {
      desplazadaRef.current = null
      return
    }
    if (pedida || !interna) {
      const idx = filas.findIndex((r) => r.id === seleccionada)
      if (idx < 0) return
      const arriba = Math.max(0, idx - filasContexto)
      if (virtual) {
        virtualizador.scrollToIndex(arriba, { align: 'start' })
      } else {
        const contenedor = contenedorRef.current
        const fila = filaRefs.current.get(filas[arriba].id)
        if (contenedor && fila) desplazarContenedor(contenedor, fila, cabeceraRef.current?.offsetHeight ?? 0, 'arriba')
      }
      // requestFocus() del TableView: el foco pasa a la tabla (las flechas siguen desde esa fila) sin mover la página.
      if (pedida) contenedorRef.current?.focus({ preventScroll: true })
    }
    desplazadaRef.current = seleccionada
  }, [seleccionada, filas, virtual, virtualizador, filasContexto, pedirDesplazamiento])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Ni las teclas que ya ha gestionado otro (un ítem de menú, una casilla) ni las de un portal (el menú contextual).
    if (!onSeleccionar || filas.length === 0 || e.defaultPrevented || !nacioDentro(e)) return
    const idx = seleccionada === null ? -1 : filas.findIndex((r) => r.id === seleccionada)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const nuevo = e.key === 'ArrowDown' ? Math.min(idx + 1, filas.length - 1) : Math.max(idx - 1, 0)
      seleccionarDesdeTabla(filas[nuevo].id)
      desplazarA(nuevo)
    } else if (e.key === 'Enter' && e.target === e.currentTarget && idx >= 0 && onAbrir) {
      // Solo con el foco en la propia tabla: con el foco en un botón de una celda, Enter es de ese botón.
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
        style={altoFila === undefined ? undefined : { height: altoFila }}
        // Las clases de la página van al final para que ganen en tailwind-merge (p. ej. su cursor o su hover); las de
        // la fila seleccionada llevan la variante data-[state=selected] y no chocan con las suyas.
        className={cn(
          'border-b border-fila-sep',
          onSeleccionar && 'cursor-default data-[state=selected]:bg-azul-medio data-[state=selected]:text-crema',
          filaClase?.(row.original),
        )}
        onClick={(e) => {
          if (nacioDentro(e)) seleccionarDesdeTabla(id)
        }}
        onDoubleClick={(e) => {
          if (nacioDentro(e)) onAbrir?.(row.original)
        }}
        onContextMenu={(e) => {
          if (!nacioDentro(e)) return
          setColumnaPulsada((e.target as HTMLElement).closest('td')?.dataset.columna ?? '')
          seleccionarDesdeTabla(id)
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
      // scroll-pt-10: la cabecera es sticky top-0 (~40 px). La selección y las flechas ya desplazan midiendo su alto, pero
      // los desplazamientos que hace el navegador por su cuenta (el foco al tabular a un botón de una celda, o al volver
      // a él al cerrar un diálogo) respetan scroll-padding-top y, sin él, dejarían ese control tapado por la cabecera.
      className="overflow-auto rounded-md bg-superficie outline-none focus-visible:ring-2 focus-visible:ring-ring/50 scroll-pt-10"
      style={{ maxHeight: alturaMax }}
    >
      <table
        className={cn('table-fixed caption-bottom text-sm', ajuste === 'estirar' && !anchosPx && 'w-full')}
        style={anchosPx ? { width: anchosPx.reduce((a, b) => a + b, 0), minWidth: suma } : ajuste === 'estirar' ? { minWidth: suma } : { width: suma }}
      >
        <colgroup>
          {hojas.map((c, i) => (
            <col key={c.id} style={{ width: anchosPx ? anchosPx[i] : ajuste === 'estirar' ? `${(anchos[i] / suma) * 100}%` : anchos[i] }} />
          ))}
        </colgroup>
        <TableHeader ref={cabeceraRef} className="sticky top-0 z-10 bg-crema">
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
