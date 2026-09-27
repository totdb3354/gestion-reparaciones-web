import { describe, expect, it } from 'vitest'
import { ApiError, ConexionError, NoEncontradoError, ReglaNegocioError, SesionDeOtraPestanaError, StaleDataError } from '@/shared/api/errors'
import { mensajeInline } from './errores'

/** Spec 6, G9 y §8: la línea inline enseña el message del servidor en los códigos que cada acción espera y el texto fijo
 *  del JavaFX en el resto. */
describe('mensajeInline', () => {
  it('409 y 422 → el message del servidor si la acción los espera', () => {
    expect(mensajeInline(new StaleDataError(409, 'Ese nombre de usuario ya existe.'), 'fijo', [409, 422])).toBe('Ese nombre de usuario ya existe.')
    expect(mensajeInline(new ReglaNegocioError(422, 'Rol no permitido.'), 'fijo', [409, 422])).toBe('Rol no permitido.')
  })
  it('404 → "Técnico no encontrado." (clasificar descarta el message de los 404)', () => {
    expect(mensajeInline(new NoEncontradoError(404, 'Recurso no encontrado.'), 'fijo', [404])).toBe('Técnico no encontrado.')
  })
  it('petición que no salió porque la sesión guardada es de otra pestaña → ninguna línea (null)', () => {
    expect(mensajeInline(new SesionDeOtraPestanaError(), 'fijo', [404, 409, 422])).toBeNull()
  })
  it('un código que la acción no espera → el texto fijo', () => {
    expect(mensajeInline(new NoEncontradoError(404, 'Recurso no encontrado.'), 'fijo', [409, 422])).toBe('fijo')
    expect(mensajeInline(new StaleDataError(409, 'x'), 'fijo', [404])).toBe('fijo')
    // Un 503 con mensaje es ReglaNegocioError (4b) pero no es un 422: texto fijo.
    expect(mensajeInline(new ReglaNegocioError(503, 'x'), 'fijo', [422])).toBe('fijo')
  })
  it('400, conexión y cualquier otra cosa → el texto fijo', () => {
    expect(mensajeInline(new ApiError(400, 'Rol no permitido: ADMIN'), 'fijo', [404, 409, 422])).toBe('fijo')
    expect(mensajeInline(new ConexionError(503, 'Sin conexión con el servidor.', 'HTTP 503'), 'fijo', [404, 409, 422])).toBe('fijo')
    expect(mensajeInline(new Error('boom'), 'fijo', [404, 409, 422])).toBe('fijo')
    expect(mensajeInline('boom', 'fijo', [404, 409, 422])).toBe('fijo')
  })
})
