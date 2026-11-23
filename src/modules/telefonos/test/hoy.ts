import { afterEach, beforeEach, vi } from 'vitest'

/** El «hoy» de los tests de pantalla de Pedidos: lunes 23/11/2026, 11:00 en Madrid. */
export const HOY_PEDIDOS = new Date('2026-11-23T10:00:00Z')

/** Pone la fecha (que sigue corriendo; los temporizadores siguen siendo reales) en cada test del fichero. Desde la 0.9.38 la tabla enseña solo las
 *  filas del periodo, que se cuenta desde hoy, y las filas de prueba tienen fechas fijas: sin esto, los tests dejarían de ver sus
 *  filas en cuanto pasara un mes. */
export function congelarHoy(ahora: Date = HOY_PEDIDOS): void {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: ahora, shouldAdvanceTime: true }) })
  afterEach(() => { vi.useRealTimers() })
}
