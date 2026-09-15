import createClient, { type Middleware } from 'openapi-fetch'
import type { components, paths } from './schema'
import { leerSesion } from '@/shared/session/storage'
import { dispararSesionExpirada } from '@/shared/session/expiracion'
import { ConexionError, MSG_SIN_CONEXION, MSG_TIMEOUT, SesionExpiradaError, clasificar, extraerMensaje } from './errors'
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
 *  su tipo solo declara un parámetro: con `init` opcional la firma sigue encajando y recibimos el segundo. */
const fetchConTimeout = async (request: Request, init?: RequestInit): Promise<Response> => {
  // La señal combina el timeout con la del llamador (TanStack Query al desmontar, AbortController propio):
  // pasar solo la del timeout descartaría la cancelación y la petición seguiría viva. Ambas se construyen
  // fuera del try: son creación de señales, no la operación que puede fallar con AbortError/TimeoutError.
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const signal = AbortSignal.any([timeout, request.signal, init?.signal].filter((s): s is AbortSignal => !!s))
  try {
    return await fetch(request, { ...init, signal })
  } catch (e) {
    const nombre = e instanceof Error ? e.name : ''
    // Cancelación del llamador (p. ej. TanStack Query al desmontar): no es una caída del servidor.
    if (nombre === 'AbortError') throw e
    // Solo la red (TypeError de fetch) y el timeout se disfrazan de "sin conexión".
    if (nombre !== 'TimeoutError' && !(e instanceof TypeError)) throw e
    reportarFallo()
    // El detalle (causa técnica) lo muestra el diálogo cuando el corte ocurre durante una acción del usuario.
    const esTimeout = nombre === 'TimeoutError'
    const detalle = esTimeout ? MSG_TIMEOUT : e instanceof Error ? e.message : String(e)
    throw new ConexionError(0, MSG_SIN_CONEXION + (esTimeout ? ` (${MSG_TIMEOUT})` : ''), detalle)
  }
}

export const api = createClient<paths>({
  baseUrl,
  fetch: fetchConTimeout,
})
api.use(auth)
