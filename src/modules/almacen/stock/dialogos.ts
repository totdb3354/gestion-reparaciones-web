import type { Componente } from '@/shared/api/client'
import { nombreFila } from './grupos'

/** Subtítulo de editarStock y solicitarPieza (:611): tres espacios a cada lado del punto medio. Con `miembros` (fila de un
 *  grupo de stock compartido) el componente es el nombre del grupo. */
export function subtituloComponente(c: Pick<Componente, 'tipo' | 'stock'> & { miembros?: Componente[] }): string {
  return `Componente: ${nombreFila(c as Componente)}   ·   Stock actual: ${c.stock} ud(s).`
}

/** Calco de `Integer.parseInt(trim)` con el negativo forzado a error (:652-653): solo dígitos, ≥ 0. */
export function parseEnteroNoNegativo(texto: string): number | null {
  const t = texto.trim()
  if (!/^\d+$/.test(t)) return null
  return Number(t)
}
