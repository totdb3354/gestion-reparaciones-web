/** Destino de "Cerrar" cuando la página no se abrió desde el menú (URL tecleada, recarga): el inicio por rol. */
export const RUTA_VOLVER_POR_DEFECTO = '/reparaciones'

/** Ruta a la que vuelve "Cerrar" en /gestion/tecnicos y /gestion/logs: el `volverA` que el menú de usuario deja en el
 *  state de la navegación. Solo rutas internas ('/…', no '//…'): el state viene del historial del navegador. */
export function rutaVolverA(state: unknown): string {
  if (state !== null && typeof state === 'object' && 'volverA' in state) {
    const v = (state as { volverA?: unknown }).volverA
    if (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//')) return v
  }
  return RUTA_VOLVER_POR_DEFECTO
}
