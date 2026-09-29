import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adoptarSesionGuardada, borrarSesion, esAdmin, esSesionDeEstaPestana, esAdminOSuperTecnico, esSuperTecnico, escribirLatido, guardarSesion, leerLatido, leerSesion, type Sesion } from './storage'

const tecnicoF: Sesion = { idUsu: 7, nombreUsuario: 'tecnico_f', rol: 'SUPERTECNICO', idTec: 3, token: 'jwt', passwordTemporal: false }

describe('storage de sesión', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())
  it('sin sesión devuelve null', () => {
    expect(leerSesion()).toBeNull()
  })
  it('guarda y lee la sesión en localStorage, compartida por todas las pestañas', () => {
    guardarSesion(tecnicoF)
    expect(leerSesion()).toEqual(tecnicoF)
    expect(localStorage.getItem('fsgr.sesion')).toContain('"tecnico_f"')
    expect(sessionStorage.getItem('fsgr.sesion')).toBeNull()
  })
  it('guardar la sesión escribe también la señal de actividad', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    guardarSesion(tecnicoF)
    expect(localStorage.getItem('fsgr.latido')).toBe('1700000000000')
  })
  it('borrar deja sin sesión y sin señal de actividad', () => {
    guardarSesion(tecnicoF)
    borrarSesion()
    expect(leerSesion()).toBeNull()
    expect(localStorage.getItem('fsgr.sesion')).toBeNull()
    expect(localStorage.getItem('fsgr.latido')).toBeNull()
  })
  it('un valor corrupto se trata como sin sesión', () => {
    localStorage.setItem('fsgr.sesion', '{no-json')
    expect(leerSesion()).toBeNull()
  })
  it('un valor parseable pero incompleto o con tipos incorrectos se trata como sin sesión', () => {
    localStorage.setItem('fsgr.sesion', JSON.stringify({ ...tecnicoF, rol: undefined }))
    expect(leerSesion()).toBeNull()
    localStorage.setItem('fsgr.sesion', JSON.stringify({ ...tecnicoF, idUsu: '7' }))
    expect(leerSesion()).toBeNull()
  })
  it('la marca de contraseña temporal se normaliza a booleano y sin ella la sesión es normal', () => {
    localStorage.setItem('fsgr.sesion', JSON.stringify({ ...tecnicoF, passwordTemporal: undefined }))
    expect(leerSesion()).toEqual({ ...tecnicoF, passwordTemporal: false })
    localStorage.setItem('fsgr.sesion', JSON.stringify({ ...tecnicoF, passwordTemporal: 'sí' }))
    expect(leerSesion()?.passwordTemporal).toBe(false)
    localStorage.setItem('fsgr.sesion', JSON.stringify({ ...tecnicoF, passwordTemporal: true }))
    expect(leerSesion()?.passwordTemporal).toBe(true)
  })
  it('si el almacenamiento lanza al leer, sin sesión y sin señal', () => {
    localStorage.setItem('fsgr.sesion', JSON.stringify(tecnicoF))
    escribirLatido(1)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    expect(leerSesion()).toBeNull()
    expect(leerLatido()).toBeNull()
  })
  it('si el almacenamiento lanza al escribir o borrar, no propaga el error y queda sin sesión', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    expect(() => guardarSesion(tecnicoF)).not.toThrow()
    expect(() => escribirLatido()).not.toThrow()
    expect(() => borrarSesion()).not.toThrow()
    expect(leerSesion()).toBeNull()
  })
  it('la señal de actividad se lee como número; si falta o no es numérica, null', () => {
    expect(leerLatido()).toBeNull()
    escribirLatido(1234)
    expect(localStorage.getItem('fsgr.latido')).toBe('1234')
    expect(leerLatido()).toBe(1234)
    localStorage.setItem('fsgr.latido', 'ayer')
    expect(leerLatido()).toBeNull()
    localStorage.setItem('fsgr.latido', '')
    expect(leerLatido()).toBeNull()
  })
  it('la sesión de esta pestaña: la que guardó o adoptó; deja de serlo si otra pestaña guarda otra o la borra', () => {
    expect(esSesionDeEstaPestana()).toBe(true)
    guardarSesion(tecnicoF)
    expect(esSesionDeEstaPestana()).toBe(true)
    localStorage.setItem('fsgr.sesion', JSON.stringify({ ...tecnicoF, token: 'jwt-otra' }))
    expect(esSesionDeEstaPestana()).toBe(false)
    adoptarSesionGuardada()
    expect(esSesionDeEstaPestana()).toBe(true)
    localStorage.removeItem('fsgr.sesion')
    expect(esSesionDeEstaPestana()).toBe(false)
    borrarSesion()
    expect(esSesionDeEstaPestana()).toBe(true)
  })
  it('si el almacenamiento no acepta la sesión, esta pestaña no la adopta', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError')
    })
    guardarSesion(tecnicoF)
    vi.restoreAllMocks()
    expect(esSesionDeEstaPestana()).toBe(true)
    localStorage.setItem('fsgr.sesion', JSON.stringify(tecnicoF))
    expect(esSesionDeEstaPestana()).toBe(false)
  })
  it('helpers de rol calcados de Sesion.java', () => {
    expect(esSuperTecnico(tecnicoF)).toBe(true)
    expect(esAdmin(tecnicoF)).toBe(false)
    expect(esAdminOSuperTecnico(tecnicoF)).toBe(true)
    const admin = { ...tecnicoF, rol: 'ADMIN', idTec: null }
    expect(esAdmin(admin)).toBe(true)
    expect(esSuperTecnico(admin)).toBe(false)
    const tec = { ...tecnicoF, rol: 'TECNICO' }
    expect(esAdminOSuperTecnico(tec)).toBe(false)
    expect(esAdmin(null)).toBe(false)
  })
})
