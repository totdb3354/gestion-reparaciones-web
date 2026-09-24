import type { Componente } from '@/shared/api/client'

/** Los cuatro valores del badge "Estado" de Stock actual, en el orden de los checks del menú "Estado". */
export type EstadoStock = 'OK' | 'Bajo' | 'Sin stock' | 'Desactivado'
export const ESTADOS_STOCK: readonly EstadoStock[] = ['OK', 'Bajo', 'Sin stock', 'Desactivado']

/** Calco de StockController.estadoComponente: desactivado manda; stock 0 es "Sin stock" aunque el mínimo sea 0; stock ≤
 *  mínimo (negativo incluido) es "Bajo"; el resto OK. Semáforo compartido de la web (spec 4a, S3): el combo de SKU del
 *  formulario (piezas.ts) deriva de aquí. */
export function estadoStock(c: Pick<Componente, 'stock' | 'stockMinimo' | 'activo'>): EstadoStock {
  if (!c.activo) return 'Desactivado'
  if (c.stock === 0) return 'Sin stock'
  if (c.stock <= c.stockMinimo) return 'Bajo'
  return 'OK'
}
