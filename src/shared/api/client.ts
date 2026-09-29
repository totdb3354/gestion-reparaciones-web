import createClient, { type Middleware } from 'openapi-fetch'
import type { components, paths } from './schema'
import { esSesionDeEstaPestana, tokenDeEstaPestana } from '@/shared/session/storage'
import { dispararSesionExpirada } from '@/shared/session/expiracion'
import { dispararPasswordTemporalExigida } from '@/shared/session/passwordTemporal'
import { ConexionError, LimiteLoginError, PasswordTemporalError, MSG_LIMITE_LOGIN, MSG_SIN_CONEXION, MSG_TIMEOUT, SesionDeOtraPestanaError, SesionExpiradaError, clasificar, extraerMensaje } from './errors'
import { reportarExito, reportarFallo } from './conexion'

/** Tipos del contrato tal cual los genera openapi-typescript: el servidor marca todas las propiedades como
 *  required y anota `nullable` en las que pueden venir a null (OpenApiConfig.todasLasPropiedadesRequeridas), así
 *  que aquí ya no hace falta `Required<>` ni corregir `idTec` a mano. */
export type Cliente = components['schemas']['Cliente']
export type LoginResponse = components['schemas']['LoginResponse']
export type ReparacionResumen = components['schemas']['ReparacionResumen']
export type Tecnico = components['schemas']['Tecnico']
export type ContadoresPendientes = components['schemas']['ContadoresPendientes']

/** Almacén (sub-proyecto 4a): proveedores de componentes (`tipo` COMPONENTES/TELEFONOS viene del servidor de main). */
export type Proveedor = components['schemas']['Proveedor']

/** Pedidos (sub-proyecto 4b): pedidos de componentes y "otros pedidos". `cantidadRecibida` y `fechaLlegada` vienen a null
 *  hasta la recepción (nullables del contrato desde la Task 6 del servidor). */
export type CompraComponente = components['schemas']['CompraComponente']
export type CompraOtro = components['schemas']['CompraOtro']

/** Gestión (sub-proyecto 6): usuarios TECNICO/SUPERTECNICO de GET /api/usuarios/tecnicos (sin ADMIN; `activo` es el de
 *  Tecnico) y filas del log de actividad (`detalle` y `motivo` nullables desde la Task 5 del servidor). */
export type Usuario = components['schemas']['Usuario']
export type LogActividad = components['schemas']['LogActividad']

/** Formulario de reparación y campana (sub-proyecto 2). `ComponentesAgrupados` es la respuesta de
 *  GET /api/componentes/agrupados: prefijo del tipo → sus componentes, en el orden de claves del servidor. */
export type Componente = components['schemas']['Componente']
export type ComponentesAgrupados = Record<string, Componente[]>
export type FilaReparacion = components['schemas']['FilaReparacion']
/** Lo que devuelve GET …/asignaciones/{idAsignacion}/solicitudes: mismo esquema que una fila. */
export type SolicitudAsignacion = FilaReparacion
export type Reparacion = components['schemas']['Reparacion']
export type DetalleEdicion = components['schemas']['ReparacionDAODetalleEdicion']
export type AsignacionActiva = components['schemas']['ReparacionDAOAsignacionActiva']
export type SolicitudResumen = components['schemas']['SolicitudResumen']
export type SolicitudStock = components['schemas']['SolicitudStock']
export type GuardarFilaRequest = components['schemas']['ReparacionGuardarFilaRequest']
export type InsertarCompletaRequest = components['schemas']['ReparacionInsertarCompletaRequest']
export type AgotarRequest = components['schemas']['ReparacionAgotarRequest']
export type EditarReparacionRequest = components['schemas']['ReparacionEditarRequest']

/** Carga diaria por técnico (sub-proyecto 3a): los dos alcances en una respuesta. */
export type CargaTecnicosRespuesta = components['schemas']['CargaTecnicosRespuesta']
export type FilaCarga = components['schemas']['CargaTecnicosRespuestaFilaCarga']
export type DesgloseCarga = components['schemas']['CargaTecnicosRespuestaDesgloseDto']

/** Guardado por lotes del modal "Asignar trabajos" (sub-proyecto 3b). */
export type PeticionLote = components['schemas']['LoteAsignacionesPeticion']
export type TelefonoDelLote = components['schemas']['LoteAsignacionesTelefonoDelLote']
export type AsignacionDelLote = components['schemas']['LoteAsignacionesAsignacionDelLote']
export type RespuestaLote = components['schemas']['LoteAsignacionesRespuesta']
export type ConflictoLote = components['schemas']['LoteAsignacionesConflicto']
/** Predicción de la glass automática (sub-proyecto 3b). */
export type PeticionPrediccion = components['schemas']['GlassPrediccionRequest']
export type VerdePrediccion = components['schemas']['GlassVerdeRequest']
export type RespuestaPrediccion = components['schemas']['PrediccionGlassRespuesta']

