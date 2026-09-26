import { describe, expect, it } from 'vitest'
import type { Usuario } from '@/shared/api/client'
import {
  cuerpoAlta, duplicadosEnVivo, MSG_CAMPOS, MSG_NO_COINCIDEN, MSG_PASSWORD_CORTA, MSG_TECNICO_DUPLICADO, MSG_USUARIO_DUPLICADO, rolDe, ROLES,
  validarAlta, type DatosAlta,
} from './validacion'

const datos = (o: Partial<DatosAlta> = {}): DatosAlta => ({
  nombreTecnico: 'tecnico-c', nombreUsuario: 'usuario-c', password: 'secreta1', confirmar: 'secreta1', rol: 'TECNICO', ...o,
})
const lista: Usuario[] = [
  { idUsu: 11, nombreUsuario: 'usuario-a', rol: 'TECNICO', idTec: 21, nombreTecnico: 'tecnico-a', activo: true },
  { idUsu: 12, nombreUsuario: 'usuario-b', rol: 'SUPERTECNICO', idTec: 22, nombreTecnico: 'tecnico-b', activo: false },
]

/** Calco de RegisterController.registrar (:255-285) y validarNombresEnVivo (:67-81) de hotfix/0.16.3. */
describe('validación del alta de técnicos', () => {
  it('textos exactos del JavaFX, roles del combo en mayúsculas y sin ADMIN', () => {
    expect(MSG_CAMPOS).toBe('Todos los campos son obligatorios.')
    expect(MSG_NO_COINCIDEN).toBe('Las contraseñas no coinciden.')
    expect(MSG_PASSWORD_CORTA).toBe('La contraseña debe tener al menos 6 caracteres.')
    expect(MSG_TECNICO_DUPLICADO).toBe('Ya existe un técnico con ese nombre.')
    expect(MSG_USUARIO_DUPLICADO).toBe('Ese nombre de usuario ya existe.')
    expect(ROLES).toEqual(['TECNICO', 'SUPERTECNICO'])
    expect(rolDe('SUPERTECNICO')).toBe('SUPERTECNICO')
    expect(rolDe('TECNICO')).toBe('TECNICO')
    expect(rolDe('ADMIN')).toBe('TECNICO')
  })
  it('vacíos (nombres con trim, contraseña sin trim) → "Todos los campos son obligatorios.", antes que el resto', () => {
    expect(validarAlta(datos({ nombreTecnico: '' }))).toBe(MSG_CAMPOS)
    expect(validarAlta(datos({ nombreTecnico: '   ' }))).toBe(MSG_CAMPOS)
    expect(validarAlta(datos({ nombreUsuario: ' ' }))).toBe(MSG_CAMPOS)
    expect(validarAlta(datos({ password: '', confirmar: '' }))).toBe(MSG_CAMPOS)
    expect(validarAlta(datos({ nombreTecnico: '', password: 'abc', confirmar: 'xyz' }))).toBe(MSG_CAMPOS)
  })
  it('la confirmación vacía no cuenta como campo obligatorio: cae en "no coinciden"', () => {
    expect(validarAlta(datos({ confirmar: '' }))).toBe(MSG_NO_COINCIDEN)
  })
  it('"no coinciden" va antes que "menos de 6" y compara sin trim', () => {
    expect(validarAlta(datos({ password: 'abc', confirmar: 'abd' }))).toBe(MSG_NO_COINCIDEN)
    expect(validarAlta(datos({ password: 'secreta1', confirmar: 'secreta1 ' }))).toBe(MSG_NO_COINCIDEN)
  })
  it('menos de 6 caracteres, contando los espacios; con todo bien → null', () => {
    expect(validarAlta(datos({ password: '12345', confirmar: '12345' }))).toBe(MSG_PASSWORD_CORTA)
    expect(validarAlta(datos({ password: '   ', confirmar: '   ' }))).toBe(MSG_PASSWORD_CORTA)
    expect(validarAlta(datos({ password: '12345 ', confirmar: '12345 ' }))).toBeNull()
    expect(validarAlta(datos())).toBeNull()
  })
  it('cuerpoAlta recorta los dos nombres, deja contraseña y rol tal cual y no manda la confirmación', () => {
    expect(cuerpoAlta(datos({ nombreTecnico: '  tecnico-c ', nombreUsuario: ' usuario-c  ', password: ' secreta1 ', confirmar: ' secreta1 ', rol: 'SUPERTECNICO' }))).toEqual({
      nombreTecnico: 'tecnico-c', nombreUsuario: 'usuario-c', password: ' secreta1 ', rol: 'SUPERTECNICO',
    })
  })
  it('duplicadosEnVivo: sin mayúsculas y con trim a los dos lados, cada campo contra su columna; vacío o ADMIN → null', () => {
    expect(duplicadosEnVivo(lista, '', '')).toEqual({ tecnico: null, usuario: null })
    expect(duplicadosEnVivo(lista, '   ', '  ')).toEqual({ tecnico: null, usuario: null })
    expect(duplicadosEnVivo(lista, ' TECNICO-A ', '')).toEqual({ tecnico: MSG_TECNICO_DUPLICADO, usuario: null })
    expect(duplicadosEnVivo(lista, '', 'Usuario-B')).toEqual({ tecnico: null, usuario: MSG_USUARIO_DUPLICADO })
    expect(duplicadosEnVivo(lista, 'tecnico-b', 'usuario-a')).toEqual({ tecnico: MSG_TECNICO_DUPLICADO, usuario: MSG_USUARIO_DUPLICADO })
    // Un nombre de usuario igual a un nombre de técnico no cuenta: cada campo se compara con su propia columna.
    expect(duplicadosEnVivo(lista, 'usuario-a', 'tecnico-a')).toEqual({ tecnico: null, usuario: null })
    // Los nombres de la lista también se recortan (u.getNombreTecnico().trim()).
    expect(duplicadosEnVivo([{ ...lista[0], nombreTecnico: ' tecnico-z ' }], 'tecnico-z', '').tecnico).toBe(MSG_TECNICO_DUPLICADO)
    // La lista no trae ADMIN: "admin" pasa en vivo y lo frena el 409 del servidor (calco).
    expect(duplicadosEnVivo(lista, '', 'admin')).toEqual({ tecnico: null, usuario: null })
  })
})
