import { beforeEach, describe, expect, it } from 'vitest'
import { borrarSesion, esAdmin, esAdminOSuperTecnico, esSuperTecnico, guardarSesion, leerSesion, type Sesion } from './storage'

const fati: Sesion = { idUsu: 7, nombreUsuario: 'fati', rol: 'SUPERTECNICO', idTec: 3, token: 'jwt' }

describe('storage de sesión', () => {
  beforeEach(() => sessionStorage.clear())
  it('sin sesión devuelve null', () => {
    expect(leerSesion()).toBeNull()
  })
  it('guarda y lee la sesión en sessionStorage', () => {
    guardarSesion(fati)
    expect(leerSesion()).toEqual(fati)
    expect(sessionStorage.getItem('fsgr.sesion')).toContain('"fati"')
  })
  it('borrar la deja en null', () => {
    guardarSesion(fati)
    borrarSesion()
    expect(leerSesion()).toBeNull()
  })
  it('un valor corrupto se trata como sin sesión', () => {
    sessionStorage.setItem('fsgr.sesion', '{no-json')
    expect(leerSesion()).toBeNull()
  })
  it('un valor parseable pero incompleto o con tipos incorrectos se trata como sin sesión', () => {
    sessionStorage.setItem('fsgr.sesion', JSON.stringify({ ...fati, rol: undefined }))
    expect(leerSesion()).toBeNull()
    sessionStorage.setItem('fsgr.sesion', JSON.stringify({ ...fati, idUsu: '7' }))
    expect(leerSesion()).toBeNull()
  })
  it('helpers de rol calcados de Sesion.java', () => {
    expect(esSuperTecnico(fati)).toBe(true)
    expect(esAdmin(fati)).toBe(false)
    expect(esAdminOSuperTecnico(fati)).toBe(true)
    const admin = { ...fati, rol: 'ADMIN', idTec: null }
    expect(esAdmin(admin)).toBe(true)
    expect(esSuperTecnico(admin)).toBe(false)
    const tec = { ...fati, rol: 'TECNICO' }
    expect(esAdminOSuperTecnico(tec)).toBe(false)
    expect(esAdmin(null)).toBe(false)
  })
})
