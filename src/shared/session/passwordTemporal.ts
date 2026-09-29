import { leerSesion } from './storage'

/**
 * Aviso de que el servidor ha rechazado una peticion porque la contraseña sigue siendo la temporal que entrego el
 * administrador. Mismo patron que `expiracion.ts`, y por el mismo motivo: varias peticiones de la misma vista fallan a
 * la vez y solo hay que reaccionar una vez.
 *
 * A diferencia de un 401, esto NO expulsa: la sesion es valida y solo falta poner una contraseña propia, asi que el
 * handler enciende la marca en la sesion y el desvio de `RequireSesion` lleva a la pantalla de cambio.
 */
let handler: (() => void) | null = null
let disparado = false

/** Registra el handler (uno solo: el ultimo gana) y devuelve como retirarlo. El unsubscribe solo quita `h` si sigue
 *  siendo el actual, para que el de un handler ya sustituido no deje a la aplicacion sin el nuevo. */
export function onPasswordTemporalExigida(h: () => void): () => void {
  handler = h
  return () => {
    if (handler === h) handler = null
  }
}

export function dispararPasswordTemporalExigida() {
  if (disparado || !leerSesion() || !handler) return
  disparado = true
  handler()
}

/** Llamar tras un login correcto y tras cambiar la contraseña: el siguiente 403 de este tipo vuelve a contar. */
export function rearmarPasswordTemporalExigida() {
  disparado = false
}
