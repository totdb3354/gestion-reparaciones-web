import type { ColumnDef } from '@tanstack/react-table'
import type { CompraComponente, CompraOtro } from '@/shared/api/client'
import { FMT_FECHA_PEDIDO, formatear } from '@/shared/lib/fechas'
import { formatearImporte, formatearNumero, simboloDivisa } from '@/shared/lib/importes'
import { cn } from '@/shared/lib/utils'
import { CREMA_EN_FILA_SELECCIONADA } from '@/shared/ui/DataTable'
import { BadgeEstadoPedido } from './BadgeEstadoPedido'
import { esCompra, idVisible, marcaPrecioCero, marcaTotalCero, nombrePedido, textoCantidad, totalFila, type Pedido } from './reglas'

/** prefWidth de StockView.fxml :141-149 (componentes) y :156-163 (otros); el ID es de la 0.9.6 y el bloque de la 0.9.9 (no estaban en el JavaFX). */
export const ANCHOS_PEDIDOS = { id: 55, bloque: 64, fecha: 115, componente: 190, proveedor: 130, cantidad: 50, precio: 68, eur: 68, estado: 110 } as const
export const ANCHOS_OTROS = { id: 55, fecha: 115, concepto: 220, proveedor: 130, cantidad: 60, precio: 80, eur: 80, estado: 110 } as const

/** Celdas P.Unit. y EUR (:797-849): el importe y, si hay marca, el importe en ámbar negrita y un "!" de 12 px a 4 px. */
function celdaImporte(texto: string, marca: boolean) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn(marca && 'font-bold text-fila-solicitud-brd')}>{texto}</span>
      {marca && <span className="text-[12px] font-bold text-fila-solicitud-brd">!</span>}
    </span>
  )
}

const precio = (p: Pedido) => celdaImporte(formatearImporte(p.precioUnidadPedido, simboloDivisa(p.divisa)), marcaPrecioCero(p))
const eur = (p: Pedido) => celdaImporte(formatearImporte(totalFila(p), '€'), marcaTotalCero(p))
const fecha = (p: Pedido) => formatear(p.fechaPedido, FMT_FECHA_PEDIDO)
/** Número del pedido en la base de datos (0.9.6), en gris para que no compita con la fecha. */
const celdaId = (id: number) => <span className={cn('text-azul-gris', CREMA_EN_FILA_SELECCIONADA)}>{id}</span>

/** `vista` (0.9.9, spec §6.2): en la agrupada no va «Proveedor» (está en la cabecera del bloque); en la plana va
 *  «Bloque» tras «ID». */
export function crearColumnasPedidos({ onComponente, vista = 'plana' }: { onComponente: (p: CompraComponente) => void; vista?: 'agrupada' | 'plana' }): ColumnDef<CompraComponente>[] {
  const id: ColumnDef<CompraComponente> = { id: 'id', header: 'ID', size: ANCHOS_PEDIDOS.id, maxSize: ANCHOS_PEDIDOS.id, cell: ({ row }) => celdaId(row.original.idCompra) }
  const bloque: ColumnDef<CompraComponente> = {
    id: 'bloque', header: 'Bloque', size: ANCHOS_PEDIDOS.bloque, maxSize: ANCHOS_PEDIDOS.bloque,
    cell: ({ row }) => <span className={cn('text-azul-gris', CREMA_EN_FILA_SELECCIONADA)}>{row.original.idBloque ?? ''}</span>,
  }
  const resto: ColumnDef<CompraComponente>[] = [
    { id: 'fecha', header: 'Pedido', size: ANCHOS_PEDIDOS.fecha, maxSize: ANCHOS_PEDIDOS.fecha, accessorFn: fecha },
    {
      id: 'componente', header: 'Componente', size: ANCHOS_PEDIDOS.componente,
      // Calco del Label con TEXTO_ACCION, cursor mano y subrayado al pasar (:762-780), con la clase del enlace "En Camino"
      // de Stock (stock/columnas.tsx:50): lleva a Stock actual con la fila del componente seleccionada. Sin stopPropagation:
      // el clic también selecciona la fila antes de navegar, como en el JavaFX (StockController :762-772).
      cell: ({ row }) => (
        <button type="button" onClick={() => onComponente(row.original)} className="cursor-pointer text-texto-accion hover:underline">
          {row.original.tipoComponente}
        </button>
      ),
    },
    { id: 'proveedor', header: 'Proveedor', size: ANCHOS_PEDIDOS.proveedor, accessorFn: (p) => p.nombreProveedor },
    { id: 'cantidad', header: 'Cant.', size: ANCHOS_PEDIDOS.cantidad, maxSize: ANCHOS_PEDIDOS.cantidad, accessorFn: textoCantidad },
    { id: 'precio', header: 'P.Unit.', size: ANCHOS_PEDIDOS.precio, maxSize: ANCHOS_PEDIDOS.precio, cell: ({ row }) => precio(row.original) },
    { id: 'eur', header: 'EUR', size: ANCHOS_PEDIDOS.eur, maxSize: ANCHOS_PEDIDOS.eur, cell: ({ row }) => eur(row.original) },
    { id: 'estado', header: 'Estado', size: ANCHOS_PEDIDOS.estado, maxSize: ANCHOS_PEDIDOS.estado, cell: ({ row }) => <BadgeEstadoPedido pedido={row.original} /> },
  ]
  return vista === 'agrupada' ? [id, ...resto.filter((c) => c.id !== 'proveedor')] : [id, bloque, ...resto]
}

