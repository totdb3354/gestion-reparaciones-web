import type { Componente } from '@/shared/api/client'
import { estadoStock, type EstadoStock } from '@/shared/lib/semaforoStock'

export type ConteosDonut = { ok: number; bajo: number; sinStock: number; total: number }

/** Calco de actualizarChart (:495-501): sobre TODA la lista (sin filtros), solo activos; el negativo no entra en ningún
 *  sector (los filtros del JavaFX son stock > min, 0 < stock ≤ min y stock == 0). Los compartidos cuentan como filas. */
export function conteosDonut(lista: Componente[]): ConteosDonut {
  let ok = 0, bajo = 0, sinStock = 0
  for (const c of lista) {
    if (!c.activo || c.stock < 0) continue
    const e = estadoStock(c)
    if (e === 'OK') ok += 1
    else if (e === 'Bajo') bajo += 1
    else if (e === 'Sin stock') sinStock += 1
  }
  return { ok, bajo, sinStock, total: ok + bajo + sinStock }
}

/** Recharts colorea con atributos `fill` SVG, no con clases, así que aquí van los hex de los tokens (fila-recibido-brd,
 *  ambar-grafico, rojo-sin-stock, texto-accion): única excepción, documentada, a "ningún color a mano". */
export const COLORES_DONUT = { ok: '#3A7D44', bajo: '#C77A00', sinStock: '#B03040' } as const
export const COLOR_BARRA_PEDIDO = '#4A6FA5'

/** Calco de cargarChartSku (:573-577). */
export function colorBarraStock(estado: EstadoStock): string {
  if (estado === 'Sin stock') return COLORES_DONUT.sinStock
  if (estado === 'Bajo') return COLORES_DONUT.bajo
  return COLORES_DONUT.ok
}
