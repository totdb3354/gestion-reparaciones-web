/** Entorno de la construcción. Lo fija el argumento VITE_ENTORNO del Dockerfile, y solo el compose de preprod lo pasa:
 *  en producción no existe y todo queda como siempre. Se lee en cada llamada (no al cargar el módulo) para que los tests
 *  puedan cambiarlo con vi.stubEnv. */
export const ENTORNO_PREPRODUCCION = 'preproduccion'

export const PREFIJO_TITULO_PRE = '[PRE] '

export function esPreproduccion(): boolean {
  return import.meta.env.VITE_ENTORNO === ENTORNO_PREPRODUCCION
}

/** Título de la pestaña con el prefijo de preprod; en cualquier otro entorno, el mismo título. */
export function conEntorno(titulo: string): string {
  return esPreproduccion() && !titulo.startsWith(PREFIJO_TITULO_PRE) ? PREFIJO_TITULO_PRE + titulo : titulo
}
