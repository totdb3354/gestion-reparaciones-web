/** Nombre de cada tipo de pieza por el prefijo de su referencia (spec 2026-10-12 §5.1; mismo criterio que
 *  categoriaPieza de taller). */
export const NOMBRES_TIPO_PIEZA = {
  bat: 'Batería', cha: 'Chasis', tapa: 'Tapa trasera', g: 'Glass', mc: 'Marco', lcd: 'Pantalla', cam: 'Cámara',
} as const

/** El nombre del tipo; un prefijo desconocido se enseña tal cual. */
export function nombreTipoPieza(prefijo: string): string {
  return (NOMBRES_TIPO_PIEZA as Record<string, string>)[prefijo] ?? prefijo
}
