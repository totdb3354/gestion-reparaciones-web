import { escribirActividad, leerSesion } from './storage'

/**
 * La marca (clave, lectura y escritura) vive en `storage.ts`, con el resto de los accesos al almacenamiento: la
 * escribe tambien `guardarSesion`, porque entrar es actividad. Aqui queda la politica: que cuenta como actividad
 * de una persona y cuanto se aguanta sin ella. Es distinta de `fsgr.latido`, que dice que una pestaña sigue viva
 * aunque no haya nadie delante: colgar el cierre por inactividad del latido dejaria una pestaña olvidada abierta
 * para siempre.
 */
export { CLAVE_ACTIVIDAD, escribirActividad, leerActividad } from './storage'

/** Tope de inactividad antes de cerrar la sesión: dos horas. */
export const INACTIVIDAD_MS = 2 * 60 * 60 * 1000
/** Cuánto antes del cierre se avisa, con botón para seguir. */
export const AVISO_MS = 60_000

/**
 * Lo que cuenta como actividad de una persona. Deliberadamente NO están el `focus` de la ventana ni
 * `visibilitychange`: en un equipo compartido, cambiar de aplicación y volver no es trabajar, y el refresco
 * automático de las tablas es independiente de todo esto.
 */
const EVENTOS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

let detenerActual: (() => void) | null = null



/**
 * Escucha el ratón y el teclado y anota la hora mientras haya sesión. La marca vive en `localStorage`, así que la
 * actividad de cualquier pestaña cuenta para todas, que es lo que corresponde a una sesión compartida. Una sola
 * vez por documento: arrancarla de nuevo sustituye a la anterior. Devuelve cómo detenerla.
 */
export function arrancarMarcaDeActividad(): () => void {
  detenerActual?.()
  const anotar = () => {
    if (leerSesion() !== null) escribirActividad()
  }
  // En captura: cuenta aunque un elemento pare la propagación (la rueda dentro de un desplegable, ver PopoverContent).
  for (const evento of EVENTOS) {
    document.addEventListener(evento, anotar, { passive: true, capture: true })
  }
  const detener = () => {
    for (const evento of EVENTOS) document.removeEventListener(evento, anotar, { capture: true })
    if (detenerActual === detener) detenerActual = null
  }
  detenerActual = detener
  return detener
}
