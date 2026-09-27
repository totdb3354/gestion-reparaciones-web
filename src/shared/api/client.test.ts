import { HttpResponse, delay, http } from 'msw'
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { server } from '@/test/server'
import { borrarSesion, guardarSesion } from '@/shared/session/storage'
import { onSesionExpirada, rearmarSesionExpirada } from '@/shared/session/expiracion'
import { estaConectado, reportarExito, reportarFallo } from './conexion'
import { TIMEOUT_MS, api } from './client'
import type {
  AgotarRequest, AsignacionActiva, Cliente, Componente, ComponentesAgrupados, ContadoresPendientes, DetalleEdicion,
  EditarReparacionRequest, FilaReparacion, GuardarFilaRequest, InsertarCompletaRequest, LoginResponse, Reparacion,
  ReparacionResumen, SolicitudAsignacion, SolicitudResumen, SolicitudStock, Tecnico,
} from './client'
import type { paths } from './schema'
import {
  ConexionError, LimiteLoginError, MSG_LIMITE_LOGIN, MSG_TIMEOUT, NoEncontradoError, ReglaNegocioError, SesionDeOtraPestanaError, SesionExpiradaError,
  StaleDataError, esErrorGestionadoGlobalmente,
} from './errors'

/** El fetch real rechaza con el DOMException de Node, que hereda de Error; el DOMException global de jsdom
 *  no hereda (y no es el mismo objeto), así que estos dobles imitan al real: un Error con el `name` del corte. */
const errorDeCorte = (nombre: string) => Object.assign(new Error(nombre), { name: nombre })

