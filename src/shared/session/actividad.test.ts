import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AVISO_MS,
  CLAVE_ACTIVIDAD,
  INACTIVIDAD_MS,
  arrancarMarcaDeActividad,
  escribirActividad,
  leerActividad,
} from './actividad'
import { CLAVE_SESION } from './storage'

const SESION = JSON.stringify({ idUsu: 8, nombreUsuario: 'ana', rol: 'TECNICO', idTec: 4, token: 't' })

describe('marca de actividad', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('el tope de inactividad son dos horas y el aviso un minuto antes', () => {
    expect(INACTIVIDAD_MS).toBe(2 * 60 * 60 * 1000)
    expect(AVISO_MS).toBe(60_000)
  })

  it('escribe y lee la hora', () => {
    escribirActividad(1_700_000_000_000)
    expect(localStorage.getItem(CLAVE_ACTIVIDAD)).toBe('1700000000000')
    expect(leerActividad()).toBe(1_700_000_000_000)
  })

  it('sin marca devuelve null', () => {
    expect(leerActividad()).toBeNull()
  })

  it('una marca que no es un número devuelve null', () => {
    localStorage.setItem(CLAVE_ACTIVIDAD, 'ayer')
    expect(leerActividad()).toBeNull()
  })

  it('el ratón y el teclado escriben la marca, solo si hay sesión', () => {
    localStorage.setItem(CLAVE_SESION, SESION)
    const detener = arrancarMarcaDeActividad()
    vi.setSystemTime(1_000)
    document.dispatchEvent(new Event('pointerdown'))
    expect(leerActividad()).toBe(1_000)
    vi.setSystemTime(2_000)
    document.dispatchEvent(new Event('keydown'))
    expect(leerActividad()).toBe(2_000)
    detener()
  })

  it('sin sesión no escribe nada', () => {
    const detener = arrancarMarcaDeActividad()
    document.dispatchEvent(new Event('pointerdown'))
    expect(leerActividad()).toBeNull()
    detener()
  })

  it('el foco de la ventana NO cuenta como actividad', () => {
    localStorage.setItem(CLAVE_SESION, SESION)
    const detener = arrancarMarcaDeActividad()
    vi.setSystemTime(5_000)
    window.dispatchEvent(new Event('focus'))
    expect(leerActividad()).toBeNull()
    detener()
  })

  it('al detener deja de escribir', () => {
    localStorage.setItem(CLAVE_SESION, SESION)
    const detener = arrancarMarcaDeActividad()
    vi.setSystemTime(1_000)
    document.dispatchEvent(new Event('pointerdown'))
    detener()
    vi.setSystemTime(9_000)
    document.dispatchEvent(new Event('pointerdown'))
    expect(leerActividad()).toBe(1_000)
  })

  it('arrancarla dos veces no duplica la escucha', () => {
    localStorage.setItem(CLAVE_SESION, SESION)
    const primera = arrancarMarcaDeActividad()
    const segunda = arrancarMarcaDeActividad()
    vi.setSystemTime(3_000)
    document.dispatchEvent(new Event('pointerdown'))
    expect(leerActividad()).toBe(3_000)
    segunda()
    vi.setSystemTime(7_000)
    document.dispatchEvent(new Event('pointerdown'))
    expect(leerActividad()).toBe(3_000)
    primera()
  })

  it('si el almacenamiento falla no lanza', () => {
    const original = localStorage.setItem
    localStorage.setItem = () => {
      throw new Error('bloqueado')
    }
    expect(() => escribirActividad(1)).not.toThrow()
    localStorage.setItem = original
  })
})
