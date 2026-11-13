/** Cuántas cifras tiene un IMEI. */
export const CIFRAS_IMEI = 15
/** Tras la 15.ª cifra se espera este rato sin más entrada antes de guardar: así toda la ráfaga del lector (y su Enter) cae en la celda
 *  que la recibió, y el salto a la siguiente fila ocurre después. */
export const QUIETO_MS = 120
/** Con el campo en error, una entrada nueva tras al menos este rato sin teclear sustituye a lo que había (otra lectura del lector). */
export const SUSTITUIR_MS = 300

/** Dígito de control de Luhn de un IMEI de 15 cifras. Con otra longitud o con algo que no sean cifras, no cuadra. */
export function luhnCuadra(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false
  let suma = 0
  for (let i = 0; i < imei.length; i++) {
    let d = imei.charCodeAt(imei.length - 1 - i) - 48
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9 }
    suma += d
  }
  return suma % 10 === 0
}
