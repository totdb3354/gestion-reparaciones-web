import { describe, expect, it } from 'vitest'
import { glass, normal, resumen } from '../test/fabrica'
import { ocultarContadorAsignados } from './entregaGlass'

const UTC_0842 = '2026-08-28T08:42:00'

/**
 * Puerto de `contadorAsignadosSeOcultaSoloCuandoUnaPildoraCuentaAlSegundo` (EntregaGlassTest del cliente JavaFX).
 * Va en su propio fichero a propósito: `entregaGlass.test.ts` es la suite del sub-proyecto 1, ya en producción,
 * y este sub-proyecto solo añade al módulo compartido, no toca lo que ya había.
 */
describe('ocultarContadorAsignados (calco de EntregaGlass)', () => {
  it('se oculta solo con exactamente 2 y una píldora que ya cuenta al segundo', () => {
    expect(ocultarContadorAsignados(normal(true, null), 2)).toBe(true) // verde: "Glass: X" pendiente
    expect(ocultarContadorAsignados(normal(true, UTC_0842), 2)).toBe(true) // índigo: ya entregada
    expect(ocultarContadorAsignados({ ...glass(null), normalAbierta: true }, 2)).toBe(true) // azul: "Rep: X"
    expect(ocultarContadorAsignados(normal(true, null), 3)).toBe(false) // 3+: el contador convive con la píldora
    expect(ocultarContadorAsignados(normal(false, null), 2)).toBe(false) // sin glass
    expect(ocultarContadorAsignados(glass(UTC_0842), 2)).toBe(false) // AG sin normal abierta
    expect(ocultarContadorAsignados(null, 2)).toBe(false)
  })

  it('el pulido nunca oculta el contador (el `default` del switch)', () => {
    expect(ocultarContadorAsignados(resumen({ idRep: 'AP20260922_1' }), 2)).toBe(false)
  })
})
