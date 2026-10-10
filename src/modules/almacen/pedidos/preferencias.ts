/** «Agrupar por bloque» (0.9.9, spec §6.2): preferencia de este navegador. Si no se puede leer (modo privado, almacenamiento
 *  bloqueado), agrupada; si no se puede guardar, dura lo que la página. */
const CLAVE_AGRUPAR = 'pedidos.agruparPorBloque'

export function leerAgrupar(): boolean {
  try {
    return localStorage.getItem(CLAVE_AGRUPAR) !== 'no'
  } catch {
    return true
  }
}

export function guardarAgrupar(agrupar: boolean): void {
  try {
    localStorage.setItem(CLAVE_AGRUPAR, agrupar ? 'si' : 'no')
  } catch {
    // sin almacenamiento: la elección dura lo que la página
  }
}
