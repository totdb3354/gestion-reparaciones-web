import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { arrancarLatido, LATIDO_MS, UMBRAL_MS } from './latido'
import { borrarSesion, guardarSesion, type Sesion } from './storage'

const TECNICO: Sesion = { idUsu: 90, nombreUsuario: 'tecnico1', rol: 'TECNICO', idTec: 1, token: 'jwt-tecnico1', passwordTemporal: false }
const INICIO = new Date(2026, 8, 27, 10, 0).getTime()

function fijarVisibilidad(valor: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => valor })
}

describe('latido: señal de actividad de la pestaña', () => {
  let detener: () => void = () => {}
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(INICIO)
  })
  afterEach(() => {
    detener()
    vi.useRealTimers()
    vi.restoreAllMocks()
    // Vuelve a la propiedad heredada del prototipo.
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('intervalo de 30 s y umbral de dos minutos y medio', () => {
    expect(LATIDO_MS).toBe(30_000)
    expect(UMBRAL_MS).toBe(150_000)
  })

  it('con sesión escribe la hora cada 30 s, sin peticiones al servidor', () => {
    guardarSesion(TECNICO)
    localStorage.removeItem('fsgr.latido')
    const peticion = vi.spyOn(globalThis, 'fetch')
    detener = arrancarLatido()
    vi.advanceTimersByTime(LATIDO_MS - 1)
    expect(localStorage.getItem('fsgr.latido')).toBeNull()
    vi.advanceTimersByTime(1)
    expect(localStorage.getItem('fsgr.latido')).toBe(String(INICIO + LATIDO_MS))
    vi.advanceTimersByTime(LATIDO_MS)
    expect(localStorage.getItem('fsgr.latido')).toBe(String(INICIO + 2 * LATIDO_MS))
    expect(peticion).not.toHaveBeenCalled()
  })

  it('con sesión escribe al volver a ser visible, al recibir el foco y en pageshow', () => {
    guardarSesion(TECNICO)
    detener = arrancarLatido()
    localStorage.removeItem('fsgr.latido')
    fijarVisibilidad('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(localStorage.getItem('fsgr.latido')).toBeNull()
    vi.setSystemTime(INICIO + 1000)
    fijarVisibilidad('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(localStorage.getItem('fsgr.latido')).toBe(String(INICIO + 1000))
    vi.setSystemTime(INICIO + 2000)
    window.dispatchEvent(new Event('focus'))
    expect(localStorage.getItem('fsgr.latido')).toBe(String(INICIO + 2000))
    vi.setSystemTime(INICIO + 3000)
    window.dispatchEvent(new Event('pageshow'))
    expect(localStorage.getItem('fsgr.latido')).toBe(String(INICIO + 3000))
  })

  it('con sesión escribe en pagehide y en resume (recarga justo al despertar el PC o al volver de una pestaña congelada)', () => {
    guardarSesion(TECNICO)
    detener = arrancarLatido()
    vi.setSystemTime(INICIO + 4000)
    window.dispatchEvent(new Event('pagehide'))
    expect(localStorage.getItem('fsgr.latido')).toBe(String(INICIO + 4000))
    vi.setSystemTime(INICIO + 5000)
    document.dispatchEvent(new Event('resume'))
    expect(localStorage.getItem('fsgr.latido')).toBe(String(INICIO + 5000))
  })

  it('sin sesión no escribe', () => {
    detener = arrancarLatido()
    vi.advanceTimersByTime(3 * LATIDO_MS)
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('pageshow'))
    window.dispatchEvent(new Event('pagehide'))
    document.dispatchEvent(new Event('resume'))
    fijarVisibilidad('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(localStorage.getItem('fsgr.latido')).toBeNull()
  })

  it('tras borrar la sesión deja de escribir; si se vuelve a entrar en la pestaña, sigue', () => {
    guardarSesion(TECNICO)
    detener = arrancarLatido()
    borrarSesion()
    vi.advanceTimersByTime(3 * LATIDO_MS)
    window.dispatchEvent(new Event('focus'))
    expect(localStorage.getItem('fsgr.latido')).toBeNull()
    guardarSesion(TECNICO)
    vi.advanceTimersByTime(LATIDO_MS)
    expect(localStorage.getItem('fsgr.latido')).toBe(String(INICIO + 4 * LATIDO_MS))
  })

  it('detenerlo retira el intervalo y los listeners; arrancarlo otra vez sustituye al anterior', () => {
    guardarSesion(TECNICO)
    const primero = arrancarLatido()
    detener = arrancarLatido()
    const escribir = vi.spyOn(Storage.prototype, 'setItem')
    vi.advanceTimersByTime(LATIDO_MS)
    expect(escribir).toHaveBeenCalledTimes(1)
    detener()
    primero()
    escribir.mockClear()
    vi.advanceTimersByTime(3 * LATIDO_MS)
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('pagehide'))
    document.dispatchEvent(new Event('resume'))
    expect(escribir).not.toHaveBeenCalled()
  })
})
