import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dispararSesionExpirada, onSesionExpirada, rearmarSesionExpirada } from './expiracion'
import { borrarSesion, guardarSesion } from './storage'

describe('sesión expirada', () => {
  beforeEach(() => {
    sessionStorage.clear()
    rearmarSesionExpirada()
  })
  it('sin sesión no dispara (p. ej. 401 del propio login)', () => {
    const h = vi.fn()
    onSesionExpirada(h)
    dispararSesionExpirada()
    expect(h).not.toHaveBeenCalled()
  })
  it('con sesión dispara una sola vez aunque fallen varias peticiones a la vez', () => {
    const h = vi.fn()
    onSesionExpirada(h)
    guardarSesion({ idUsu: 1, nombreUsuario: 'a', rol: 'TECNICO', idTec: 1, token: 't' })
    dispararSesionExpirada()
    dispararSesionExpirada()
    expect(h).toHaveBeenCalledTimes(1)
  })
  it('tras rearmar (nuevo login) vuelve a disparar', () => {
    const h = vi.fn()
    onSesionExpirada(h)
    guardarSesion({ idUsu: 1, nombreUsuario: 'a', rol: 'TECNICO', idTec: 1, token: 't' })
    dispararSesionExpirada()
    borrarSesion()
    rearmarSesionExpirada()
    guardarSesion({ idUsu: 1, nombreUsuario: 'a', rol: 'TECNICO', idTec: 1, token: 't2' })
    dispararSesionExpirada()
    expect(h).toHaveBeenCalledTimes(2)
  })
})
