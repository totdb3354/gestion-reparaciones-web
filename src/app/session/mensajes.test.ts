import { describe, expect, it } from 'vitest'
import { mensajeSesionCerrada, MSG_SESION_EXPIRADA_UI, MSG_SESION_INACTIVIDAD_UI } from './mensajes'

describe('mensaje del login al cerrar la sesión', () => {
  it('por inactividad, el propio; en cualquier otro caso, el de sesión expirada', () => {
    expect(mensajeSesionCerrada('inactividad')).toBe('Se cerró la sesión tras dos horas sin uso. Inicia sesión de nuevo.')
    expect(MSG_SESION_INACTIVIDAD_UI).toBe('Se cerró la sesión tras dos horas sin uso. Inicia sesión de nuevo.')
    expect(mensajeSesionCerrada()).toBe(MSG_SESION_EXPIRADA_UI)
  })
})
