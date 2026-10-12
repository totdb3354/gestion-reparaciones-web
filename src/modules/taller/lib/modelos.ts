import type { Componente } from '@/shared/api/client'

// traducirModelo vive en shared (lo usa también el diálogo de Proveedores de almacén): se reexporta para taller.
export { traducirModelo } from '@/shared/lib/modelos'

/** Catálogo de modelos en orden de tienda Apple (calco de FormularioReparacionController.MODELOS_ORDENADOS). Está
 *  también en el servidor (CatalogoPiezas.MODELOS_ORDENADOS, 0.9.9): un modelo nuevo se añade en los DOS sitios. */
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
