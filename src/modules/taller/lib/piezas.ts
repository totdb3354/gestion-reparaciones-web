/** Calco de Piezas: categoría legible a partir del prefijo del SKU (prefijos largos antes para no confundir cha/cam con g). */
const PREFIJOS = ['otro', 'cha', 'cam', 'bat', 'lcd', 'mc', 'g'] as const
const ETIQUETAS: Record<(typeof PREFIJOS)[number], string> = {
  bat: 'Batería', cha: 'Chasis', g: 'Glass', cam: 'Cámara', lcd: 'Pantalla', mc: 'Marco', otro: 'Otros',
}

export function categoriaPieza(sku: string | null | undefined): string {
  if (!sku) return ''
  const s = sku.toLowerCase()
  for (const p of PREFIJOS) if (s.startsWith(p)) return ETIQUETAS[p]
  return ''
}
