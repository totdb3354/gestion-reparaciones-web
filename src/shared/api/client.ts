import createClient, { type Middleware } from 'openapi-fetch'
import type { components, paths } from './schema'
import { leerSesion } from '@/shared/session/storage'
import { dispararSesionExpirada } from '@/shared/session/expiracion'
import { ConexionError, MSG_SIN_CONEXION, MSG_TIMEOUT, SesionExpiradaError, clasificar, extraerMensaje } from './errors'
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
