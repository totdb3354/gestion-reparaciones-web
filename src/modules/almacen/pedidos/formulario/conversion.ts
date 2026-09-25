import { formatearNumero } from '@/shared/lib/importes'

/** Frankfurter (`from=EUR&to={DIV}`) da unidades de la divisa por 1 EUR: el precio en euros es precio / tasa (P3). El
 *  JavaFX multiplicaba. El servidor calcula el `precioEur` que se guarda; esto es solo la vista previa del formulario. */
export function aEuros(precio: number, tasa: number): number {
  return precio / tasa
}

/** Total EUR de una línea o del editor. null si falta el precio, la cantidad o la tasa (aún no ha llegado o falló): la
 *  celda pinta "—" en vez de calcular como si fuera EUR (P7). */
export function totalLinea(precio: number | null, tasa: number | null, cantidad: number | null): number | null {
  if (precio === null || tasa === null || cantidad === null || tasa <= 0) return null
  return aEuros(precio, tasa) * cantidad
}

/** Etiqueta del editor (FCE :99-111) corregida (P7): "(1 {DIV} = {1/tasa} €)" con cuatro decimales, dos espacios delante.
 *  EUR no lleva etiqueta. */
export function etiquetaTasa(divisa: string, tasa: number): string {
  if (divisa.toUpperCase() === 'EUR') return ''
  return `  (1 ${divisa} = ${formatearNumero(1 / tasa, 4)} €)`
}
