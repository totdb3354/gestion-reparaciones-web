import { leerSesion } from './storage'

/** Por qué se cierra la sesión, cuando no es un 401 cualquiera: cambia el mensaje del login (spec 0.9.5 §5). */
export type MotivoExpiracion = 'inactividad'

/** Un 401 con sesión activa expulsa al usuario una sola vez (varias peticiones pueden fallar a la vez). */
let handler: ((motivo?: MotivoExpiracion) => void) | null = null
let disparado = false

/** Registra el handler (uno solo: el último gana) y devuelve cómo retirarlo. El unsubscribe solo quita `h` si sigue siendo
 *  el actual: el de un handler ya sustituido no deja a la app sin el nuevo. */
export function onSesionExpirada(h: (motivo?: MotivoExpiracion) => void): () => void {
  handler = h
  return () => {
    if (handler === h) handler = null
  }
}
export function dispararSesionExpirada(motivo?: MotivoExpiracion) {
  if (disparado || !leerSesion() || !handler) return
  disparado = true
  handler(motivo)
}
/** Llamar tras un login correcto. */
export function rearmarSesionExpirada() {
  disparado = false
}
