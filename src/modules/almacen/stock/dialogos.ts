import type { Componente } from '@/shared/api/client'

/** Subtítulo de editarStock y solicitarPieza (:611): tres espacios a cada lado del punto medio. */
export function subtituloComponente(c: Pick<Componente, 'tipo' | 'stock'>): string {
  return `Componente: ${c.tipo}   ·   Stock actual: ${c.stock} ud(s).`
}

/** Calco de `Integer.parseInt(trim)` con el negativo forzado a error (:652-653): solo dígitos, ≥ 0. */
export function parseEnteroNoNegativo(texto: string): number | null {
  const t = texto.trim()
  if (!/^\d+$/.test(t)) return null
  return Number(t)
}
