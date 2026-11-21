import { describe, expect, it } from 'vitest'
import { fila } from '../test/fabrica'
import { nivelSalida, textoSalida } from './salida'

const HOY = '2026-11-18' // miércoles
describe('fecha de salida', () => {
  it('pendiente: retraso, hoy, mañana o más tarde', () => {
    expect(nivelSalida(fila({ estado: 'PENDIENTE', fechaSalida: '2026-11-17' }), HOY)).toBe('RETRASO')
    expect(nivelSalida(fila({ estado: 'PENDIENTE', fechaSalida: '2026-11-18' }), HOY)).toBe('HOY')
    expect(nivelSalida(fila({ estado: 'PENDIENTE', fechaSalida: '2026-11-19' }), HOY)).toBe('MANANA')
    expect(nivelSalida(fila({ estado: 'PENDIENTE', fechaSalida: '2026-11-20' }), HOY)).toBe('LUEGO')
    expect(textoSalida(fila({ estado: 'PENDIENTE', fechaSalida: '2026-11-17' }), HOY)).toBe('Con retraso')
    expect(textoSalida(fila({ estado: 'PENDIENTE', fechaSalida: '2026-11-18' }), HOY)).toBe('Sale hoy')
    expect(textoSalida(fila({ estado: 'PENDIENTE', fechaSalida: '2026-11-19' }), HOY)).toBe('Sale mañana')
    expect(textoSalida(fila({ estado: 'PENDIENTE', fechaSalida: '2026-11-20' }), HOY)).toBe('Sale vie 20/11')
  })
  it('sin fecha, enviada, cancelada o histórico: nada', () => {
    expect(nivelSalida(fila({ estado: 'PENDIENTE', fechaSalida: null }), HOY)).toBeNull()
    expect(nivelSalida(fila({ estado: 'ENVIADA', impresaEn: '2026-11-17T10:00:00', fechaSalida: '2026-11-17' }), HOY)).toBeNull()
    expect(nivelSalida(fila({ estado: 'PENDIENTE', marca: 'CANCELADO', fechaSalida: '2026-11-17' }), HOY)).toBeNull()
    expect(nivelSalida(fila({ estado: 'HISTORICO', editable: false, fechaSalida: '2026-11-17' }), HOY)).toBeNull()
  })
  it('falta por enviar conserva el plazo', () => {
    const f = fila({ estado: 'ENVIADA', faltaEnviarEn: '2026-11-16T09:00:00', fechaSalida: '2026-11-17' })
    expect(nivelSalida(f, HOY)).toBe('RETRASO')
  })
})
