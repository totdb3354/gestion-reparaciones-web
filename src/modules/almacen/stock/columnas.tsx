import type { ColumnDef } from '@tanstack/react-table'
import type { Componente } from '@/shared/api/client'
import { formatear } from '@/shared/lib/fechas'
import { estadoStock, type EstadoStock } from '@/shared/lib/semaforoStock'
import { cn } from '@/shared/lib/utils'
import { CREMA_EN_FILA_SELECCIONADA } from '@/shared/ui/DataTable'
import { BadgeEstadoStock } from './BadgeEstadoStock'
import { nombreComponente } from './filtros'

/** prefWidth de StockView.fxml :46-53. */
export const ANCHOS_STOCK = { componente: 230, enStock: 80, enCamino: 90, stockMinimo: 100, ultimoPedido: 120, estado: 100 } as const

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

export function crearColumnasStock({ onEnCamino }: { onEnCamino: (c: Componente) => void }): ColumnDef<Componente>[] {
  return [
    // whitespace-pre: el sufijo "  (compartido)" lleva dos espacios, que HTML colapsaría (la celda ya es whitespace-nowrap).
    {
      id: 'componente', header: 'Componente', size: ANCHOS_STOCK.componente, accessorFn: nombreComponente,
      cell: ({ row }) => <span className="whitespace-pre">{nombreComponente(row.original)}</span>,
    },
    { id: 'enStock', header: 'En Stock', size: ANCHOS_STOCK.enStock, accessorFn: (c) => String(c.stock) },
    {
      id: 'enCamino', header: 'En Camino', size: ANCHOS_STOCK.enCamino,
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
    { id: 'stockMinimo', header: 'Stock Mínimo', size: ANCHOS_STOCK.stockMinimo, accessorFn: (c) => String(c.stockMinimo) },
    {
      id: 'ultimoPedido', header: 'Último pedido', size: ANCHOS_STOCK.ultimoPedido,
      // formatear pasa de UTC a hora de Madrid, como el resto de la web y el CSV del JavaFX; la tabla del JavaFX pinta el día UTC
      // sin convertir (StockController:328-330). Diferencia aceptada (decisión 8), anotada en la ficha.
      cell: ({ row }) => <span className={CREMA_EN_FILA_SELECCIONADA}>{row.original.ultimoPedido ? formatear(row.original.ultimoPedido, 'dd/MM/yyyy') : '—'}</span>,
    },
    { id: 'estado', header: 'Estado', size: ANCHOS_STOCK.estado, cell: ({ row }) => <BadgeEstadoStock estado={estadoStock(row.original)} /> },
  ]
}

/** Calco de exportarStock (:1937-1959): la lista filtrada, tipo SIN "(compartido)", sin "Último pedido" y con "Fecha
 *  registro" (que la tabla no muestra); cabecera "Stock mínimo" en minúscula, como el JavaFX. */
export const CABECERAS_CSV_STOCK = ['Tipo', 'Stock', 'Stock mínimo', 'Estado', 'En camino', 'Fecha registro']
export function filaCsvStock(c: Componente): string[] {
  return [c.tipo, String(c.stock), String(c.stockMinimo), estadoStock(c), String(c.enCamino), formatear(c.fechaRegistro, 'dd/MM/yyyy HH:mm')]
}
