import { HttpResponse, http, type RequestHandler } from 'msw'
import type { Componente, SolicitudResumen, SolicitudStock } from '@/shared/api/client'
import type { LlamadaRegistrada } from '../../formulario/test/handlers'

export type EscenarioNotificaciones = {
  urgPend?: SolicitudResumen[]
  prevPend?: SolicitudStock[]
  urgRech?: SolicitudResumen[]
  prevRech?: SolicitudStock[]
  gestionados?: Componente[]
}

async function cuerpoDe(request: Request): Promise<unknown> {
  const texto = await request.clone().text()
  return texto === '' ? null : JSON.parse(texto)
}

function construir(e: EscenarioNotificaciones, llamadas: LlamadaRegistrada[] | null): RequestHandler[] {
  // El estado de cada solicitud manda sobre la lista en la que llegó: así un PATCH de estado la cambia de grupo.
  let urgentes: SolicitudResumen[] = [
    ...(e.urgPend ?? []).map((s) => ({ ...s, estado: 'PENDIENTE' })),
    ...(e.urgRech ?? []).map((s) => ({ ...s, estado: 'RECHAZADA' })),
  ]
  let preventivas: SolicitudStock[] = [
    ...(e.prevPend ?? []).map((s) => ({ ...s, estado: 'PENDIENTE' })),
    ...(e.prevRech ?? []).map((s) => ({ ...s, estado: 'RECHAZADA' })),
  ]
  const gestionados = e.gestionados ?? []
  const filtrar = <T extends { estado: string }>(lista: T[], request: Request) => {
    const estado = new URL(request.url).searchParams.get('estado')
    return estado ? lista.filter((s) => s.estado === estado) : lista
  }
  const registrar = async (request: Request) => {
    llamadas?.push({ metodo: request.method, ruta: new URL(request.url).pathname, cuerpo: await cuerpoDe(request) })
  }
  const hecho = () => new HttpResponse(null, { status: 204 })
  return [
    http.get('*/api/solicitudes/count', () => HttpResponse.json({ value: urgentes.filter((s) => s.estado === 'PENDIENTE').length })),
    http.get('*/api/solicitudes-stock/count', () => HttpResponse.json({ value: preventivas.filter((s) => s.estado === 'PENDIENTE').length })),
    http.get('*/api/solicitudes', ({ request }) => HttpResponse.json(filtrar(urgentes, request))),
    http.get('*/api/solicitudes-stock', ({ request }) => HttpResponse.json(filtrar(preventivas, request))),
    http.get('*/api/componentes/gestionados', () => HttpResponse.json(gestionados)),
    http.patch('*/api/solicitudes/:idRc/estado', async ({ request, params }) => {
      await registrar(request)
      const { estado } = (await request.clone().json()) as { estado: string }
      urgentes = urgentes.map((s) => (s.idRc === Number(params.idRc) ? { ...s, estado } : s))
      return hecho()
    }),
    http.patch('*/api/solicitudes/:idRc/limpiar', async ({ request, params }) => {
      await registrar(request)
      urgentes = urgentes.filter((s) => s.idRc !== Number(params.idRc))
      return hecho()
    }),
    http.patch('*/api/solicitudes-stock/:idSol/estado', async ({ request, params }) => {
      await registrar(request)
      const { estado } = (await request.clone().json()) as { estado: string }
      preventivas = preventivas.map((s) => (s.idSol === Number(params.idSol) ? { ...s, estado } : s))
      return hecho()
    }),
    http.delete('*/api/solicitudes-stock/:idSol', async ({ request, params }) => {
      await registrar(request)
      preventivas = preventivas.filter((s) => s.idSol !== Number(params.idSol))
      return hecho()
    }),
  ]
}

/** Lecturas y escrituras de la campana con éxito. Los `count` se derivan de las listas pendientes. */
export function handlersNotificaciones(e: EscenarioNotificaciones = {}): RequestHandler[] {
  return construir(e, null)
}

/** Igual, registrando las escrituras recibidas, en orden, para comprobar rutas y cuerpos. */
export function conRegistroNotificaciones(e: EscenarioNotificaciones = {}): { handlers: RequestHandler[]; llamadas: LlamadaRegistrada[] } {
  const llamadas: LlamadaRegistrada[] = []
  return { handlers: construir(e, llamadas), llamadas }
}
