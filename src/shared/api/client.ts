import createClient, { type Middleware } from 'openapi-fetch'
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
export type LoginResponse = Required<components['schemas']['LoginResponse']>

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
    if (response.ok) {
      reportarExito()
      return response
    }
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

export const api = createClient<paths>({
  baseUrl,
  fetch: async (request) => {
    try {
      return await fetch(request, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (e) {
      reportarFallo()
      throw new ConexionError(0, MSG_SIN_CONEXION + (e instanceof Error && e.name === 'TimeoutError' ? ' (tiempo de espera agotado)' : ''))
    }
  },
})
api.use(auth)
