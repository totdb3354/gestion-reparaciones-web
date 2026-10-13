import type { ReactNode } from 'react'
import type { Proveedor } from '@/shared/api/client'
import { formatearImporte, parsearDecimal, parsearEntero, simboloFormulario } from '@/shared/lib/importes'
import { Checkbox } from '@/shared/ui/checkbox'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useTasas } from '../tasa'
import { totalLinea } from './conversion'
import type { LineaBase } from './lineas'

/** Columnas tras la primera y la de Proveedor (FormularioCompraView.fxml:19-25): Cant. 55 · P.Unit. 80 · Urg. 45 ·
 *  Total EUR 90 · papelera 40 sin cabecera. */
const COLUMNAS = [
  { cabecera: 'Cant.', ancho: 55 },
  { cabecera: 'P.Unit.', ancho: 80 },
  { cabecera: 'Urg.', ancho: 45 },
  { cabecera: 'Total EUR', ancho: 90 },
  { cabecera: '', ancho: 40 },
]
/** Columna Proveedor: 155 px en el JavaFX. */
const ANCHO_PROVEEDOR = 155
/** ESTILO_EDITABLE del JavaFX (FC :321-379): caja blanca, borde #C2C8D0, radio 3, padding 5 8. */
const CLASE_EDITABLE = 'h-[26px] w-full min-w-0 rounded-[3px] border border-fila-sep bg-superficie px-2 text-[12px] text-azul-medio outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

export type PrimeraColumna<L> = { cabecera: string; ancho: number; celda: (linea: L, n: number) => ReactNode }

type Props<L extends LineaBase> = {
  primera: PrimeraColumna<L>
  /** Celda de la columna Proveedor: el combo de la línea, el nombre fijo o «Pasar a…». Con null no hay columna (los
   *  recuadros de «Nuevo pedido», 0.9.9, dicen su proveedor en la cabecera). */
  proveedor: ((linea: L, n: number) => ReactNode) | null
  lineas: L[]
  /** Para la divisa de cada línea: la de su proveedor; sin proveedor, EUR. */
  proveedores: Proveedor[]
  /** Texto de la fila de la tabla vacía. */
  vacio: string
  seleccionada: number | null
  /** Línea hasta la que se desplaza la caja con scroll: la de «+ Añadir línea» o la que queda al juntar una repetida. */
  desplazarA: number | null
  onSeleccionar: (id: number) => void
  onCambiar: (id: number, cambio: Partial<LineaBase>) => void
  onQuitar: (id: number) => void
}

/** Tabla de líneas de los formularios de pedido: celdas siempre editables (P8), la fila seleccionada en navy y el Total
 *  EUR con la tasa de la divisa de cada línea. Sin proveedor, la línea se calcula como EUR (tasa 1.0 por defecto de
 *  LineaCompra). */
export function TablaLineas<L extends LineaBase>({ primera, proveedor, lineas, proveedores, vacio, seleccionada, desplazarA, onSeleccionar, onCambiar, onQuitar }: Props<L>) {
  const porId = new Map(proveedores.map((p) => [p.idProv, p]))
  const divisaDe = (l: LineaBase): string => (l.idProv === null ? undefined : porId.get(l.idProv)?.divisa) ?? 'EUR'
  const tasas = useTasas(Array.from(new Set(lineas.map(divisaDe))))
  const columnas = [primera, ...(proveedor === null ? [] : [{ cabecera: 'Proveedor', ancho: ANCHO_PROVEEDOR }]), ...COLUMNAS]
  const suma = columnas.reduce((a, c) => a + c.ancho, 0)

  function totalDe(l: L): string {
    const total = totalLinea(parsearDecimal(l.precio), tasas[divisaDe(l)]?.tasa ?? null, parsearEntero(l.cantidad))
    return total === null ? '—' : formatearImporte(total, '€')
  }

  return (
    <table className="w-full table-fixed text-sm">
      <colgroup>
        {columnas.map((c, i) => <col key={i} style={{ width: `${(c.ancho / suma) * 100}%` }} />)}
      </colgroup>
      <TableHeader className="bg-crema">
        <TableRow className="hover:bg-transparent">
          {columnas.map((c, i) => (
            <TableHead key={i} className="h-8 px-1 text-[12px] font-bold text-azul-medio">{c.cabecera}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {lineas.length === 0 && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columnas.length} className="py-8 text-center text-azul-gris">{vacio}</TableCell>
          </TableRow>
        )}
        {lineas.map((l, i) => {
          const n = i + 1
          return (
            <TableRow
              key={l.id}
              ref={l.id === desplazarA ? (el: HTMLTableRowElement | null) => { el?.scrollIntoView({ block: 'nearest' }) } : undefined}
              data-state={l.id === seleccionada ? 'selected' : undefined}
              // Enfocar cualquier campo de la fila la selecciona (FC :203-205); el foco burbujea en React.
              onFocus={() => onSeleccionar(l.id)}
              onClick={() => onSeleccionar(l.id)}
              className="group border-b border-fila-sep hover:bg-transparent data-[state=selected]:border-b-fila-selected-brd data-[state=selected]:bg-azul-medio data-[state=selected]:text-crema"
            >
              <TableCell className="px-1 py-1">{primera.celda(l, n)}</TableCell>
              {proveedor !== null && <TableCell className="px-1 py-1">{proveedor(l, n)}</TableCell>}
              <TableCell className="px-1 py-1">
                <input aria-label={`Cantidad línea ${n}`} value={l.cantidad} onChange={(e) => onCambiar(l.id, { cantidad: e.target.value })} className={CLASE_EDITABLE} />
              </TableCell>
              <TableCell className="px-1 py-1">
                <div className="flex items-center gap-1">
                  <input aria-label={`Precio línea ${n}`} value={l.precio} onChange={(e) => onCambiar(l.id, { precio: e.target.value })} className={CLASE_EDITABLE} />
                  <span className="shrink-0 text-[12px]">{simboloFormulario(divisaDe(l))}</span>
                </div>
              </TableCell>
              <TableCell className="px-1 py-1 text-center">
                <Checkbox aria-label={`Urgente línea ${n}`} checked={l.urgente} onCheckedChange={(v) => onCambiar(l.id, { urgente: v === true })} className="bg-superficie" />
              </TableCell>
              <TableCell className="px-1 py-1 text-[12px]">{totalDe(l)}</TableCell>
              <TableCell className="px-1 py-1 text-center">
                <button type="button" aria-label={`Quitar línea ${n}`} onClick={(e) => { e.stopPropagation(); onQuitar(l.id) }} className="cursor-pointer bg-transparent">
                  <img src="/borrar.png" alt="" className="h-[25px] w-[25px]" />
                </button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </table>
  )
}
