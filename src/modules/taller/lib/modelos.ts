import type { Componente } from '@/shared/api/client'

/** Catálogo de modelos en orden de tienda Apple (calco de FormularioReparacionController.MODELOS_ORDENADOS) y su
 *  traducción código → nombre (traducirModelo). Duplicado en TypeScript hasta que suba al servidor (sub-proyecto 3). */
export const MODELOS_ORDENADOS: readonly string[] = [
  '6s', '6splus', '7', '7plus', '8', '8plus', 'se2020',
  'x', 'xr', 'xs', 'xsmax',
  '11', '11pro', '11promax',
  '12', '12mini', '12pro', '12promax',
  '13', '13mini', '13pro', '13promax',
  '14', '14plus', '14pro', '14promax',
  '15', '15plus', '15pro', '15promax',
  '16', '16e', '16plus', '16pro', '16promax',
  '17', 'air', '17pro', '17promax',
]

const ESPECIALES: Record<string, string> = {
  se2020: 'iPhone SE 2020', x: 'iPhone X', xr: 'iPhone XR', xs: 'iPhone XS', xsmax: 'iPhone XS Max',
  '6s': 'iPhone 6S', '6splus': 'iPhone 6S Plus', air: 'iPhone Air',
}
const SUFIJOS: Record<string, string> = { plus: ' Plus', mini: ' Mini', pro: ' Pro', promax: ' Pro Max', e: 'e' }

export function traducirModelo(codigo: string | null | undefined): string {
  if (!codigo) return ''
  const especial = ESPECIALES[codigo]
  if (especial) return especial
  const num = codigo.replace(/[^0-9]/g, '')
  const variante = codigo.replace(/[0-9]/g, '')
  return `iPhone ${num}${SUFIJOS[variante] ?? ''}`
}

/** Código de modelo de un SKU (calco de extraerModelo): en minúsculas, sin el prefijo del tipo y, si lo que queda empieza por
 *  "i", sin esa "i"; de los códigos de MODELOS_ORDENADOS que sean prefijo del resto gana el MÁS LARGO
 *  ('bati13promaxneg' → '13promax', no '13'). null si ninguno. */
export function extraerModelo(sku: string, prefijo: string): string | null {
  let resto = sku.toLowerCase().slice(prefijo.length)
  if (resto.startsWith('i')) resto = resto.slice(1)
  let mejor: string | null = null
  for (const m of MODELOS_ORDENADOS) {
    if (resto.startsWith(m) && (mejor === null || m.length > mejor.length)) mejor = m
  }
  return mejor
}

/** Modelos de MODELOS_ORDENADOS (en ese orden) presentes en algún SKU ACTIVO de los grupos indicados. Quien llama decide qué
 *  grupos pasa: el formulario pasa los tipos que son fila (nunca 'otro'). */
export function modelosDisponibles(grupos: { prefijo: string; skus: Componente[] }[]): string[] {
  const presentes = new Set<string>()
  for (const { prefijo, skus } of grupos) {
    for (const c of skus) {
      if (!c.activo) continue
      const m = extraerModelo(c.tipo, prefijo)
      if (m !== null) presentes.add(m)
    }
  }
  return MODELOS_ORDENADOS.filter((m) => presentes.has(m))
}
