import { beforeEach, describe, expect, it } from 'vitest'
import { borrarSesion, esAdmin, esAdminOSuperTecnico, esSuperTecnico, guardarSesion, leerSesion, type Sesion } from './storage'

const tecnicoF: Sesion = { idUsu: 7, nombreUsuario: 'tecnico_f', rol: 'SUPERTECNICO', idTec: 3, token: 'jwt' }

describe('storage de sesión', () => {
  beforeEach(() => sessionStorage.clear())
  it('sin sesión devuelve null', () => {
    expect(leerSesion()).toBeNull()
  })
  it('guarda y lee la sesión en sessionStorage', () => {
    guardarSesion(tecnicoF)
    expect(leerSesion()).toEqual(tecnicoF)
    expect(sessionStorage.getItem('fsgr.sesion')).toContain('"tecnico_f"')
  })
  it('borrar la deja en null', () => {
    guardarSesion(tecnicoF)
    borrarSesion()
    expect(leerSesion()).toBeNull()
  })
  it('un valor corrupto se trata como sin sesión', () => {
    sessionStorage.setItem('fsgr.sesion', '{no-json')
    expect(leerSesion()).toBeNull()
  })
  it('un valor parseable pero incompleto o con tipos incorrectos se trata como sin sesión', () => {
    sessionStorage.setItem('fsgr.sesion', JSON.stringify({ ...tecnicoF, rol: undefined }))
    expect(leerSesion()).toBeNull()
    sessionStorage.setItem('fsgr.sesion', JSON.stringify({ ...tecnicoF, idUsu: '7' }))
    expect(leerSesion()).toBeNull()
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
