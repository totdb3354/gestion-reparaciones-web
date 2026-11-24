import { describe, expect, it } from 'vitest'
import { fila } from '../test/fabrica'
import { fechaReferencia, nivelSalida, textoSalida } from './salida'

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

  // 0.9.44, webs: «Sale hoy» desde el primer laborable hasta el límite; nunca en fin de semana.
  // 2026-11-20 viernes, 21 sábado, 22 domingo, 23 lunes, 24 martes, 25 miércoles.
  const web = (salidaDesde: string, fechaSalida: string) => fila({ estado: 'PENDIENTE', canal: 'PARTICULARES', salidaDesde, fechaSalida })
  it('web que entra en sábado: «Sale lun» el sábado, «Sale mañana» el domingo, «Sale hoy» lunes y martes, «Con retraso» el miércoles', () => {
    const f = web('2026-11-23', '2026-11-24')
    expect(textoSalida(f, '2026-11-21')).toBe('Sale lun 23/11')
    expect(nivelSalida(f, '2026-11-21')).toBe('LUEGO')
    expect(textoSalida(f, '2026-11-22')).toBe('Sale mañana')
    expect(textoSalida(f, '2026-11-23')).toBe('Sale hoy')
    expect(textoSalida(f, '2026-11-24')).toBe('Sale hoy')
    expect(textoSalida(f, '2026-11-25')).toBe('Con retraso')
  })
  it('web del viernes: «Sale hoy» el viernes, el fin de semana dice el lunes, «Sale hoy» el lunes y el martes va con retraso', () => {
    const f = web('2026-11-20', '2026-11-23')
    expect(textoSalida(f, '2026-11-20')).toBe('Sale hoy')
    expect(textoSalida(f, '2026-11-21')).toBe('Sale lun 23/11')
    expect(nivelSalida(f, '2026-11-21')).toBe('LUEGO')
    expect(textoSalida(f, '2026-11-22')).toBe('Sale mañana')
    expect(nivelSalida(f, '2026-11-23')).toBe('HOY')
    expect(nivelSalida(f, '2026-11-24')).toBe('RETRASO')
  })
  it('sin salidaDesde (Amazon o servidor viejo) se usa solo el límite, como antes', () => {
    const f = fila({ estado: 'PENDIENTE', canal: 'AMAZON', salidaDesde: null, fechaSalida: '2026-11-24' })
    expect(textoSalida(f, '2026-11-23')).toBe('Sale mañana')
    expect(textoSalida(f, '2026-11-24')).toBe('Sale hoy')
  })
  it('fechaReferencia: desde, hoy, el lunes o el límite', () => {
    expect(fechaReferencia(web('2026-11-23', '2026-11-24'), '2026-11-21')).toBe('2026-11-23')
    expect(fechaReferencia(web('2026-11-23', '2026-11-24'), '2026-11-24')).toBe('2026-11-24')
    expect(fechaReferencia(web('2026-11-20', '2026-11-23'), '2026-11-22')).toBe('2026-11-23')
    expect(fechaReferencia(web('2026-11-20', '2026-11-23'), '2026-11-25')).toBe('2026-11-23')
    expect(fechaReferencia(fila({ estado: 'PENDIENTE', fechaSalida: null }), '2026-11-25')).toBeNull()
  })
})
