import { describe, expect, it } from 'vitest'
import { MSG_EXITO, MSG_NUEVAS_NO_COINCIDEN, MSG_PASSWORD_CORTA, MSG_RELLENA, TITULO_EXITO, validarCambioPassword } from './validacion'

describe('textos (CambiarPasswordController :84-105)', () => {
  it('son exactos', () => {
    expect(MSG_RELLENA).toBe('Rellena todos los campos.')
    expect(MSG_PASSWORD_CORTA).toBe('La contraseña debe tener al menos 6 caracteres.')
    expect(MSG_NUEVAS_NO_COINCIDEN).toBe('Las contraseñas nuevas no coinciden.')
    expect(TITULO_EXITO).toBe('Información')
    expect(MSG_EXITO).toBe('Contraseña cambiada correctamente.')
  })
})

describe('validarCambioPassword (orden: vacíos → < 6 → no coinciden; sin trim)', () => {
  it.each([
    ['', 'nueva123', 'nueva123'],
    ['secreta1', '', 'nueva123'],
    ['secreta1', 'nueva123', ''],
    ['', '', ''],
  ])('algún campo vacío ("%s", "%s", "%s") → "Rellena todos los campos."', (actual, nueva, confirmar) => {
    expect(validarCambioPassword(actual, nueva, confirmar)).toBe(MSG_RELLENA)
  })
  it('vacío gana a corta y a no coinciden', () => {
    expect(validarCambioPassword('', 'abc', 'xyz')).toBe(MSG_RELLENA)
  })
  it('nueva de menos de 6 caracteres → corta, antes que no coinciden', () => {
    expect(validarCambioPassword('secreta1', 'nue12', 'nue12')).toBe(MSG_PASSWORD_CORTA)
    expect(validarCambioPassword('secreta1', 'abc', 'xyz')).toBe(MSG_PASSWORD_CORTA)
  })
  it('nueva distinta de la confirmación (distingue mayúsculas) → no coinciden', () => {
    expect(validarCambioPassword('secreta1', 'nueva123', 'NUEVA123')).toBe(MSG_NUEVAS_NO_COINCIDEN)
  })
  it('sin trim: los espacios cuentan como relleno y como caracteres', () => {
    expect(validarCambioPassword('   ', '      ', '      ')).toBeNull()
    expect(validarCambioPassword('secreta1', ' nue1 ', ' nue1 ')).toBeNull()
    expect(validarCambioPassword('secreta1', 'nue12 ', 'nue12')).toBe(MSG_NUEVAS_NO_COINCIDEN)
  })
  it('6 caracteres exactos e iguales → válido', () => {
    expect(validarCambioPassword('secreta1', 'nueva1', 'nueva1')).toBeNull()
  })
})
