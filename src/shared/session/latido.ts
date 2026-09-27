import { escribirLatido, leerSesion } from './storage'

/** Cada cuánto escribe la señal de actividad una pestaña abierta con la sesión. */
export const LATIDO_MS = 30_000
/**
 * Antigüedad a partir de la cual, al cargar el documento desde cero, la sesión se da por cerrada (ninguna pestaña del ERP
 * ha seguido abierta). Bastante mayor que `LATIDO_MS` porque el navegador ralentiza los temporizadores de las pestañas en
 * segundo plano (hasta uno por minuto).
 */
export const UMBRAL_MS = 150_000

let detenerActual: (() => void) | null = null

/**
 * Arranca la señal de actividad de esta pestaña: cada `LATIDO_MS`, al volver a ser visible, al recibir el foco y en
 * `pageshow` escribe la hora en `fsgr.latido`, solo si hay sesión guardada. No hace peticiones al servidor. Una sola vez
 * por pestaña: arrancarlo de nuevo sustituye al anterior. Devuelve cómo detenerlo.
 */
export function arrancarLatido(): () => void {
  detenerActual?.()
  const latir = () => {
    if (leerSesion() !== null) escribirLatido()
  }
  const alCambiarVisibilidad = () => {
    if (document.visibilityState === 'visible') latir()
  }
  const intervalo = window.setInterval(latir, LATIDO_MS)
  document.addEventListener('visibilitychange', alCambiarVisibilidad)
  window.addEventListener('focus', latir)
  window.addEventListener('pageshow', latir)
  const detener = () => {
    window.clearInterval(intervalo)
    document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    window.removeEventListener('focus', latir)
    window.removeEventListener('pageshow', latir)
    if (detenerActual === detener) detenerActual = null
  }
  detenerActual = detener
  return detener
}
