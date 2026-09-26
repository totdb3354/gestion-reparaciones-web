/** Textos fijos de la página de técnicos (RegisterController de hotfix/0.16.3). */
export const MSG_ERROR_CARGA = 'Error al cargar los usuarios.'
export const MSG_ERROR_REGISTRO = 'Error al registrar. Inténtalo de nuevo.'
export const MSG_ERROR_ESTADO = 'Error al cambiar el estado del técnico.'
export const MSG_ERROR_ELIMINAR = 'Error al eliminar el técnico.'
export const MSG_ERROR_COMPROBAR = 'Error al comprobar las reparaciones del técnico.'
/** 404 del servidor (ValidacionUsuarios.MSG_NO_ENCONTRADO): clasificar() no conserva el mensaje de un 404. */
export const MSG_TECNICO_NO_ENCONTRADO = 'Técnico no encontrado.'

/** Alert INFORMATION (:223-228): cabecera y contenido del JavaFX unidos con saltos de línea (el diálogo usa whitespace-pre-line). */
export const TITULO_NO_ELIMINAR = 'No se puede eliminar'
export const textoNoEliminar = (n: string) =>
  `"${n}" tiene reparaciones asociadas.\nNo es posible eliminarlo para conservar el historial.\nPuedes desactivarlo para bloquear su acceso.`

/** Alert CONFIRMATION (:231-234), ahora ConfirmDialog con botón "Eliminar" (spec 6, G9). */
export const TITULO_ELIMINAR = 'Eliminar técnico'
export const textoEliminar = (n: string) => `¿Eliminar a "${n}" definitivamente?\nSe borrarán sus credenciales de acceso y su registro de técnico.`

/** Placeholder por defecto del TableView (RegisterView.fxml no define uno); se confirma con la captura (spec 6, §12). */
export const TEXTO_VACIO_TABLA = 'No hay contenido en la tabla'

/** Tooltip del candado (:179); la papelera no tiene tooltip. */
export const TOOLTIP_DESACTIVAR = 'Desactivar acceso'
export const TOOLTIP_ACTIVAR = 'Activar acceso'