describe('cliente API', () => {
  beforeEach(() => {
    reportarExito()
    rearmarSesionExpirada()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })
  it('añade el bearer de la sesión y devuelve data tipada', async () => {
    guardarSesion({ idUsu: 1, nombreUsuario: 'a', rol: 'ADMIN', idTec: null, token: 'jwt-1' })
    let auth = ''
    server.use(
      http.get('*/api/clientes', ({ request }) => {
        auth = request.headers.get('authorization') ?? ''
        return HttpResponse.json([{ idCli: 1, nombre: 'WEB', activo: true, updatedAt: '2026-09-01T10:00:00' }])
      }),
    )
    const { data } = await api.GET('/api/clientes')
    expect(auth).toBe('Bearer jwt-1')
    expect(data?.[0]?.nombre).toBe('WEB')
  })
  it('cada petición sale con la sesión de su pestaña: si otra pestaña guardó otra, no sale', async () => {
    guardarSesion({ idUsu: 1, nombreUsuario: 'a', rol: 'ADMIN', idTec: null, token: 'jwt-1' })
    const vistas: string[] = []
    server.use(http.get('*/api/clientes', ({ request }) => {
      vistas.push(request.headers.get('authorization') ?? '')
      return HttpResponse.json([])
    }))
    await api.GET('/api/clientes')
    localStorage.setItem('fsgr.sesion', JSON.stringify({ idUsu: 2, nombreUsuario: 'b', rol: 'TECNICO', idTec: 2, token: 'jwt-2' }))
    const error = await api.GET('/api/clientes').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(SesionDeOtraPestanaError)
    expect(esErrorGestionadoGlobalmente(error)).toBe(true)
    expect(vistas).toEqual(['Bearer jwt-1'])
    expect(estaConectado()).toBe(true)
  })
  it('si otra pestaña cerró la sesión, la petición no sale; tras cerrarla también en esta, sale sin bearer', async () => {
    guardarSesion({ idUsu: 1, nombreUsuario: 'a', rol: 'ADMIN', idTec: null, token: 'jwt-1' })
    const vistas: string[] = []
    server.use(http.get('*/api/clientes', ({ request }) => {
      vistas.push(request.headers.get('authorization') ?? 'sin')
      return HttpResponse.json([])
    }))
    localStorage.removeItem('fsgr.sesion')
    await expect(api.GET('/api/clientes')).rejects.toBeInstanceOf(SesionDeOtraPestanaError)
    borrarSesion()
    await api.GET('/api/clientes')
    expect(vistas).toEqual(['sin'])
  })
  it('409 lanza StaleDataError con el mensaje del servidor', async () => {
    server.use(http.delete('*/api/clientes/5', () => HttpResponse.json({ message: 'Tiene teléfonos' }, { status: 409 })))
    await expect(api.DELETE('/api/clientes/{idCli}', { params: { path: { idCli: 5 } } })).rejects.toBeInstanceOf(StaleDataError)
    await expect(api.DELETE('/api/clientes/{idCli}', { params: { path: { idCli: 5 } } })).rejects.toThrow('Tiene teléfonos')
  })
  it('422 lanza ReglaNegocioError con el mensaje', async () => {
    server.use(http.post('*/api/clientes', () => HttpResponse.json({ message: 'Nombre duplicado' }, { status: 422 })))
    await expect(api.POST('/api/clientes', { body: { nombre: 'x' } })).rejects.toBeInstanceOf(ReglaNegocioError)
  })
  it('401 con sesión dispara el hook de sesión expirada', async () => {
    guardarSesion({ idUsu: 1, nombreUsuario: 'a', rol: 'ADMIN', idTec: null, token: 'jwt-1' })
    const h = vi.fn()
    onSesionExpirada(h)
    server.use(http.get('*/api/clientes', () => new HttpResponse(null, { status: 401 })))
    await expect(api.GET('/api/clientes')).rejects.toBeInstanceOf(SesionExpiradaError)
    expect(h).toHaveBeenCalledTimes(1)
  })
  it('fallo de red lanza ConexionError y marca desconectado; un éxito posterior autocura', async () => {
    server.use(http.get('*/api/clientes', () => HttpResponse.error()))
    await expect(api.GET('/api/clientes')).rejects.toBeInstanceOf(ConexionError)
    expect(estaConectado()).toBe(false)
    server.use(http.get('*/api/clientes', () => HttpResponse.json([])))
    await api.GET('/api/clientes')
    expect(estaConectado()).toBe(true)
  })
  it('un 5xx lanza ConexionError y marca desconectado', async () => {
    server.use(http.get('*/api/clientes', () => HttpResponse.text('boom', { status: 503 })))
    await expect(api.GET('/api/clientes')).rejects.toBeInstanceOf(ConexionError)
    expect(estaConectado()).toBe(false)
  })
  it('un 503 con {message} de nuestro backend es de negocio y no enciende el banner', async () => {
    server.use(http.get('*/api/clientes', () => HttpResponse.json({ message: 'No se pudo obtener el tipo de cambio de USD. Inténtalo de nuevo.' }, { status: 503 })))
    const err: unknown = await api.GET('/api/clientes').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ReglaNegocioError)
    expect(estaConectado()).toBe(true)
  })
  it.each([503, 429])('un %s del login es el límite de intentos: su mensaje, sin encender el banner', async (status) => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.text('<html>503</html>', { status })))
    const err: unknown = await api.POST('/api/auth/login', { body: { usuario: 'u', password: 'p' } }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LimiteLoginError)
    expect(err).not.toBeInstanceOf(ConexionError)
    expect((err as Error).message).toBe(MSG_LIMITE_LOGIN)
    expect(MSG_LIMITE_LOGIN).toBe('Demasiados intentos de inicio de sesión. Espera unos segundos y vuelve a intentarlo.')
    expect(estaConectado()).toBe(true)
  })
  it('fuera del login un 503 sigue siendo sin conexión y un 429 no es el límite', async () => {
    server.use(
      http.post('*/api/clientes', () => HttpResponse.text('<html>503</html>', { status: 503 })),
      http.get('*/api/clientes', () => HttpResponse.text('', { status: 429 })),
    )
    await expect(api.POST('/api/clientes', { body: { nombre: 'x' } })).rejects.toBeInstanceOf(ConexionError)
    const err: unknown = await api.GET('/api/clientes').catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(LimiteLoginError)
  })
  it('un 4xx no toca el estado de conexión (y cura el banner)', async () => {
    reportarFallo()
    server.use(http.get('*/api/clientes', () => new HttpResponse(null, { status: 404 })))
    await expect(api.GET('/api/clientes')).rejects.toBeInstanceOf(NoEncontradoError)
    expect(estaConectado()).toBe(true)
  })
  it('el timeout se reporta como sin conexión con el sufijo', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(errorDeCorte('TimeoutError'))
    const err: unknown = await api.GET('/api/clientes').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ConexionError)
    expect((err as Error).message).toMatch(/\(tiempo de espera agotado\)$/)
    expect((err as ConexionError).detalle).toBe('tiempo de espera agotado')
    expect(estaConectado()).toBe(false)
  })
  it('un fallo de red guarda el mensaje del fetch como detalle del diálogo', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const err: unknown = await api.GET('/api/clientes').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ConexionError)
    expect((err as ConexionError).detalle).toBe('Failed to fetch')
  })
  it('la señal del llamador cancela de verdad la petición y no toca el estado de conexión', async () => {
    // Sin combinar la señal del llamador (AbortSignal.any) el abort no llegaría al fetch y, con la
    // respuesta colgada para siempre, esta promesa nunca se resolvería.
    server.use(http.get('*/api/clientes', async () => { await delay('infinite'); return HttpResponse.json([]) }))
    const ac = new AbortController()
    const promesa = api.GET('/api/clientes', { signal: ac.signal })
    ac.abort()
    const err: unknown = await promesa.catch((e: unknown) => e)
    expect((err as Error).name).toBe('AbortError')
    expect(err).not.toBeInstanceOf(ConexionError)
    expect(estaConectado()).toBe(true)
  })
  it('una cancelación del llamador no se disfraza de sin conexión', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(errorDeCorte('AbortError'))
    const err: unknown = await api.GET('/api/clientes').catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(ConexionError)
    expect((err as Error).name).toBe('AbortError')
    expect(estaConectado()).toBe(true)
  })
})

