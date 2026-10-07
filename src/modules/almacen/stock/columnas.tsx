import type { ColumnDef } from '@tanstack/react-table'
import type { Componente } from '@/shared/api/client'
import { formatear } from '@/shared/lib/fechas'
import { estadoStock, type EstadoStock } from '@/shared/lib/semaforoStock'
import { cn } from '@/shared/lib/utils'
import { CREMA_EN_FILA_SELECCIONADA } from '@/shared/ui/DataTable'
import { BadgeEstadoStock } from './BadgeEstadoStock'
import { nombreComponente } from './filtros'
import { formatearConsumo, formatearPedir } from './prevision'

/** prefWidth de StockView.fxml :46-53; las tres de la previsión son de la 0.9.5. */
export const ANCHOS_STOCK = { componente: 230, enStock: 80, enCamino: 90, stockMinimo: 100, consumoDia: 95, pedir15: 90, pedir30: 90, ultimoPedido: 120, estado: 100 } as const

/** Un 0 en gris (no hay que pedir) y el resto en negrita, para que salten las piezas que sí. */
function celdaPedir(valor: number | null) {
  if (valor === null) return formatearPedir(valor)
  return <span className={cn(valor === 0 ? 'text-texto-vacio' : 'font-bold', CREMA_EN_FILA_SELECCIONADA)}>{valor}</span>
}

/** Previsión de pedidos (spec 0.9.5 §3.4): solo para SUPERTECNICO y ADMIN. */
function columnasPrevision(): ColumnDef<Componente>[] {
  return [
    { id: 'consumoDia', header: 'Consumo/día', size: ANCHOS_STOCK.consumoDia, maxSize: ANCHOS_STOCK.consumoDia, accessorFn: (c) => formatearConsumo(c.consumoDiario) },
    { id: 'pedir15', header: 'Pedir 15 d', size: ANCHOS_STOCK.pedir15, maxSize: ANCHOS_STOCK.pedir15, cell: ({ row }) => celdaPedir(row.original.pedir15) },
    { id: 'pedir30', header: 'Pedir 30 d', size: ANCHOS_STOCK.pedir30, maxSize: ANCHOS_STOCK.pedir30, cell: ({ row }) => celdaPedir(row.original.pedir30) },
  ]
}

const BORDE_POR_ESTADO: Record<EstadoStock, string> = {
  OK: 'border-l-transparent',
  Bajo: 'border-l-fila-solicitud-brd',
  'Sin stock': 'border-l-rojo-sin-stock',
  Desactivado: 'border-l-transparent',
}

/** Calco del rowFactory (:433-459): borde izquierdo de 8 px por estado; la desactivada va con opacidad 0.45 y, al
 *  seleccionarse, se ve navy atenuado con el texto claro (stock-fila-desactivada-seleccionada.png): la selección de
 *  DataTable se aplica igual y la opacidad la atenúa. */
export function claseFilaStock(c: Componente): string {
  const estado = estadoStock(c)
  if (!c.activo) return 'border-l-8 border-l-transparent opacity-45'
  return cn('border-l-8', BORDE_POR_ESTADO[estado])
}

/** Parámetros con los que "En Camino" (y el ítem "Pedir" no: ese va por idCom) abren Pedidos (spec 4a, S8): calco de
 *  navegarAPedidosDeComponente (:217-231), que marca pendiente + en camino + parcial y rellena el buscador con el tipo. */
export function parametrosPedidos(c: Componente): string {
  return new URLSearchParams({ estados: 'pendiente,en camino,parcial', buscar: c.tipo }).toString()
}

export function crearColumnasStock({ onEnCamino, conPrevision = false }: { onEnCamino: (c: Componente) => void; conPrevision?: boolean }): ColumnDef<Componente>[] {
  return [
    // whitespace-pre: el sufijo "  (compartido)" lleva dos espacios, que HTML colapsaría (la celda ya es whitespace-nowrap).
    {
      id: 'componente', header: 'Componente', size: ANCHOS_STOCK.componente, accessorFn: nombreComponente,
      cell: ({ row }) => <span className="whitespace-pre">{nombreComponente(row.original)}</span>,
    },
    { id: 'enStock', header: 'En Stock', size: ANCHOS_STOCK.enStock, maxSize: ANCHOS_STOCK.enStock, accessorFn: (c) => String(c.stock) },
    {
      id: 'enCamino', header: 'En Camino', size: ANCHOS_STOCK.enCamino, maxSize: ANCHOS_STOCK.enCamino,
      cell: ({ row }) => {
        const c = row.original
        if (c.enCamino <= 0) return '—'
        // Calco del Label con TEXTO_ACCION, cursor mano y subrayado al pasar (:305-324).
        return (
          <button type="button" onClick={(e) => { e.stopPropagation(); onEnCamino(c) }} className="cursor-pointer text-texto-accion hover:underline">
            {c.enCamino}
          </button>
        )
      },
    },
    { id: 'stockMinimo', header: 'Stock Mínimo', size: ANCHOS_STOCK.stockMinimo, maxSize: ANCHOS_STOCK.stockMinimo, accessorFn: (c) => String(c.stockMinimo) },
    ...(conPrevision ? columnasPrevision() : []),
    {
      id: 'ultimoPedido', header: 'Último pedido', size: ANCHOS_STOCK.ultimoPedido, maxSize: ANCHOS_STOCK.ultimoPedido,
      // formatear pasa de UTC a hora de Madrid, como el resto de la web y el CSV del JavaFX; la tabla del JavaFX pinta el día UTC
      // sin convertir (StockController:328-330). Diferencia aceptada (decisión 8), anotada en la ficha.
      cell: ({ row }) => <span className={CREMA_EN_FILA_SELECCIONADA}>{row.original.ultimoPedido ? formatear(row.original.ultimoPedido, 'dd/MM/yyyy') : '—'}</span>,
    },
    { id: 'estado', header: 'Estado', size: ANCHOS_STOCK.estado, maxSize: ANCHOS_STOCK.estado, cell: ({ row }) => <BadgeEstadoStock estado={estadoStock(row.original)} /> },
  ]
}

/** Calco de exportarStock (:1937-1959): la lista filtrada, tipo SIN "(compartido)", sin "Último pedido" y con "Fecha
 *  registro" (que la tabla no muestra); cabecera "Stock mínimo" en minúscula, como el JavaFX. */
export const CABECERAS_CSV_STOCK = ['Tipo', 'Stock', 'Stock mínimo', 'Estado', 'En camino', 'Fecha registro']
export const CABECERAS_CSV_PREVISION = ['Consumo/día', 'Pedir 15 d', 'Pedir 30 d']
export function cabecerasCsvStock(conPrevision: boolean): string[] {
  return conPrevision ? [...CABECERAS_CSV_STOCK, ...CABECERAS_CSV_PREVISION] : CABECERAS_CSV_STOCK
}
export function filaCsvStock(c: Componente, conPrevision = false): string[] {
  const fila = [c.tipo, String(c.stock), String(c.stockMinimo), estadoStock(c), String(c.enCamino), formatear(c.fechaRegistro, 'dd/MM/yyyy HH:mm')]
  return conPrevision ? [...fila, formatearConsumo(c.consumoDiario), formatearPedir(c.pedir15), formatearPedir(c.pedir30)] : fila
}
