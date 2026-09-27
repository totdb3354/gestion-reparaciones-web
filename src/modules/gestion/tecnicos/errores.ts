import { NoEncontradoError, ReglaNegocioError, SesionDeOtraPestanaError, StaleDataError } from '@/shared/api/errors'
import { MSG_TECNICO_NO_ENCONTRADO } from './textos'

export type CodigoConMensaje = 404 | 409 | 422

/** Texto de la línea inline tras un fallo (spec 6, G9): el message del servidor en los códigos que la acción espera (alta:
 *  409/422; candado y comprobación: 404; borrado: 404/409) y el texto fijo del JavaFX en el resto. El 404 no trae su
 *  message hasta aquí (clasificar lo cambia por "Recurso no encontrado."): se usa el texto del servidor para esta ruta.
 *  null = ninguna línea: la petición no salió porque la sesión guardada ya es de otra pestaña (esta se recarga o va al login). */
export function mensajeInline(e: unknown, fijo: string, conMensaje: readonly CodigoConMensaje[]): string | null {
  if (e instanceof SesionDeOtraPestanaError) return null
  if (e instanceof NoEncontradoError && conMensaje.includes(404)) return MSG_TECNICO_NO_ENCONTRADO
  if (e instanceof StaleDataError && conMensaje.includes(409)) return e.message
  if (e instanceof ReglaNegocioError && e.status === 422 && conMensaje.includes(422)) return e.message
  return fijo
}
