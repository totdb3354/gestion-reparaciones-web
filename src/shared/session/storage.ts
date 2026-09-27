export type Sesion = {
  idUsu: number
  nombreUsuario: string
  rol: string
  idTec: number | null
  token: string
}

/**
 * La sesión vive en `localStorage`: una sola para todas las pestañas del navegador (abrir otra pestaña o un enlace en
 * pestaña nueva entra sin pedir usuario). Que se cierre al cerrar el navegador lo decide la señal de actividad
 * (`CLAVE_LATIDO`, ver `latido.ts` y `arranque.ts`), no el navegador. Si el almacenamiento falla o está bloqueado, se
 * comporta como "sin sesión".
 */
export const CLAVE_SESION = 'fsgr.sesion'
/** Hora (ms desde epoch, `String(Date.now())`) de la última señal de actividad de alguna pestaña con la sesión abierta. */
export const CLAVE_LATIDO = 'fsgr.latido'

export function leerSesion(): Sesion | null {
  try {
    const raw = localStorage.getItem(CLAVE_SESION)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<Sesion>
    if (typeof s.token !== 'string' || typeof s.nombreUsuario !== 'string') return null
    if (typeof s.idUsu !== 'number' || typeof s.rol !== 'string') return null
    return s as Sesion
  } catch {
    return null
  }
}
/** Guarda la sesión y, con ella, la señal de actividad: una pestaña que se abra justo después la encuentra al día. */
export function guardarSesion(s: Sesion) {
  try {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(s))
  } catch {
    return
  }
  escribirLatido()
}
/** Borra la sesión y la señal de actividad; las demás pestañas lo reciben por el evento `storage`. */
export function borrarSesion() {
  try {
    localStorage.removeItem(CLAVE_SESION)
    localStorage.removeItem(CLAVE_LATIDO)
  } catch {
    // Almacenamiento no disponible: no hay nada que borrar.
  }
}
export function escribirLatido(ahora: number = Date.now()) {
  try {
    localStorage.setItem(CLAVE_LATIDO, String(ahora))
  } catch {
    // Almacenamiento no disponible: sin señal, el próximo arranque se comporta como "sin sesión".
  }
}
/** Hora de la última señal de actividad, o null si falta, no es un número o el almacenamiento falla. */
export function leerLatido(): number | null {
  try {
    const raw = localStorage.getItem(CLAVE_LATIDO)
    if (raw === null || raw.trim() === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}
export const esAdmin = (s: Sesion | null) => s?.rol === 'ADMIN'
export const esSuperTecnico = (s: Sesion | null) => s?.rol === 'SUPERTECNICO'
export const esAdminOSuperTecnico = (s: Sesion | null) => esAdmin(s) || esSuperTecnico(s)
