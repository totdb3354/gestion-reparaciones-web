import { afterEach, describe, expect, it, vi } from 'vitest'
import { CERROJO_PESTANA, comprobarSesionAlArrancar } from './arranque'
import { LATIDO_MS, UMBRAL_MS } from './latido'
import { borrarSesion, esSesionDeEstaPestana, guardarSesion, leerSesion, type Sesion } from './storage'

const TECNICO: Sesion = { idUsu: 90, nombreUsuario: 'tecnico1', rol: 'TECNICO', idTec: 1, token: 'jwt-tecnico1' }
const AHORA = new Date(2026, 8, 27, 10, 0).getTime()
const VIEJA = String(AHORA - UMBRAL_MS - 1)

/** Sesión guardada por una carga anterior del documento, con la señal de actividad indicada (null: sin señal). Este
 *  documento aún no la ha adoptado. */
function sesionPrevia(latido: string | null) {
  borrarSesion()
  localStorage.setItem('fsgr.sesion', JSON.stringify(TECNICO))
  if (latido === null) localStorage.removeItem('fsgr.latido')
  else localStorage.setItem('fsgr.latido', latido)
}

/** Web Locks falso: `retenidos` son los nombres de los cerrojos que tienen otros documentos. */
function cerrojosFalsos({ retenidos = [] as string[], consultaFalla = false } = {}) {
  const gestor = {
    query: vi.fn(async () => {
      if (consultaFalla) throw new DOMException('no disponible', 'SecurityError')
      return { held: retenidos.map((name) => ({ name, mode: 'shared' as const })), pending: [] }
    }),
    request: vi.fn(() => new Promise<void>(() => {})),
  }
  Object.defineProperty(navigator, 'locks', { configurable: true, value: gestor })
  return gestor
}

