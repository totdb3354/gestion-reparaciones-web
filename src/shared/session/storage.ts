export type Sesion = {
  idUsu: number
  nombreUsuario: string
  rol: string
  idTec: number | null
  token: string
}

const CLAVE = 'fsgr.sesion'

export function leerSesion(): Sesion | null {
  try {
    const raw = sessionStorage.getItem(CLAVE)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<Sesion>
    if (typeof s.token !== 'string' || typeof s.nombreUsuario !== 'string') return null
    if (typeof s.idUsu !== 'number' || typeof s.rol !== 'string') return null
    return s as Sesion
  } catch {
    return null
  }
}
export function guardarSesion(s: Sesion) {
  sessionStorage.setItem(CLAVE, JSON.stringify(s))
}
export function borrarSesion() {
  sessionStorage.removeItem(CLAVE)
}
export const esAdmin = (s: Sesion | null) => s?.rol === 'ADMIN'
export const esSuperTecnico = (s: Sesion | null) => s?.rol === 'SUPERTECNICO'
export const esAdminOSuperTecnico = (s: Sesion | null) => esAdmin(s) || esSuperTecnico(s)
