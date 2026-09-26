/** Textos de CambiarPasswordController (`hotfix/0.16.3`, :84-95) y del Alert de éxito (:100-105). */
export const MSG_RELLENA = 'Rellena todos los campos.'
export const MSG_PASSWORD_CORTA = 'La contraseña debe tener al menos 6 caracteres.'
export const MSG_NUEVAS_NO_COINCIDEN = 'Las contraseñas nuevas no coinciden.'
/** Título por defecto del Alert INFORMATION con locale español; fijado con la captura del JavaFX el 2026-09-26. */
export const TITULO_EXITO = 'Mensaje'
export const MSG_EXITO = 'Contraseña cambiada correctamente.'

/** Calco de `guardar` (:84-95): sin trim ("   " cuenta como relleno), longitud en unidades UTF-16 como `String.length()`,
 *  comparación exacta. Para en el primer fallo; null = válido. La confirmación no viaja al servidor. */
export function validarCambioPassword(actual: string, nueva: string, confirmar: string): string | null {
  if (actual === '' || nueva === '' || confirmar === '') return MSG_RELLENA
  if (nueva.length < 6) return MSG_PASSWORD_CORTA
  if (nueva !== confirmar) return MSG_NUEVAS_NO_COINCIDEN
  return null
}
