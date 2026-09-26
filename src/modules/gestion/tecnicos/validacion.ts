import type { Usuario } from '@/shared/api/client'

/** Opciones del combo de rol (RegisterController :53): literales en mayúsculas, sin ADMIN; TECNICO por defecto. */
export const ROLES = ['TECNICO', 'SUPERTECNICO'] as const
export type Rol = (typeof ROLES)[number]

/** El ComboNavy devuelve un string: cualquier cosa que no sea SUPERTECNICO es el rol por defecto. */
export function rolDe(valor: string): Rol {
  return valor === 'SUPERTECNICO' ? 'SUPERTECNICO' : 'TECNICO'
}

export type DatosAlta = { nombreTecnico: string; nombreUsuario: string; password: string; confirmar: string; rol: Rol }
export type CuerpoAlta = { nombreTecnico: string; nombreUsuario: string; password: string; rol: Rol }

export const MSG_CAMPOS = 'Todos los campos son obligatorios.'
export const MSG_NO_COINCIDEN = 'Las contraseñas no coinciden.'
export const MSG_PASSWORD_CORTA = 'La contraseña debe tener al menos 6 caracteres.'
export const MSG_TECNICO_DUPLICADO = 'Ya existe un técnico con ese nombre.'
export const MSG_USUARIO_DUPLICADO = 'Ese nombre de usuario ya existe.'

/** Calco de RegisterController.registrar (:257-275): nombres con trim, contraseña y confirmación sin trim; para en el primer
 *  fallo. La confirmación vacía no cuenta como obligatoria: cae en "no coinciden". */
export function validarAlta(d: DatosAlta): string | null {
  if (d.nombreTecnico.trim() === '' || d.nombreUsuario.trim() === '' || d.password === '') return MSG_CAMPOS
  if (d.password !== d.confirmar) return MSG_NO_COINCIDEN
  if (d.password.length < 6) return MSG_PASSWORD_CORTA
  return null
}

/** Cuerpo de POST /api/usuarios/tecnicos con los nombres recortados (el servidor también recorta desde la Task 1). */
export function cuerpoAlta(d: DatosAlta): CuerpoAlta {
  return { nombreTecnico: d.nombreTecnico.trim(), nombreUsuario: d.nombreUsuario.trim(), password: d.password, rol: d.rol }
}

const normalizar = (s: string) => s.trim().toLowerCase()

/** Calco de validarNombresEnVivo (:67-81): cada nombre contra su columna de la lista cargada, sin mayúsculas y con trim a
 *  los dos lados; un campo vacío no avisa. La lista no trae ADMIN, así que su nombre pasa aquí y lo frena el 409. */
export function duplicadosEnVivo(usuarios: Usuario[], nombreTecnico: string, nombreUsuario: string): { tecnico: string | null; usuario: string | null } {
  const tecnico = normalizar(nombreTecnico)
  const usuario = normalizar(nombreUsuario)
  const tecnicoDup = tecnico !== '' && usuarios.some((u) => normalizar(u.nombreTecnico) === tecnico)
  const usuarioDup = usuario !== '' && usuarios.some((u) => normalizar(u.nombreUsuario) === usuario)
  return { tecnico: tecnicoDup ? MSG_TECNICO_DUPLICADO : null, usuario: usuarioDup ? MSG_USUARIO_DUPLICADO : null }
}
