import { HttpResponse, delay, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { guardarSesion } from '@/shared/session/storage'
import { onSesionExpirada, rearmarSesionExpirada } from '@/shared/session/expiracion'
import { estaConectado, reportarExito, reportarFallo } from './conexion'
import { api } from './client'
import { ConexionError, NoEncontradoError, ReglaNegocioError, SesionExpiradaError, StaleDataError } from './errors'

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
