import { describe, expect, it } from 'vitest'
import { RUTA_VOLVER_POR_DEFECTO, rutaVolverA } from './navegacion'

/** "Cerrar" de técnicos y logs vuelve a la vista desde la que el menú abrió la página (spec 6, §6.1 Pie). */
describe('rutaVolverA', () => {
  it('devuelve el volverA del state cuando es una ruta de la app', () => {
    expect(rutaVolverA({ volverA: '/stock/pedidos' })).toBe('/stock/pedidos')
    expect(rutaVolverA({ volverA: '/reparaciones/historial', otra: 1 })).toBe('/reparaciones/historial')
  })
  it('sin state, sin volverA o con algo que no es una ruta interna → /reparaciones', () => {
    expect(RUTA_VOLVER_POR_DEFECTO).toBe('/reparaciones')
    for (const state of [null, undefined, 'x', 7, {}, { volverA: 3 }, { volverA: '' }, { volverA: 'stock' }, { volverA: 'https://ejemplo.invalid/' }, { volverA: '//ejemplo.invalid' }]) {
      expect(rutaVolverA(state)).toBe('/reparaciones')
    }
  })
})
