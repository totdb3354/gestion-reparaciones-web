import createClient, { type ClientOptions, type Middleware } from 'openapi-fetch'
import type { components, paths } from './schema'
import { leerSesion } from '@/app/session/storage'
import { dispararSesionExpirada } from '@/app/session/expiracion'
import { ConexionError, MSG_SIN_CONEXION, SesionExpiradaError, clasificar, extraerMensaje } from './errors'
import { reportarExito, reportarFallo } from './conexion'

/** springdoc no marca los campos de los records como `required`, así que openapi-typescript los genera
 *  opcionales (`idCli?: number`, ...). El servidor siempre manda todos los campos en las respuestas
 *  reales, así que forzamos `Required<>` aquí para no repetir `?.` en toda la app. Excepción: `idTec`
 *  puede ser `null` en tiempo de ejecución (técnico sin asignar) aunque el tipo diga `number`. */
export type Cliente = Required<components['schemas']['Cliente']>
/** springdoc no marca `idTec` como `nullable` en el schema, pero el admin no tiene técnico asignado
 *  y el servidor manda `null` en tiempo de ejecución para ese caso. */
export type LoginResponse = Omit<Required<components['schemas']['LoginResponse']>, 'idTec'> & { idTec: number | null }

/** Las rutas del contrato ya llevan /api/...; baseUrl es la origin: vacía en producción (misma origin),
 *  absoluta en tests porque el fetch de jsdom no admite URLs relativas. */
const baseUrl = import.meta.env.MODE === 'test' ? 'http://localhost' : ''
export const TIMEOUT_MS = 15_000

const auth: Middleware = {
  onRequest({ request }) {
    const s = leerSesion()
    if (s) request.headers.set('Authorization', `Bearer ${s.token}`)
    return request
  },
  async onResponse({ response }) {
    // Por debajo de 500 el servidor ha respondido: aunque sea un error (4xx), demuestra que hay conexión.
    if (response.status < 500) reportarExito()
    if (response.ok) return response
    if (response.status >= 500) reportarFallo()
    const texto = await response.clone().text()
    let body: unknown = texto
    try {
      body = JSON.parse(texto)
    } catch {
      /* texto plano */
    }
    const err = clasificar(response.status, extraerMensaje(body))
    if (err instanceof SesionExpiradaError) dispararSesionExpirada()
    throw err
  },
}

/** openapi-fetch invoca este fetch en tiempo de ejecución como `fetch(request, requestInitExt)`, aunque
 *  su tipo (`ClientOptions['fetch']`) solo declara un parámetro; tipamos `init` como opcional aquí y
 *  hacemos un cast en el punto de uso para poder recibirlo igualmente. */
const fetchConTimeout = async (request: Request, init?: RequestInit): Promise<Response> => {
  try {
    return await fetch(request, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (e) {
    // DOMException (Abort/TimeoutError) no hereda de Error según el spec, así que instanceof Error no
    // basta: hay que comprobar también instanceof DOMException para leer su `.name`.
    const nombre = e instanceof Error || e instanceof DOMException ? e.name : ''
    // Cancelación del llamador (p. ej. TanStack Query al desmontar): no es una caída del servidor.
    if (nombre === 'AbortError') throw e
    // Solo la red (TypeError de fetch) y el timeout se disfrazan de "sin conexión".
    if (nombre !== 'TimeoutError' && !(e instanceof TypeError)) throw e
    reportarFallo()
    throw new ConexionError(0, MSG_SIN_CONEXION + (nombre === 'TimeoutError' ? ' (tiempo de espera agotado)' : ''))
  }
}

export const api = createClient<paths>({
  baseUrl,
  fetch: fetchConTimeout as ClientOptions['fetch'],
})
api.use(auth)
