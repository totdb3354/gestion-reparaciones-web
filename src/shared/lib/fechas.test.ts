import { describe, expect, it } from 'vitest'
import { FMT_FECHA_PEDIDO, fechaLocal, formatear, horaLocal, hoyMadrid, marcaFichero, parsearUtc } from './fechas'

describe('fechas (UTC del servidor → Madrid, calco de FechaUtils)', () => {
  it('formatea en hora de Madrid con los patrones del JavaFX', () => {
    expect(formatear('2026-08-28T08:42:00', 'dd/MM HH:mm')).toBe('28/08 10:42')          // CEST
    expect(formatear('2026-01-15T10:00:00', 'yyyy/MM/dd HH:mm')).toBe('2026/01/15 11:00') // CET
    expect(formatear('2026-08-28T08:42:00', 'yyyy/MM/dd')).toBe('2026/08/28')
    expect(formatear('2026-08-28T08:42:00', 'dd/MM')).toBe('28/08')
    expect(formatear('2026-08-28T08:42:00', 'HH:mm')).toBe('10:42')
    expect(formatear('2026-08-28T08:42:00', 'dd/MM/yyyy HH:mm')).toBe('28/08/2026 10:42')
    expect(formatear('2026-08-28T08:42:00', 'dd/MM/yyyy')).toBe('28/08/2026')
  })
  it('acepta ISO con zona y devuelve vacío con nulos o basura', () => {
    expect(formatear('2026-08-28T08:42:00Z', 'HH:mm')).toBe('10:42')
    expect(formatear(null, 'HH:mm')).toBe('')
    expect(formatear(undefined, 'HH:mm')).toBe('')
    expect(formatear('no-es-fecha', 'HH:mm')).toBe('')
    expect(parsearUtc('2026-08-28T22:30:00')?.toISOString()).toBe('2026-08-28T22:30:00.000Z')
  })
  it('fechaLocal cambia de día con la zona (22:30 UTC = 00:30 del día siguiente en Madrid)', () => {
    expect(fechaLocal('2026-08-28T22:30:00')).toBe('2026-08-29')
    expect(fechaLocal(null)).toBeNull()
  })
  it('hoyMadrid, horaLocal y marcaFichero', () => {
    expect(hoyMadrid(new Date(Date.UTC(2026, 7, 28, 22, 30)))).toBe('2026-08-29')
    const local = new Date(2026, 8, 16, 9, 5)
    expect(horaLocal(local)).toBe('09:05')
    expect(marcaFichero(local)).toBe('2026-09-16_09-05')
  })
  it('patrón de la columna Pedido (dd/MM/yy HH:mm, StockController FMT :153): dos cifras del año, sin romper yyyy', () => {
    expect(FMT_FECHA_PEDIDO).toBe('dd/MM/yy HH:mm')
    expect(formatear('2026-08-28T08:42:00', FMT_FECHA_PEDIDO)).toBe('28/08/26 10:42')
    // 23:30 UTC del 31/12 = 00:30 del 1/1 en Madrid (CET): cambian el día, el mes y las dos cifras del año.
    expect(formatear('2026-12-31T23:30:00', FMT_FECHA_PEDIDO)).toBe('01/01/27 00:30')
    expect(formatear('2026-08-28T08:42:00', 'dd/MM/yyyy HH:mm')).toBe('28/08/2026 10:42')
  })
})
