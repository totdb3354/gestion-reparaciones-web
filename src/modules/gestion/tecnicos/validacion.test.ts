import { describe, expect, it } from 'vitest'
import type { Usuario } from '@/shared/api/client'
import {
  cuerpoAlta, duplicadosEnVivo, MSG_CAMPOS, MSG_TECNICO_DUPLICADO, MSG_USUARIO_DUPLICADO, rolDe, ROLES,
  validarAlta,
} from './validacion'

const lista: Usuario[] = [
  { idUsu: 11, nombreUsuario: 'usuario-a', rol: 'TECNICO', idTec: 21, nombreTecnico: 'tecnico-a', activo: true },
  { idUsu: 12, nombreUsuario: 'usuario-b', rol: 'SUPERTECNICO', idTec: 22, nombreTecnico: 'tecnico-b', activo: false },
]

/** Calco de RegisterController.registrar (:255-285) y validarNombresEnVivo (:67-81) de hotfix/0.16.3. */
describe('validación del alta de técnicos', () => {
  it('textos exactos del JavaFX, roles del combo en mayúsculas y sin ADMIN', () => {
    expect(MSG_CAMPOS).toBe('Todos los campos son obligatorios.')
    expect(MSG_TECNICO_DUPLICADO).toBe('Ya existe un técnico con ese nombre.')
    expect(MSG_USUARIO_DUPLICADO).toBe('Ese nombre de usuario ya existe.')
    expect(ROLES).toEqual(['TECNICO', 'SUPERTECNICO'])
    expect(rolDe('SUPERTECNICO')).toBe('SUPERTECNICO')
    expect(rolDe('TECNICO')).toBe('TECNICO')
    expect(rolDe('ADMIN')).toBe('TECNICO')
  })
  it('solo exige los dos nombres', () => {
    expect(validarAlta({ nombreTecnico: '', nombreUsuario: 'u', rol: 'TECNICO' })).toBe(MSG_CAMPOS)
    expect(validarAlta({ nombreTecnico: 't', nombreUsuario: '  ', rol: 'TECNICO' })).toBe(MSG_CAMPOS)
    expect(validarAlta({ nombreTecnico: 't', nombreUsuario: 'u', rol: 'TECNICO' })).toBeNull()
  })
  it('el cuerpo no lleva contraseña', () => {
    expect(cuerpoAlta({ nombreTecnico: ' t ', nombreUsuario: ' u ', rol: 'SUPERTECNICO' })).toEqual({ nombreTecnico: 't', nombreUsuario: 'u', rol: 'SUPERTECNICO' })
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
