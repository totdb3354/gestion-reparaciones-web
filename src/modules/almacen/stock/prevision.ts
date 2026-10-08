import type { PesosPrevision } from '@/shared/api/client'
import { parseEnteroNoNegativo } from './dialogos'

/** Formato de la previsión de pedidos (spec 0.9.5 §3.4). Sin previsión (pieza desactivada, o TECNICO), "—". */
export function formatearConsumo(v: number | null | undefined): string {
  return typeof v === 'number' ? v.toFixed(2).replace('.', ',') : '—'
}

export function formatearPedir(v: number | null | undefined): string {
  return typeof v === 'number' ? String(v) : '—'
}

/** Marca del pedido automático en el CSV (spec 0.9.6 §4.3). Sin dato (TECNICO), "—". */
export function formatearAuto(v: boolean | null | undefined): string {
  return v === true ? 'Sí' : v === false ? 'No' : '—'
}

export const AYUDA_PESOS = 'Lo reciente pesa más. Los tres tienen que sumar 100.'
export const MSG_PESOS_NO_VALIDOS = 'Los tres pesos tienen que ser enteros entre 0 y 100 y sumar 100.'

type Textos = readonly [string, string, string]

function peso(texto: string): number | null {
  const n = parseEnteroNoNegativo(texto)
  return n !== null && n <= 100 ? n : null
}

/** Suma de los tres campos, o null si alguno no es un entero de 0 a 100. */
export function sumaPesos(textos: Textos): number | null {
  const ns = textos.map(peso)
  return ns.every((n) => n !== null) ? (ns as number[]).reduce((a, b) => a + b, 0) : null
}

/** Los tres pesos si son válidos (enteros de 0 a 100 que suman 100), o null. La misma regla que el servidor. */
export function leerPesos(textos: Textos): PesosPrevision | null {
  if (sumaPesos(textos) !== 100) return null
  const [peso1, peso2, peso3] = textos.map((t) => peso(t) as number)
  return { peso1, peso2, peso3 }
}