/** Tabla de otros (:1046-1126): Concepto es un Label sin enlace. */
export function crearColumnasOtros(): ColumnDef<CompraOtro>[] {
  return [
    { id: 'id', header: 'ID', size: ANCHOS_OTROS.id, maxSize: ANCHOS_OTROS.id, cell: ({ row }) => celdaId(row.original.idCompraOtro) },
    { id: 'fecha', header: 'Pedido', size: ANCHOS_OTROS.fecha, maxSize: ANCHOS_OTROS.fecha, accessorFn: fecha },
    { id: 'concepto', header: 'Concepto', size: ANCHOS_OTROS.concepto, accessorFn: (p) => p.concepto },
    { id: 'proveedor', header: 'Proveedor', size: ANCHOS_OTROS.proveedor, accessorFn: (p) => p.nombreProveedor },
    { id: 'cantidad', header: 'Cant.', size: ANCHOS_OTROS.cantidad, maxSize: ANCHOS_OTROS.cantidad, accessorFn: textoCantidad },
    { id: 'precio', header: 'P.Unit.', size: ANCHOS_OTROS.precio, maxSize: ANCHOS_OTROS.precio, cell: ({ row }) => precio(row.original) },
    { id: 'eur', header: 'EUR', size: ANCHOS_OTROS.eur, maxSize: ANCHOS_OTROS.eur, cell: ({ row }) => eur(row.original) },
    { id: 'estado', header: 'Estado', size: ANCHOS_OTROS.estado, maxSize: ANCHOS_OTROS.estado, cell: ({ row }) => <BadgeEstadoPedido pedido={row.original} /> },
  ]
}

/** Calco del rowFactory (:853-882): barra izquierda de 8 px por estado (pendiente ámbar a mano, en camino solo si urgente,
 *  recibido verde, parcial violeta) y el cancelado sin barra con opacidad 0.45 en toda la fila. La seleccionada la pinta
 *  DataTable (navy, texto crema, barra transparente); el JavaFX aplica el estilo navy antes del switch de estado
 *  (`actualizarEstilo`, StockController :857-863), así que un cancelado seleccionado queda navy liso, sin la opacidad. */
export function claseFilaPedido(p: Pedido): string {
  switch (p.estado) {
    case 'pendiente':
      return 'border-l-8 border-l-fila-pendiente-brd'
    case 'en_camino':
      return p.esUrgente ? 'border-l-8 border-l-fila-solicitud-brd' : 'border-l-8 border-l-transparent'
    case 'recibido':
      return 'border-l-8 border-l-fila-recibido-brd'
    case 'parcial':
      return 'border-l-8 border-l-fila-parcial-brd'
    case 'cancelado':
      return 'border-l-8 border-l-transparent opacity-45 data-[state=selected]:opacity-100'
    default:
      return 'border-l-8 border-l-transparent'
  }
}

/** Calco de exportarPedidos (:1961-1983): las filas filtradas en el orden mostrado; Cantidad = pedida; total con la regla
 *  de unidades de la columna EUR; importes con `%.2f` (coma, sin símbolo); Estado = `name()`. Fecha en Madrid con año
 *  completo. 0.9.15 (spec «Añadir otro» §5.3): piezas y otros, con «Tipo» tras «ID»; el ID de un otro es «O-{id}» y su
 *  concepto va en «Componente». */
export const CABECERAS_CSV_PEDIDOS = ['ID', 'Tipo', 'Bloque', 'Nota del bloque', 'Fecha pedido', 'Componente', 'Cantidad', 'Urgente', 'Proveedor', 'Precio unidad', 'Divisa', 'Total EUR', 'Estado']
export function filaCsvPedido(p: Pedido): string[] {
  return [
    idVisible(p), esCompra(p) ? 'pieza' : 'otro', p.idBloque == null ? '' : String(p.idBloque), p.notaBloque ?? '',
    formatear(p.fechaPedido, 'dd/MM/yyyy HH:mm'), nombrePedido(p), String(p.cantidad), p.esUrgente ? 'Sí' : 'No', p.nombreProveedor,
    formatearNumero(p.precioUnidadPedido), p.divisa, formatearNumero(totalFila(p)), p.estado,
  ]
}

/** Calco de exportarOtros (:1985-2006): sin Urgente. */
export const CABECERAS_CSV_OTROS = ['ID', 'Fecha pedido', 'Concepto', 'Cantidad', 'Proveedor', 'Precio unidad', 'Divisa', 'Total EUR', 'Estado']
export function filaCsvOtro(p: CompraOtro): string[] {
  return [
    String(p.idCompraOtro), formatear(p.fechaPedido, 'dd/MM/yyyy HH:mm'), p.concepto, String(p.cantidad), p.nombreProveedor,
    formatearNumero(p.precioUnidadPedido), p.divisa, formatearNumero(totalFila(p)), p.estado,
  ]
}
