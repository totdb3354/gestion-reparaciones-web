import { leerSesion } from './storage'

/**
 * Hora (ms desde epoch) de la última señal de que hay ALGUIEN usando el ERP, en cualquier pestaña del navegador.
 * Es distinta de `fsgr.latido`, que dice que una pestaña sigue viva aunque no haya nadie delante: colgar el
 * cierre por inactividad del latido dejaría una pestaña olvidada abierta para siempre.
 */
export const CLAVE_ACTIVIDAD = 'fsgr.actividad'

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

export function escribirActividad(ahora: number = Date.now()) {
  try {
    localStorage.setItem(CLAVE_ACTIVIDAD, String(ahora))
  } catch {
    // Almacenamiento no disponible: sin marca, la vigilancia trata la sesión como recién activa.
  }
}

export function leerActividad(): number | null {
  try {
    const raw = localStorage.getItem(CLAVE_ACTIVIDAD)
    if (raw === null || raw.trim() === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

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
  for (const evento of EVENTOS) {
    document.addEventListener(evento, anotar, { passive: true })
  }
  const detener = () => {
    for (const evento of EVENTOS) document.removeEventListener(evento, anotar)
    if (detenerActual === detener) detenerActual = null
  }
  detenerActual = detener
  return detener
}
