import { esErrorGestionadoGlobalmente, mensajeDeError, ReglaNegocioError, StaleDataError } from '@/shared/api/errors'

/** Texto de la línea de error de un formulario de pedido tras un guardado fallido (spec §6 y §8, P6). null = no se pinta
 *  nada: el aviso ya lo da el mecanismo global (banner y diálogo de conexión, o la vuelta al login). `staleData` sustituye
 *  el texto de cualquier 409 (editores: "El pedido fue modificado por otro usuario…", FCE :145-148). */
export function mensajeErrorGuardado(e: unknown, opciones?: { staleData?: string }): string | null {
  if (esErrorGestionadoGlobalmente(e)) return null
  if (e instanceof StaleDataError) return opciones?.staleData ?? e.message
  if (e instanceof ReglaNegocioError) return e.message
  return 'Error al guardar: ' + mensajeDeError(e)
}
