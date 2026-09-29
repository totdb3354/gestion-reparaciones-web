/** Fichero que la compilación deja junto al bundle con la versión publicada. */
export const RUTA_VERSION = '/version.json'
/** Cada cuánto se comprueba. Cinco minutos: un despliegue no es urgente y no conviene gastar peticiones. */
export const INTERVALO_VERSION_MS = 5 * 60 * 1000

/**
 * Versión que hay publicada ahora mismo, o null si no se puede saber. No es un error que falte: en desarrollo el
 * fichero no existe, y una pestaña sin red simplemente no se enterará todavía. Se pide sin caché porque el
 * navegador guardaría la respuesta y el aviso no llegaría nunca.
 */
export async function leerVersionPublicada(): Promise<string | null> {
  try {
    const respuesta = await fetch(RUTA_VERSION, { cache: 'no-store' })
    if (!respuesta.ok) return null
    const cuerpo: unknown = await respuesta.json()
    if (typeof cuerpo !== 'object' || cuerpo === null) return null
    const version = (cuerpo as { version?: unknown }).version
    return typeof version === 'string' && version !== '' ? version : null
  } catch {
    return null
  }
}
