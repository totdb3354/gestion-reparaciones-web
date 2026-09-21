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
  it('devuelve un unsubscribe que retira su handler', () => {
    const h = vi.fn()
    const quitar = onSesionExpirada(h)
    guardarSesion({ idUsu: 1, nombreUsuario: 'a', rol: 'TECNICO', idTec: 1, token: 't' })
    quitar()
    dispararSesionExpirada()
    expect(h).not.toHaveBeenCalled()
  })
  it('el unsubscribe de un handler ya sustituido no retira el actual', () => {
    const viejo = vi.fn()
    const nuevo = vi.fn()
    const quitarViejo = onSesionExpirada(viejo)
    onSesionExpirada(nuevo)
    quitarViejo()
    guardarSesion({ idUsu: 1, nombreUsuario: 'a', rol: 'TECNICO', idTec: 1, token: 't' })
    dispararSesionExpirada()
    expect(viejo).not.toHaveBeenCalled()
    expect(nuevo).toHaveBeenCalledTimes(1)
  })
  it('sin handler el disparo no se gasta: uno registrado después todavía lo recibe', () => {
    const h = vi.fn()
    onSesionExpirada(h)()
    guardarSesion({ idUsu: 1, nombreUsuario: 'a', rol: 'TECNICO', idTec: 1, token: 't' })
    dispararSesionExpirada()
    const otro = vi.fn()
    onSesionExpirada(otro)
    dispararSesionExpirada()
    expect(otro).toHaveBeenCalledTimes(1)
  })
})
