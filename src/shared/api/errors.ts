/** Port de ApiClient.clasificar del cliente JavaFX: un tipo de error por familia de respuesta. */
export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = new.target.name
  }
}
export class SesionExpiradaError extends ApiError {}
export class PermisoError extends ApiError {}
export class NoEncontradoError extends ApiError {}
/** 409: bloqueo optimista (updatedAt) o conflicto de negocio; el mensaje del servidor es el bueno. */
export class StaleDataError extends ApiError {}
/** 422: regla de negocio del servidor; su mensaje se muestra tal cual. */
export class ReglaNegocioError extends ApiError {}
/** 5xx, fallo de red o timeout: activa el banner de sin conexión. */
export class ConexionError extends ApiError {}

export const MSG_SESION_EXPIRADA = 'Sesión expirada. Vuelve a iniciar sesión.'
export const MSG_SIN_PERMISOS = 'No tienes permisos para realizar esta acción.'
export const MSG_NO_ENCONTRADO = 'Recurso no encontrado.'
export const MSG_SIN_CONEXION = 'Sin conexión con el servidor.'

export function clasificar(status: number, msg: string | null): ApiError {
  switch (status) {
    case 401:
      return new SesionExpiradaError(401, MSG_SESION_EXPIRADA)
    case 403:
      return new PermisoError(403, MSG_SIN_PERMISOS)
    case 404:
      return new NoEncontradoError(404, MSG_NO_ENCONTRADO)
    case 409:
      return new StaleDataError(409, msg ?? 'El registro fue modificado por otro usuario.')
    case 422:
      return new ReglaNegocioError(422, msg ?? 'El servidor ha rechazado la operación.')
    default:
      if (status >= 500) return new ConexionError(status, MSG_SIN_CONEXION)
      return new ApiError(status, msg ?? `Error del servidor (${status}).`)
  }
}

export function extraerMensaje(body: unknown): string | null {
  if (typeof body === 'string') return body.trim() === '' ? null : body
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message?: unknown }).message
    return typeof m === 'string' && m.trim() !== '' ? m : null
  }
  return null
}

/** Mensaje que se muestra al usuario. `staleData` permite sustituir el texto del 409 (bloqueo optimista)
 *  por el aviso propio de la vista ("... fue modificado por otro usuario"), como hace el JavaFX. */
export function mensajeDeError(e: unknown, opciones?: { staleData?: string }): string {
  if (opciones?.staleData !== undefined && e instanceof StaleDataError) return opciones.staleData
  return e instanceof Error ? e.message : String(e)
}

/** `true` si el error ya lo gestiona un mecanismo global (401 → redirección a login, 5xx/red → banner de
 *  conexión) y por tanto ningún `onError` propio de una mutación debe volver a mostrarlo (evita el aviso
 *  doble: banner + diálogo). */
export function esErrorGestionadoGlobalmente(e: unknown): boolean {
  return e instanceof SesionExpiradaError || e instanceof ConexionError
}
