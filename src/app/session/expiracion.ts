import { leerSesion } from './storage'

/** Un 401 con sesión activa expulsa al usuario una sola vez (varias peticiones pueden fallar a la vez). */
let handler: (() => void) | null = null
let disparado = false

export function onSesionExpirada(h: () => void) {
  handler = h
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
