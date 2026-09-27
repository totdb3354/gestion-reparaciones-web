import { arrancarLatido, LATIDO_MS, UMBRAL_MS } from './latido'
import { adoptarSesionGuardada, borrarSesion, CLAVE_SESION, escribirLatido, leerLatido, leerSesion } from './storage'

/**
 * Cerrojo compartido (Web Locks) que cada pestaña de la aplicación sostiene mientras vive su documento, haya sesión o no.
 * Si otro documento lo tiene al arrancar, hay otra pestaña de la aplicación abierta en este navegador.
 */
export const CERROJO_PESTANA = 'fsgr.pestana'

/** Una señal de actividad vale si es un número finito, no es posterior a `ahora + LATIDO_MS` y no tiene más de `UMBRAL_MS`. */
function latidoValido(latido: number | null, ahora: number): boolean {
  if (latido === null || !Number.isFinite(latido)) return false
  return latido <= ahora + LATIDO_MS && ahora - latido <= UMBRAL_MS
}

/** El gestor de cerrojos del navegador, si lo ofrece. */
function gestorDeCerrojos(): LockManager | undefined {
  try {
    return (navigator as Navigator & { locks?: LockManager }).locks ?? undefined
  } catch {
    return undefined
  }
}

/** ¿Otro documento sostiene el cerrojo de pestaña? Sin Web Locks, o si la consulta falla, no se sabe: false. */
async function hayOtraPestanaAbierta(): Promise<boolean> {
  const cerrojos = gestorDeCerrojos()
  if (!cerrojos) return false
  try {
    const estado = await cerrojos.query()
    return (estado.held ?? []).some((c) => c.name === CERROJO_PESTANA)
  } catch {
    return false
  }
}

/** Esta pestaña sostiene el cerrojo compartido mientras viva su documento (la promesa del callback no se resuelve nunca). */
function sostenerCerrojoDePestana(): void {
  const cerrojos = gestorDeCerrojos()
  if (!cerrojos) return
  try {
    cerrojos.request(CERROJO_PESTANA, { mode: 'shared' }, () => new Promise<void>(() => {})).catch(() => {})
  } catch {
    // Sin cerrojo, las demás pestañas decidirán solo por la señal de actividad.
  }
}

/**
 * Se llama una sola vez en `main.tsx`, al cargar el documento desde cero, y se espera antes de crear la raíz de React y de
 * cualquier lectura de la sesión. Nunca durante la vida de la pestaña: un PC suspendido con la pestaña abierta conserva la
 * sesión.
 * - Una sesión de la versión anterior (`sessionStorage`) se borra, no se migra.
 * - Una sesión guardada se conserva si otra pestaña de la aplicación sigue abierta (cerrojo `fsgr.pestana`, consultado
 *   antes de pedir el propio) o si la señal de actividad es válida (`latidoValido`); si no, se cierra: se cerró el
 *   navegador, o pasaron más de dos minutos y medio desde que se cerró la última pestaña. Sin Web Locks decide la señal.
 * - Después esta pestaña pide su cerrojo, escribe la señal si queda sesión, adopta la sesión que quede y arranca el latido. El latido arranca siempre
 *   (solo escribe mientras haya sesión), para que un inicio de sesión posterior en esta pestaña también lo mantenga.
 * Devuelve cómo detener el latido (pruebas).
 */
export async function comprobarSesionAlArrancar(ahora: number = Date.now()): Promise<() => void> {
  try {
    sessionStorage.removeItem(CLAVE_SESION)
  } catch {
    // Sin sessionStorage no hay sesión anterior que borrar.
  }
  if (leerSesion() !== null) {
    const otraPestana = await hayOtraPestanaAbierta()
    if (!otraPestana && !latidoValido(leerLatido(), ahora)) borrarSesion()
  }
  sostenerCerrojoDePestana()
  if (leerSesion() !== null) escribirLatido(ahora)
  adoptarSesionGuardada()
  return arrancarLatido()
}
