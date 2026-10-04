import { describe, expect, it } from 'vitest'
import { MSG_IGUAL_ACTUAL, MSG_NUEVAS_NO_COINCIDEN, MSG_PASSWORD_CORTA, MSG_PASSWORD_LARGA, MSG_RELLENA, validarCambioPassword } from './validacion'

describe('validarCambioPassword (regla 0.9.2)', () => {
  it('campos vacíos primero', () => {
    expect(validarCambioPassword('', 'nueva-larga-1', 'nueva-larga-1')).toBe(MSG_RELLENA)
    expect(validarCambioPassword('actual', '', '')).toBe(MSG_RELLENA)
  })
  it('menos de 10 caracteres', () => {
    expect(validarCambioPassword('actual', '123456789', '123456789')).toBe('La contraseña debe tener al menos 10 caracteres.')
    expect(MSG_PASSWORD_CORTA).toBe('La contraseña debe tener al menos 10 caracteres.')
  })
  it('más de 64 caracteres o más de 72 bytes', () => {
    expect(validarCambioPassword('actual', 'a'.repeat(65), 'a'.repeat(65))).toBe('La contraseña es demasiado larga (máximo 64 caracteres).')
    const conTildes = 'ñ'.repeat(37) + 'abc'
    expect(validarCambioPassword('actual', conTildes, conTildes)).toBe(MSG_PASSWORD_LARGA)
    expect(validarCambioPassword('actual', 'a'.repeat(64), 'a'.repeat(64))).toBeNull()
  })
  it('distinta de la actual', () => {
    expect(validarCambioPassword('misma-de-antes', 'misma-de-antes', 'misma-de-antes')).toBe('La nueva contraseña tiene que ser distinta de la actual.')
    expect(MSG_IGUAL_ACTUAL).toBe('La nueva contraseña tiene que ser distinta de la actual.')
  })
  it('la repetida tiene que coincidir, y es la última comprobación', () => {
    expect(validarCambioPassword('actual', 'nueva-larga-1', 'nueva-larga-2')).toBe(MSG_NUEVAS_NO_COINCIDEN)
    expect(validarCambioPassword('actual', '123', '456')).toBe(MSG_PASSWORD_CORTA)
  })
  it('sin trim: diez espacios valen como 10 caracteres', () => {
    expect(validarCambioPassword('actual', ' '.repeat(10), ' '.repeat(10))).toBeNull()
  })
})
