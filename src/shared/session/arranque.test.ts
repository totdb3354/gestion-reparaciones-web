import { afterEach, describe, expect, it, vi } from 'vitest'
import { comprobarSesionAlArrancar, esRecargaDeDescarte } from './arranque'
import { LATIDO_MS, UMBRAL_MS } from './latido'
import { guardarSesion, leerSesion, type Sesion } from './storage'

const TECNICO: Sesion = { idUsu: 90, nombreUsuario: 'tecnico1', rol: 'TECNICO', idTec: 1, token: 'jwt-tecnico1' }
const AHORA = new Date(2026, 8, 27, 10, 0).getTime()

/** Sesión guardada por una carga anterior del documento, con la señal de actividad indicada (null: sin señal). */
function sesionPrevia(latido: string | null) {
  guardarSesion(TECNICO)
  if (latido === null) localStorage.removeItem('fsgr.latido')
  else localStorage.setItem('fsgr.latido', latido)
}

function fijarDescartado(valor: boolean) {
  Object.defineProperty(document, 'wasDiscarded', { configurable: true, get: () => valor })
}

describe('comprobarSesionAlArrancar (al cargar el documento desde cero)', () => {
  let detener: () => void = () => {}
  afterEach(() => {
    detener()
    vi.useRealTimers()
    Reflect.deleteProperty(document, 'wasDiscarded')
  })

  it('con una señal reciente conserva la sesión y renueva la señal', () => {
    sesionPrevia(String(AHORA - 40_000))
    detener = comprobarSesionAlArrancar(AHORA)
    expect(leerSesion()).toEqual(TECNICO)
    expect(localStorage.getItem('fsgr.latido')).toBe(String(AHORA))
  })

  it('con una señal de justo dos minutos y medio todavía la conserva', () => {
    sesionPrevia(String(AHORA - UMBRAL_MS))
    detener = comprobarSesionAlArrancar(AHORA)
    expect(leerSesion()).toEqual(TECNICO)
  })

  it('con una señal de más de dos minutos y medio cierra la sesión (se cerró el navegador)', () => {
    sesionPrevia(String(AHORA - UMBRAL_MS - 1))
    detener = comprobarSesionAlArrancar(AHORA)
    expect(leerSesion()).toBeNull()
    expect(localStorage.getItem('fsgr.sesion')).toBeNull()
    expect(localStorage.getItem('fsgr.latido')).toBeNull()
  })

  it('sin señal cierra la sesión', () => {
    sesionPrevia(null)
    detener = comprobarSesionAlArrancar(AHORA)
    expect(leerSesion()).toBeNull()
  })

  it('con una señal que no es un número cierra la sesión', () => {
    sesionPrevia('ayer')
    detener = comprobarSesionAlArrancar(AHORA)
    expect(leerSesion()).toBeNull()
  })

  it('en la recarga de un documento descartado por el navegador conserva la sesión aunque la señal sea vieja', () => {
    fijarDescartado(true)
    expect(esRecargaDeDescarte()).toBe(true)
    sesionPrevia(String(AHORA - 10 * UMBRAL_MS))
    detener = comprobarSesionAlArrancar(AHORA)
    expect(leerSesion()).toEqual(TECNICO)
    expect(localStorage.getItem('fsgr.latido')).toBe(String(AHORA))
  })

  it('si el documento no fue descartado, esRecargaDeDescarte es falso (también sin la propiedad)', () => {
    expect(esRecargaDeDescarte()).toBe(false)
    fijarDescartado(false)
    expect(esRecargaDeDescarte()).toBe(false)
  })

  it('una sesión de la versión anterior en sessionStorage se borra y no entra', () => {
    sessionStorage.setItem('fsgr.sesion', JSON.stringify(TECNICO))
    detener = comprobarSesionAlArrancar(AHORA)
    expect(sessionStorage.getItem('fsgr.sesion')).toBeNull()
    expect(leerSesion()).toBeNull()
  })

  it('sin sesión no escribe señal, pero el latido queda en marcha para un inicio de sesión posterior', () => {
    vi.useFakeTimers()
    vi.setSystemTime(AHORA)
    detener = comprobarSesionAlArrancar(AHORA)
    expect(localStorage.getItem('fsgr.latido')).toBeNull()
    guardarSesion(TECNICO)
    vi.advanceTimersByTime(LATIDO_MS)
    expect(localStorage.getItem('fsgr.latido')).toBe(String(AHORA + LATIDO_MS))
  })

  it('con sesión conservada el latido sigue escribiendo cada 30 s', () => {
    vi.useFakeTimers()
    vi.setSystemTime(AHORA)
    sesionPrevia(String(AHORA - 1000))
    detener = comprobarSesionAlArrancar(AHORA)
    vi.advanceTimersByTime(LATIDO_MS)
    expect(localStorage.getItem('fsgr.latido')).toBe(String(AHORA + LATIDO_MS))
  })
})
