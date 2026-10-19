/** Familias del grado de NSYS para su color (0.9.18, spec «Columna compacta, SKU, Quién lo tiene y Revisado» §4.8). */
export type FamiliaGrado = 'A' | 'B' | 'C' | 'MS' | 'ID' | 'NA' | 'OTRO'

export function familiaGrado(grado: string | null | undefined): FamiliaGrado {
  if (!grado) return 'OTRO'
  if (grado === 'n/a') return 'NA'
  if (grado === 'ID') return 'ID'
  if (grado.startsWith('Ms')) return 'MS'
  const letra = grado.charAt(0)
  return letra === 'A' || letra === 'B' || letra === 'C' ? letra : 'OTRO'
}

/** Borde de color y fondo blanco: así el grado no se confunde con las ubicaciones, que son píldoras rellenas. Tokens del
 *  tema: A azul, B violeta, C naranja, Ms verde azulado, ID rosa y n/a ámbar con borde discontinuo. */
const CLASES_FAMILIA: Record<FamiliaGrado, string> = {
  A: 'border-tipo-reparacion-text text-tipo-reparacion-text',
  B: 'border-tipo-pulido-text text-tipo-pulido-text',
  C: 'border-aviso-conflicto-text text-aviso-conflicto-text',
  MS: 'border-tipo-glass-text text-tipo-glass-text',
  ID: 'border-fila-incidencia-brd text-fila-incidencia-brd',
  NA: 'border-dashed border-fila-solicitud-brd text-fila-solicitud-brd',
  OTRO: 'border-pill-borde text-azul-medio',
}

export function clasesGrado(grado: string | null | undefined): string {
  return `inline-block rounded-full border-[1.5px] bg-superficie px-2 text-[11.5px] leading-[18px] font-bold ${CLASES_FAMILIA[familiaGrado(grado)]}`
}
