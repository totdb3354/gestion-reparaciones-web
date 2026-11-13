/** IMEI sintético de prueba que SÍ pasa la cifra de control de Luhn: 14 cifras (`3500` + `n` rellenado) y el dígito de control. No es de
 *  ningún móvil real. Calcula el dígito por su cuenta (no usa el código de producción) para que las pruebas lo comprueben de verdad. */
export function imeiValido(n: number): string {
  const base = `3500${String(n).padStart(10, '0')}`
  let suma = 0
  for (let i = 0; i < base.length; i++) {
    // De derecha a izquierda, con el dígito de control aún por añadir: el último de la base está en posición par (se duplica).
    let d = Number(base[base.length - 1 - i])
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9 }
    suma += d
  }
  return base + String((10 - (suma % 10)) % 10)
}

/** Como `imeiValido`, pero cambiando el último dígito para que la cifra de control NO cuadre. */
export function imeiConLuhnMalo(n: number): string {
  const bueno = imeiValido(n)
  return bueno.slice(0, 14) + String((Number(bueno[14]) + 1) % 10)
}
