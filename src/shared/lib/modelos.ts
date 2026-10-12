/** Nombre de un modelo para pantalla (traducirModelo del JavaFX): compartido por taller y almacén. */
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
