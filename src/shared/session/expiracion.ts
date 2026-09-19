import { leerSesion } from './storage'

/** Un 401 con sesión activa expulsa al usuario una sola vez (varias peticiones pueden fallar a la vez). */
let handler: (() => void) | null = null
let disparado = false

/** Registra el handler (uno solo: el último gana) y devuelve cómo retirarlo. El unsubscribe solo quita `h` si sigue siendo
 *  el actual: el de un handler ya sustituido no deja a la app sin el nuevo. */
export function onSesionExpirada(h: () => void): () => void {
  handler = h
  return () => {
    if (handler === h) handler = null
  }
}
export function dispararSesionExpirada() {
  if (disparado || !leerSesion() || !handler) return
  disparado = true
  handler()
}
/** Llamar tras un login correcto. */
export function rearmarSesionExpirada() {
  disparado = false
}
