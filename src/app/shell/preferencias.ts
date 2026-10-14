/** Columna lateral plegada o abierta (0.9.10, spec «Columna lateral plegable» §2): preferencia de este navegador, no del
 *  usuario (en el taller se comparten PCs), y no es un filtro: `reiniciarStores` no la toca al cerrar sesión. Si no se
 *  puede leer (modo privado, almacenamiento bloqueado), abierta; si no se puede guardar, dura lo que la página. */
export const CLAVE_PLEGADA = 'columnaLateral.plegada'

export function leerPlegada(): boolean {
  try {
    return localStorage.getItem(CLAVE_PLEGADA) === 'si'
  } catch {
    return false
  }
}

export function guardarPlegada(plegada: boolean): void {
  try {
    localStorage.setItem(CLAVE_PLEGADA, plegada ? 'si' : 'no')
  } catch {
    // sin almacenamiento: la elección dura lo que la página
  }
}
