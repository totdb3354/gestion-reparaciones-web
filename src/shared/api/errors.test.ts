import { describe, expect, it } from 'vitest'
import {
  ConexionError, MSG_SIN_CONEXION, NoEncontradoError, PermisoError, ReglaNegocioError, SesionExpiradaError,
  StaleDataError, clasificar, extraerMensaje, mensajeSinConexion,
} from './errors'

describe('clasificar (port de ApiClient.clasificar)', () => {
  it('401 → sesión expirada con el texto fijo', () => {
    const e = clasificar(401, null)
    expect(e).toBeInstanceOf(SesionExpiradaError)
    expect(e.message).toBe('Sesión expirada. Vuelve a iniciar sesión.')
  })
  it('403 → sin permisos', () => {
    expect(clasificar(403, 'lo que sea')).toBeInstanceOf(PermisoError)
    expect(clasificar(403, null).message).toBe('No tienes permisos para realizar esta acción.')
  })
  it('404 → recurso no encontrado', () => {
    expect(clasificar(404, null)).toBeInstanceOf(NoEncontradoError)
    expect(clasificar(404, null).message).toBe('Recurso no encontrado.')
  })
  it('409 → StaleData con el mensaje del servidor', () => {
    const e = clasificar(409, 'El cliente tiene teléfonos asociados')
    expect(e).toBeInstanceOf(StaleDataError)
    expect(e.message).toBe('El cliente tiene teléfonos asociados')
  })
  it('422 conserva el mensaje de negocio del servidor', () => {
    expect(clasificar(422, 'Contraseña actual incorrecta.').message).toBe('Contraseña actual incorrecta.')
    expect(clasificar(422, 'x')).toBeInstanceOf(ReglaNegocioError)
  })
  it('422 sin mensaje usa un texto genérico', () => {
    expect(clasificar(422, null).message).toBe('El servidor ha rechazado la operación.')
  })
  it('5xx → error de conexión con el detalle HTTP para el diálogo', () => {
    expect(clasificar(500, null)).toBeInstanceOf(ConexionError)
    const e = clasificar(503, null) as ConexionError
    expect(e).toBeInstanceOf(ConexionError)
    // El mensaje sigue siendo el del banner; el detalle solo lo usa el diálogo de la acción.
    expect(e.message).toBe(MSG_SIN_CONEXION)
    expect(e.detalle).toBe('HTTP 503')
  })
  it('otros códigos → ApiError genérico con el mensaje o el código', () => {
    expect(clasificar(400, 'Body inválido').message).toBe('Body inválido')
    expect(clasificar(418, null).message).toBe('Error del servidor (418).')
  })
})

describe('extraerMensaje', () => {
  it('lee message de un JSON de Spring', () => {
    expect(extraerMensaje({ message: 'hola', status: 422 })).toBe('hola')
  })
  it('devuelve null si no hay message', () => {
    expect(extraerMensaje({})).toBeNull()
    expect(extraerMensaje(null)).toBeNull()
    expect(extraerMensaje('texto plano')).toBe('texto plano')
    expect(extraerMensaje('')).toBeNull()
  })
})

describe('mensajeSinConexion', () => {
  it('compone el texto del diálogo del JavaFX con el detalle', () => {
    const e = new ConexionError(503, MSG_SIN_CONEXION, 'HTTP 503')
    expect(mensajeSinConexion(e)).toBe('Sin conexión con el servidor: HTTP 503')
  })
  it('sin detalle (caso defensivo) usa el mensaje propio del error, más concreto que el genérico', () => {
    const e = new ConexionError(0, 'Respuesta vacía del servidor.')
    expect(mensajeSinConexion(e)).toBe('Respuesta vacía del servidor.')
  })
  it('sin detalle ni mensaje cae en el texto genérico', () => {
    expect(mensajeSinConexion(new ConexionError(0, ''))).toBe(MSG_SIN_CONEXION)
  })
})