describe('comprobarSesionAlArrancar (al cargar el documento desde cero)', () => {
  let detener: () => void = () => {}
  afterEach(() => {
    detener()
    vi.useRealTimers()
    Reflect.deleteProperty(navigator, 'locks')
  })

  describe('solo con la señal de actividad (navegador sin Web Locks)', () => {
    it('con una señal reciente conserva la sesión y renueva la señal', async () => {
      sesionPrevia(String(AHORA - 40_000))
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(leerSesion()).toEqual(TECNICO)
      expect(localStorage.getItem('fsgr.latido')).toBe(String(AHORA))
    })

    it('con una señal de justo dos minutos y medio todavía la conserva', async () => {
      sesionPrevia(String(AHORA - UMBRAL_MS))
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(leerSesion()).toEqual(TECNICO)
    })

    it('con una señal de más de dos minutos y medio cierra la sesión (se cerró el navegador)', async () => {
      sesionPrevia(VIEJA)
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(leerSesion()).toBeNull()
      expect(localStorage.getItem('fsgr.sesion')).toBeNull()
      expect(localStorage.getItem('fsgr.latido')).toBeNull()
    })

    it('sin señal cierra la sesión', async () => {
      sesionPrevia(null)
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(leerSesion()).toBeNull()
    })

    it('con una señal que no es un número cierra la sesión', async () => {
      sesionPrevia('ayer')
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(leerSesion()).toBeNull()
    })

    it('una señal hasta 30 s en el futuro vale (relojes de pestañas); más allá, no', async () => {
      sesionPrevia(String(AHORA + LATIDO_MS))
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(leerSesion()).toEqual(TECNICO)
      detener()
      sesionPrevia(String(AHORA + LATIDO_MS + 1))
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(leerSesion()).toBeNull()
    })

    it.each([
      ['una hora en el futuro', String(AHORA + 3_600_000)],
      ['un número finito enorme (9e15)', '9e15'],
      ['un número que no es finito (1e400)', '1e400'],
      ['un número negativo', '-5'],
    ])('con una señal no válida, %s, cierra la sesión', async (_caso, latido) => {
      sesionPrevia(latido)
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(leerSesion()).toBeNull()
    })

    it('una sesión de la versión anterior en sessionStorage se borra y no entra', async () => {
      sessionStorage.setItem('fsgr.sesion', JSON.stringify(TECNICO))
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(sessionStorage.getItem('fsgr.sesion')).toBeNull()
      expect(leerSesion()).toBeNull()
    })

    it('sin sesión no escribe señal, pero el latido queda en marcha para un inicio de sesión posterior', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(AHORA)
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(localStorage.getItem('fsgr.latido')).toBeNull()
      guardarSesion(TECNICO)
      vi.advanceTimersByTime(LATIDO_MS)
      expect(localStorage.getItem('fsgr.latido')).toBe(String(AHORA + LATIDO_MS))
    })

    it('esta pestaña adopta la sesión conservada', async () => {
      sesionPrevia(String(AHORA - 1000))
      expect(esSesionDeEstaPestana()).toBe(false)
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(esSesionDeEstaPestana()).toBe(true)
    })

    it('con sesión conservada el latido sigue escribiendo cada 30 s', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(AHORA)
      sesionPrevia(String(AHORA - 1000))
      detener = await comprobarSesionAlArrancar(AHORA)
      vi.advanceTimersByTime(LATIDO_MS)
      expect(localStorage.getItem('fsgr.latido')).toBe(String(AHORA + LATIDO_MS))
    })
  })

  describe('con el cerrojo de pestaña (Web Locks)', () => {
    it('otra pestaña de la aplicación abierta y señal vieja: conserva la sesión', async () => {
      cerrojosFalsos({ retenidos: [CERROJO_PESTANA] })
      sesionPrevia(VIEJA)
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(leerSesion()).toEqual(TECNICO)
      expect(localStorage.getItem('fsgr.latido')).toBe(String(AHORA))
    })

    it('ninguna otra pestaña abierta y señal vieja: cierra la sesión', async () => {
      cerrojosFalsos({ retenidos: ['otro.cerrojo'] })
      sesionPrevia(VIEJA)
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(leerSesion()).toBeNull()
    })

    it('ninguna otra pestaña abierta y señal reciente: conserva la sesión', async () => {
      cerrojosFalsos()
      sesionPrevia(String(AHORA - 1000))
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(leerSesion()).toEqual(TECNICO)
    })

    it('si la consulta falla, decide la señal de actividad', async () => {
      cerrojosFalsos({ consultaFalla: true })
      sesionPrevia(String(AHORA - 1000))
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(leerSesion()).toEqual(TECNICO)
      detener()
      sesionPrevia(VIEJA)
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(leerSesion()).toBeNull()
    })

    it('consulta antes de pedir su propio cerrojo, que pide compartido y sostiene mientras vive el documento', async () => {
      const gestor = cerrojosFalsos()
      sesionPrevia(String(AHORA - 1000))
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(gestor.query).toHaveBeenCalledTimes(1)
      expect(gestor.request).toHaveBeenCalledTimes(1)
      expect(gestor.query.mock.invocationCallOrder[0]).toBeLessThan(gestor.request.mock.invocationCallOrder[0])
      const [nombre, opciones, callback] = gestor.request.mock.calls[0] as unknown as [string, LockOptions, () => Promise<void>]
      expect(nombre).toBe(CERROJO_PESTANA)
      expect(opciones).toEqual({ mode: 'shared' })
      let resuelta = false
      void callback().then(() => { resuelta = true })
      await Promise.resolve()
      expect(resuelta).toBe(false)
    })

    it('pide su cerrojo también sin sesión', async () => {
      const gestor = cerrojosFalsos()
      detener = await comprobarSesionAlArrancar(AHORA)
      expect(gestor.request).toHaveBeenCalledWith(CERROJO_PESTANA, { mode: 'shared' }, expect.any(Function))
    })
  })
})