describe('cliente API: descarga del cuerpo tras las cabeceras', () => {
  /** Respuesta cuyas cabeceras llegan ya y cuyo cuerpo no termina nunca: la lectura falla con `alCortar()` cuando
   *  se aborta la señal que recibió el fetch (como el navegador con la descarga lenta), o antes si se llama a `cortar`. */
  const cuerpoColgado = (alCortar: () => unknown) => {
    let cortar: ((e: unknown) => void) | null = null
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_req, init) => {
      const cuerpo = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('[{"idCli":1'))
          cortar = (e) => controller.error(e)
          init?.signal?.addEventListener('abort', () => controller.error(alCortar()))
        },
      })
      return Promise.resolve(new Response(cuerpo, { status: 200, headers: { 'Content-Type': 'application/json' } }))
    })
    return {
      cortar: (e: unknown) => {
        if (!cortar) throw new Error('el fetch aún no ha empezado')
        cortar(e)
      },
    }
  }

  beforeEach(() => {
    reportarExito()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })
  it('un timeout que vence durante la descarga del cuerpo es sin conexión con el sufijo, no un AbortError', async () => {
    // AbortSignal.timeout usa los temporizadores internos de Node, que vi.useFakeTimers no controla: la señal del
    // timeout se sustituye por una que el test vence a mano, como haría el reloj a los TIMEOUT_MS.
    const reloj = new AbortController()
    const espia = vi.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(reloj.signal)
    cuerpoColgado(() => errorDeCorte('AbortError'))
    const promesa = api.GET('/api/clientes').catch((e: unknown) => e)
    await vi.waitFor(() => { expect(globalThis.fetch).toHaveBeenCalled() })
    reloj.abort(errorDeCorte('TimeoutError'))
    const err: unknown = await promesa
    expect(espia).toHaveBeenCalledWith(TIMEOUT_MS)
    expect(err).toBeInstanceOf(ConexionError)
    expect((err as Error).message).toContain(MSG_TIMEOUT)
    expect((err as ConexionError).detalle).toBe(MSG_TIMEOUT)
    expect(estaConectado()).toBe(false)
  })
  it('una cancelación del llamador durante la descarga sigue siendo un AbortError y no toca la conexión', async () => {
    cuerpoColgado(() => errorDeCorte('AbortError'))
    const ac = new AbortController()
    const promesa = api.GET('/api/clientes', { signal: ac.signal }).catch((e: unknown) => e)
    await vi.waitFor(() => { expect(globalThis.fetch).toHaveBeenCalled() })
    ac.abort()
    const err: unknown = await promesa
    expect(err).not.toBeInstanceOf(ConexionError)
    expect((err as Error).name).toBe('AbortError')
    expect(estaConectado()).toBe(true)
  })
  it('un corte de red durante la descarga es sin conexión con el mensaje de la red como detalle', async () => {
    const { cortar } = cuerpoColgado(() => errorDeCorte('AbortError'))
    const promesa = api.GET('/api/clientes').catch((e: unknown) => e)
    await vi.waitFor(() => { cortar(new TypeError('network error')) })
    const err: unknown = await promesa
    expect(err).toBeInstanceOf(ConexionError)
    expect((err as Error).message).not.toContain(MSG_TIMEOUT)
    expect((err as ConexionError).detalle).toBe('network error')
    expect(estaConectado()).toBe(false)
  })
  it('un 204 sin cuerpo sigue funcionando', async () => {
    server.use(http.delete('*/api/clientes/5', () => new HttpResponse(null, { status: 204 })))
    const { data, response } = await api.DELETE('/api/clientes/{idCli}', { params: { path: { idCli: 5 } } })
    expect(response.status).toBe(204)
    expect(data).toBeUndefined()
  })
  it('una respuesta JSON normal se sigue leyendo entera', async () => {
    server.use(http.get('*/api/clientes', () => HttpResponse.json([{ idCli: 1, nombre: 'WEB', activo: true, updatedAt: '2026-09-01T10:00:00' }])))
    const { data, response } = await api.GET('/api/clientes')
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(data?.[0]?.nombre).toBe('WEB')
  })
})

