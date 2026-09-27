import { arrancarLatido, UMBRAL_MS } from './latido'
import { borrarSesion, CLAVE_SESION, escribirLatido, leerLatido, leerSesion } from './storage'

/**
 * El navegador descartó el documento para ahorrar memoria y lo está recargando (`document.wasDiscarded`, Chrome y Edge):
 * equivale a una pestaña que seguía abierta. Aparte y de una línea para poder retirarlo si en el navegador real no se
 * comporta así.
 */
export function esRecargaDeDescarte(): boolean {
  return document.wasDiscarded === true
}

/**
 * Se llama una sola vez en `main.tsx`, al cargar el documento desde cero, antes de crear la raíz de React y de cualquier
 * lectura de la sesión. Nunca durante la vida de la pestaña: un PC suspendido con la pestaña abierta conserva la sesión.
 * - Una sesión de la versión anterior (`sessionStorage`) se borra, no se migra.
 * - Una sesión guardada cuya señal de actividad falta, no es un número o tiene más de `UMBRAL_MS` se cierra: ninguna
 *   pestaña del ERP ha seguido abierta (se cerró el navegador). Salvo si es la recarga de un documento descartado.
 * - Si queda sesión, se escribe la señal. El latido arranca siempre (solo escribe mientras haya sesión), para que un
 *   inicio de sesión posterior en esta pestaña también lo mantenga. Devuelve cómo detenerlo (pruebas).
 */
export function comprobarSesionAlArrancar(ahora: number = Date.now()): () => void {
  try {
    sessionStorage.removeItem(CLAVE_SESION)
  } catch {
    // Sin sessionStorage no hay sesión anterior que borrar.
  }
  if (leerSesion() !== null && !esRecargaDeDescarte()) {
    const latido = leerLatido()
    if (latido === null || ahora - latido > UMBRAL_MS) borrarSesion()
  }
  if (leerSesion() !== null) escribirLatido(ahora)
  return arrancarLatido()
}
