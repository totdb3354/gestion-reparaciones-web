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
