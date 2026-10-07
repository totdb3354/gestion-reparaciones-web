import type { MotivoExpiracion } from '@/shared/session/expiracion'

export const MSG_SESION_EXPIRADA_UI = 'Tu sesión ha expirado. Inicia sesión de nuevo.'
export const MSG_SESION_INACTIVIDAD_UI = 'Se cerró la sesión tras dos horas sin uso. Inicia sesión de nuevo.'

/** Mensaje del login cuando la aplicación cierra la sesión (spec 0.9.5 §5). */
export function mensajeSesionCerrada(motivo?: MotivoExpiracion): string {
  return motivo === 'inactividad' ? MSG_SESION_INACTIVIDAD_UI : MSG_SESION_EXPIRADA_UI
}
