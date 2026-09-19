import { HttpResponse, http, type RequestHandler } from 'msw'
import type { AsignacionActiva, ComponentesAgrupados, DetalleEdicion, Reparacion, ReparacionResumen, SolicitudAsignacion } from '@/shared/api/client'
import { agrupados, detalleEdicion, resumen } from '../../test/fabrica'

export type EscenarioFormulario = {
  asignacion?: Partial<ReparacionResumen>
  agrupados?: ComponentesAgrupados
  solicitudes?: SolicitudAsignacion[]
  incidencia?: string | null
  activas?: AsignacionActiva[]
  modeloTelefono?: string
  borrador?: string | null
  reparacionesImei?: Reparacion[]
  detalle?: DetalleEdicion
  yaReparados?: number[]
  acciones?: string[]
}

/** Registro de las escrituras recibidas, en orden, para comprobar orden y cuerpos. */
export type LlamadaRegistrada = { metodo: string; ruta: string; cuerpo: unknown }

async function cuerpoDe(request: Request): Promise<unknown> {
  const texto = await request.text()
  if (texto === '') return null
  try {
    return JSON.parse(texto)
  } catch {
    return texto
  }
}

function construir(escenario: EscenarioFormulario, llamadas: LlamadaRegistrada[] | null): RequestHandler[] {
  const asignacion = resumen({ idRep: 'A20260916_1', ...escenario.asignacion })
  const anotar = async (request: Request) => {
    if (llamadas) llamadas.push({ metodo: request.method, ruta: new URL(request.url).pathname, cuerpo: await cuerpoDe(request) })
  }
  return [
    // ── Lecturas (las rutas más específicas, antes) ──
    http.get('*/api/componentes/agrupados', () => HttpResponse.json(escenario.agrupados ?? agrupados())),
    http.get('*/api/reparaciones/asignaciones/:idAsignacion/solicitudes', () => HttpResponse.json(escenario.solicitudes ?? [])),
    http.get('*/api/reparaciones/asignaciones/:idRep', ({ params }) => HttpResponse.json({ ...asignacion, idRep: String(params.idRep) })),
    http.get('*/api/reparaciones/imei/:imei/incidencia-activa', () => HttpResponse.json({ value: escenario.incidencia ?? null })),
    http.get('*/api/reparaciones/imei/:imei/asignaciones-activas', () => HttpResponse.json(escenario.activas ?? [])),
    http.get('*/api/reparaciones/imei/:imei/ya-reparados', () => HttpResponse.json(escenario.yaReparados ?? [])),
    http.get('*/api/reparaciones/imei/:imei/acciones', () => HttpResponse.json(escenario.acciones ?? [])),
    http.get('*/api/reparaciones/imei/:imei', () => HttpResponse.json(escenario.reparacionesImei ?? [])),
    http.get('*/api/telefonos/:imei/modelo', () => HttpResponse.json({ value: escenario.modeloTelefono ?? '' })),
    http.get('*/api/reparaciones/:idRep/borrador', () => HttpResponse.json({ contenido: escenario.borrador ?? null })),
    http.get('*/api/reparaciones/:idRep/detalle-edicion', () => HttpResponse.json(escenario.detalle ?? detalleEdicion())),
    // ── Escrituras con éxito ──
    http.post('*/api/reparaciones/completa', async ({ request }) => {
      await anotar(request)
      return new HttpResponse(null, { status: 201 })
    }),
    http.post('*/api/reparaciones/:idAsignacion/filas', async ({ request }) => {
      await anotar(request)
      return HttpResponse.json({ value: 'R20260916_9' }, { status: 201 })
    }),
    http.post('*/api/reparaciones/:idAsignacion/agotar-componente', async ({ request }) => {
      await anotar(request)
      return new HttpResponse(null, { status: 201 })
    }),
    http.put('*/api/reparaciones/:idRep/borrador', async ({ request }) => {
      await anotar(request)
      return new HttpResponse(null, { status: 200 })
    }),
    http.delete('*/api/reparaciones/:idRep/borrador', async ({ request }) => {
      await anotar(request)
      return new HttpResponse(null, { status: 200 })
    }),
    http.put('*/api/reparaciones/:idRep', async ({ request }) => {
      await anotar(request)
      return new HttpResponse(null, { status: 200 })
    }),
  ]
}

/** Handlers MSW de todas las lecturas del formulario + escrituras con éxito (`filas` → { value: 'R20260916_9' }). Un test que
 *  necesite un fallo lo declara DESPUÉS con `server.use(...)`: el último handler registrado gana. */
export function handlersFormulario(escenario: EscenarioFormulario = {}): RequestHandler[] {
  return construir(escenario, null)
}

/** Igual, pero anotando cada escritura recibida (método, ruta y cuerpo) en `llamadas`, en orden de llegada. */
export function conRegistro(escenario: EscenarioFormulario = {}): { handlers: RequestHandler[]; llamadas: LlamadaRegistrada[] } {
  const llamadas: LlamadaRegistrada[] = []
  return { handlers: construir(escenario, llamadas), llamadas }
}