describe('tipos del contrato (required + nullable, spec web-taller §5.3)', () => {
  it('los campos siempre presentes son obligatorios y los nulos van como T | null', () => {
    expectTypeOf<Cliente['nombre']>().toEqualTypeOf<string>()
    expectTypeOf<LoginResponse['idTec']>().toEqualTypeOf<number | null>()
    expectTypeOf<ReparacionResumen['idRep']>().toEqualTypeOf<string>()
    expectTypeOf<ReparacionResumen['fechaFin']>().toEqualTypeOf<string | null>()
    expectTypeOf<ReparacionResumen['glassEntregadoPor']>().toEqualTypeOf<number | null>()
    expectTypeOf<Tecnico['nombre']>().toEqualTypeOf<string>()
    expectTypeOf<ContadoresPendientes>().toEqualTypeOf<{ reparaciones: number; glass: number; pulidos: number }>()
  })
})

describe('tipos del contrato del formulario y de la campana (spec web-formulario §5.5)', () => {
  it('lo que puede venir a null va como T | null y lo demás es obligatorio', () => {
    expectTypeOf<FilaReparacion['observacion']>().toEqualTypeOf<string | null>()
    expectTypeOf<FilaReparacion['prefijo']>().toEqualTypeOf<string | null>()
    expectTypeOf<FilaReparacion['descripcionSolicitud']>().toEqualTypeOf<string | null>()
    expectTypeOf<FilaReparacion['estadoSolicitud']>().toEqualTypeOf<string | null>()
    expectTypeOf<FilaReparacion['idCom']>().toEqualTypeOf<number>()
    expectTypeOf<SolicitudAsignacion>().toEqualTypeOf<FilaReparacion>()
    expectTypeOf<Componente['idComMaster']>().toEqualTypeOf<number | null>()
    expectTypeOf<Componente['ultimoPedido']>().toEqualTypeOf<string | null>()
    expectTypeOf<Componente['stock']>().toEqualTypeOf<number>()
    expectTypeOf<ComponentesAgrupados>().toEqualTypeOf<Record<string, Componente[]>>()
    expectTypeOf<Reparacion['fechaFin']>().toEqualTypeOf<string | null>()
    expectTypeOf<DetalleEdicion['updatedAt']>().toEqualTypeOf<string>()
    expectTypeOf<DetalleEdicion['observacion']>().toEqualTypeOf<string | null>()
    expectTypeOf<AsignacionActiva['idTec']>().toEqualTypeOf<number>()
    expectTypeOf<SolicitudResumen['descripcion']>().toEqualTypeOf<string | null>()
    expectTypeOf<SolicitudStock['descripcion']>().toEqualTypeOf<string | null>()
  })
  it('los cuerpos de las escrituras del formulario: idTec obligatorio y los opcionales como null', () => {
    expectTypeOf<InsertarCompletaRequest['idAsignacion']>().toEqualTypeOf<string | null>()
    expectTypeOf<InsertarCompletaRequest['idRepAnterior']>().toEqualTypeOf<string | null>()
    expectTypeOf<InsertarCompletaRequest['categoria']>().toEqualTypeOf<string | null>()
    expectTypeOf<InsertarCompletaRequest['idTec']>().toEqualTypeOf<number>()
    expectTypeOf<InsertarCompletaRequest['filas']>().toEqualTypeOf<FilaReparacion[]>()
    expectTypeOf<GuardarFilaRequest['idRepAnterior']>().toEqualTypeOf<string | null>()
    expectTypeOf<GuardarFilaRequest['idTec']>().toEqualTypeOf<number>()
    expectTypeOf<AgotarRequest['descripcion']>().toEqualTypeOf<string | null>()
    expectTypeOf<EditarReparacionRequest['observacionNueva']>().toEqualTypeOf<string | null>()
    expectTypeOf<EditarReparacionRequest['nNuevas']>().toEqualTypeOf<number>()
  })
  it('las respuestas que eran mapas sueltos llegan tipadas', () => {
    type ContarUrgentes = paths['/api/solicitudes/count']['get']['responses'][200]['content']['*/*']
    type ContarPreventivas = paths['/api/solicitudes-stock/count']['get']['responses'][200]['content']['*/*']
    type Borrador = paths['/api/reparaciones/{idRep}/borrador']['get']['responses'][200]['content']['*/*']
    type Incidencia = paths['/api/reparaciones/imei/{imei}/incidencia-activa']['get']['responses'][200]['content']['*/*']
    type Modelo = paths['/api/telefonos/{imei}/modelo']['get']['responses'][200]['content']['*/*']
    expectTypeOf<ContarUrgentes['value']>().toEqualTypeOf<number>()
    expectTypeOf<ContarPreventivas['value']>().toEqualTypeOf<number>()
    expectTypeOf<Borrador['contenido']>().toEqualTypeOf<string | null>()
    expectTypeOf<Incidencia['value']>().toEqualTypeOf<string | null>()
    expectTypeOf<Modelo['value']>().toEqualTypeOf<string | null>()
    type Creada = paths['/api/reparaciones/{idAsignacion}/filas']['post']['responses'][201]['content']['*/*']
    expectTypeOf<Creada['value']>().toEqualTypeOf<string | null>()
  })
})
