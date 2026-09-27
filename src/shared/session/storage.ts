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

/**
 * Token de la sesión con la que trabaja ESTA pestaña. Lo fija la pestaña al adoptar una sesión (al arrancar, al entrar) y
 * lo quita al cerrarla (cerrar sesión, sesión caducada, cierre desde otra pestaña). Si la sesión guardada deja de ser esta
 * (otra pestaña entró con otro usuario o cerró la sesión), las peticiones de esta pestaña no salen: ver `client.ts`.
 */
let tokenDePestana: string | null = null

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
/** Guarda la sesión, la adopta como la de esta pestaña y escribe la señal de actividad: una pestaña que se abra justo
 *  después la encuentra al día. */
export function guardarSesion(s: Sesion) {
  try {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(s))
  } catch {
    return
  }
  tokenDePestana = s.token
  escribirLatido()
}
/** Borra la sesión y la señal de actividad, y esta pestaña deja de tener sesión; las demás lo reciben por el evento
 *  `storage`. */
export function borrarSesion() {
  tokenDePestana = null
  try {
    localStorage.removeItem(CLAVE_SESION)
    localStorage.removeItem(CLAVE_LATIDO)
  } catch {
    // Almacenamiento no disponible: no hay nada que borrar.
  }
}
/** Esta pestaña adopta la sesión guardada, si la hay (al cargar el documento, tras la comprobación de arranque). */
export function adoptarSesionGuardada() {
  tokenDePestana = leerSesion()?.token ?? null
}
/**
 * Lo que hay guardado sigue siendo lo de esta pestaña: la misma sesión (mismo token) o, en las dos, ninguna. Falso si otra
 * pestaña entró con otra sesión o la cerró.
 */
export function esSesionDeEstaPestana(): boolean {
  return (leerSesion()?.token ?? null) === tokenDePestana
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
