import { formatearNumero } from '@/shared/lib/importes'

/** Redondeo HALF_UP a `decimales` (calco de `BigDecimal.setScale(decimales, RoundingMode.HALF_UP)` del servidor): el
 *  empate (…5) siempre sube, a diferencia del banker's rounding que hace `toFixed` con algunos binarios. `Number.EPSILON`
 *  (≈2,22e-16) no basta para compensar el error de representación binaria de un empate como 1,74 / 0,8 = 2,175 (el double
 *  más cercano cae un poco por debajo, así que `Math.round` sin más lo trunca a 2,17 en vez de subir a 2,18): en su lugar
 *  se pasa por `toPrecision` para descartar ese ruido de los últimos bits antes de redondear el entero. Los precios de
 *  este formulario nunca son negativos (validarLineasCompra los rechaza antes), así que no hace falta cubrir el redondeo
 *  HALF_UP "lejos de cero" para negativos. */
function redondearHaciaArriba(n: number, decimales: number): number {
  const factor = 10 ** decimales
  return Math.round(Number((n * factor).toPrecision(15))) / factor
}

/** Frankfurter (`from=EUR&to={DIV}`) da unidades de la divisa por 1 EUR: el precio en euros es precio / tasa (P3). El
 *  JavaFX multiplicaba. C40: el servidor calcula `precioEur` redondeando el UNITARIO a 2 decimales (HALF_UP) antes de
 *  multiplicar por la cantidad; esta vista previa hace lo mismo para que el editor y la fila de la tabla coincidan
 *  (#90, 3 × 12,70 $ a 1,1367 → unitario 11,17 €, total 33,51 €, no 33,52 € de multiplicar sin redondear).
 *  En EUR la tasa es 1 y `ConversionEur.aEuros` del servidor devuelve el precio TAL CUAL, sin redondear (ni siquiera
 *  consulta la tasa): aquí igual, para que un precio con más de 2 decimales (p. ej. 12,345 × 3 = 37,035) llegue sin
 *  redondear a `totalLinea` y sea el formateador (P7), no este redondeo, quien lo presente en pantalla. */
export function aEuros(precio: number, tasa: number): number {
  return tasa === 1 ? precio : redondearHaciaArriba(precio / tasa, 2)
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
