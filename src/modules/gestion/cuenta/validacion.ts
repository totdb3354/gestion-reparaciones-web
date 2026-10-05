/** Textos de CambiarPasswordController (`hotfix/0.16.3`, :84-95) y del Alert de éxito (:100-105), con la regla de la 0.9.2
 *  (mismos textos que PoliticaPassword del servidor, que es quien decide al guardar). */
export const MSG_RELLENA = 'Rellena todos los campos.'
export const MSG_PASSWORD_CORTA = 'La contraseña debe tener al menos 10 caracteres.'
export const MSG_PASSWORD_LARGA = 'La contraseña es demasiado larga (máximo 64 caracteres).'
export const MSG_IGUAL_ACTUAL = 'La nueva contraseña tiene que ser distinta de la actual.'
export const MSG_NUEVAS_NO_COINCIDEN = 'Las contraseñas nuevas no coinciden.'
/** Título por defecto del Alert INFORMATION con locale español; fijado con la captura del JavaFX el 2026-09-26. */
export const TITULO_EXITO = 'Mensaje'
export const MSG_EXITO = 'Contraseña cambiada correctamente.'

export const MIN_CARACTERES = 10
export const MAX_CARACTERES = 64
/** BCrypt solo usa los 72 primeros bytes. */
export const MAX_BYTES = 72

/** Sin trim ("   " cuenta como relleno), longitud en unidades UTF-16 como `String.length()` del servidor, comparación
 *  exacta. Orden: rellenos → 10 → 64/72 bytes → distinta de la actual → repetida igual. Para en el primer fallo; null =
 *  válido. La nota (la barra) la pone el servidor; esta validación solo evita viajes inútiles. */
export function validarCambioPassword(actual: string, nueva: string, confirmar: string): string | null {
  if (actual === '' || nueva === '' || confirmar === '') return MSG_RELLENA
  if (nueva.length < MIN_CARACTERES) return MSG_PASSWORD_CORTA
  if (nueva.length > MAX_CARACTERES || new TextEncoder().encode(nueva).length > MAX_BYTES) return MSG_PASSWORD_LARGA
  if (nueva === actual) return MSG_IGUAL_ACTUAL
  if (nueva !== confirmar) return MSG_NUEVAS_NO_COINCIDEN
  return null
}