/** Las rutas del contrato ya llevan /api/...; baseUrl es la origin: vacía en producción (misma origin),
 *  absoluta en tests porque el fetch de jsdom no admite URLs relativas. */
const baseUrl = import.meta.env.MODE === 'test' ? 'http://localhost' : ''
export const TIMEOUT_MS = 15_000

/** El límite de intentos del inicio de sesión: el servidor web responde 503 (429 si se cambia su configuración). Solo en
 *  `POST /api/auth/login`; en el resto de rutas un 503 sigue siendo "sin conexión". */
function esLimiteLogin(request: Request, status: number): boolean {
  return (status === 503 || status === 429) && request.method === 'POST' && new URL(request.url).pathname === '/api/auth/login'
}

const auth: Middleware = {
  onRequest({ request }) {
    // Cada petición sale con la sesión de SU pestaña: si la guardada ya es otra (u otra pestaña la cerró), no sale.
    if (!esSesionDeEstaPestana()) throw new SesionDeOtraPestanaError()
    // Pasada la comparación, el token guardado y el de la pestaña son el mismo: se usa el de la pestaña, sin volver a leer.
    const token = tokenDeEstaPestana()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
  async onResponse({ request, response }) {
    // Por debajo de 500 el servidor ha respondido: aunque sea un error (4xx), demuestra que hay conexión.
    if (response.status < 500) reportarExito()
    if (response.ok) return response
    // Antes de clasificar: el 503 del límite no debe pasar por ConexionError (ni banner ni reintento del login).
    if (esLimiteLogin(request, response.status)) throw new LimiteLoginError(response.status, MSG_LIMITE_LOGIN)
    const texto = await response.clone().text()
    let body: unknown = texto
    try {
      body = JSON.parse(texto)
    } catch {
      /* texto plano */
    }
    // Un 503 solo es de negocio con el JSON {message} de nuestro backend (sub-proyecto 4b); el texto plano o el HTML
    // de nginx sigue siendo "sin conexión".
    const msg = response.status === 503 && typeof body === 'string' ? null : extraerMensaje(body)
    const err = clasificar(response.status, msg)
    if (err instanceof ConexionError) reportarFallo()
    else if (response.status >= 500) reportarExito()
    if (err instanceof SesionExpiradaError) dispararSesionExpirada()
    else if (err instanceof PasswordTemporalError) dispararPasswordTemporalExigida()
    throw err
  },
}

/** Estados HTTP sin cuerpo: el constructor de Response lanza si se le pasa uno. */
const SIN_CUERPO = new Set([101, 204, 205, 304])

/** openapi-fetch invoca este fetch en tiempo de ejecución como `fetch(request, requestInitExt)`, aunque
 *  su tipo solo declara un parámetro: con `init` opcional la firma sigue encajando y recibimos el segundo. */
const fetchConTimeout = async (request: Request, init?: RequestInit): Promise<Response> => {
  // La señal combina el timeout con la del llamador (TanStack Query al desmontar, AbortController propio):
  // pasar solo la del timeout descartaría la cancelación y la petición seguiría viva. Ambas se construyen
  // fuera del try: son creación de señales, no la operación que puede fallar con AbortError/TimeoutError.
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const signal = AbortSignal.any([timeout, request.signal, init?.signal].filter((s): s is AbortSignal => !!s))
  try {
    const response = await fetch(request, { ...init, signal })
    // fetch() se resuelve con las cabeceras; el cuerpo se descarga después bajo la misma señal. Se lee entero aquí
    // para que un timeout (o un corte de red) durante la descarga pase por este catch y no escape como un AbortError
    // suelto desde response.json() o desde el middleware. La Response nueva conserva estado y cabeceras.
    const cuerpo = SIN_CUERPO.has(response.status) || response.body === null ? null : await response.arrayBuffer()
    return new Response(cuerpo, { status: response.status, statusText: response.statusText, headers: response.headers })
  } catch (e) {
    const nombre = e instanceof Error ? e.name : ''
    // El navegador puede rechazar la lectura del cuerpo con un AbortError genérico aunque la causa sea el timeout:
    // lo que decide es si la señal del timeout ha vencido.
    const esTimeout = nombre === 'TimeoutError' || timeout.aborted
    // Cancelación del llamador (p. ej. TanStack Query al desmontar): no es una caída del servidor.
    if (!esTimeout && nombre === 'AbortError') throw e
    // Solo la red (TypeError de fetch) y el timeout se disfrazan de "sin conexión".
    if (!esTimeout && !(e instanceof TypeError)) throw e
    reportarFallo()
    // El detalle (causa técnica) lo muestra el diálogo cuando el corte ocurre durante una acción del usuario.
    const detalle = esTimeout ? MSG_TIMEOUT : e instanceof Error ? e.message : String(e)
    throw new ConexionError(0, MSG_SIN_CONEXION + (esTimeout ? ` (${MSG_TIMEOUT})` : ''), detalle)
  }
}

export const api = createClient<paths>({
  baseUrl,
  fetch: fetchConTimeout,
})
api.use(auth)
