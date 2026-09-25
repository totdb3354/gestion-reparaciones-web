import { describe, expect, it } from 'vitest'
import { ConexionError, PermisoError, ReglaNegocioError, SesionExpiradaError, StaleDataError } from '@/shared/api/errors'
import { mensajeErrorGuardado } from './errores'

describe('mensajeErrorGuardado', () => {
  it('lo que ya avisa un mecanismo global (conexión, sesión) no va a la línea de error', () => {
    expect(mensajeErrorGuardado(new ConexionError(503, 'Sin conexión con el servidor.', 'HTTP 503'))).toBeNull()
    expect(mensajeErrorGuardado(new SesionExpiradaError(401, 'x'))).toBeNull()
  })
  it('409: el mensaje del servidor, o el propio de la vista si se pasa staleData', () => {
    expect(mensajeErrorGuardado(new StaleDataError(409, 'El pedido ya no está pendiente'))).toBe('El pedido ya no está pendiente')
    expect(mensajeErrorGuardado(new StaleDataError(409, 'Dato modificado por otro usuario'), { staleData: 'Modificado.' })).toBe('Modificado.')
  })
  it('422: el mensaje del servidor tal cual', () => {
    expect(mensajeErrorGuardado(new ReglaNegocioError(422, 'Línea 1: el proveedor está desactivado.'))).toBe('Línea 1: el proveedor está desactivado.')
  })
  it('cualquier otro: "Error al guardar: " + mensaje (FC :554)', () => {
    expect(mensajeErrorGuardado(new PermisoError(403, 'No tienes permisos para realizar esta acción.'))).toBe('Error al guardar: No tienes permisos para realizar esta acción.')
  })
})
