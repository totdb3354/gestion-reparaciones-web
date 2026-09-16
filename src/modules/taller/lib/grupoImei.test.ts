import { describe, expect, it } from 'vitest'
import { resumen } from '../test/fabrica'
import { agruparPorImei, ordenarPorActividad, resumenTipos } from './grupoImei'

const rr = (idRep: string, extra = {}) => resumen({ idRep, imei: '111111111111111', modelo: null, cliente: null, ...extra })

describe('grupoImei (calco de GrupoImei)', () => {
  it('cuenta por tipo según el prefijo', () => {
    const [g] = agruparPorImei([rr('R20260630_1'), rr('G20260630_1'), rr('G20260630_2'), rr('P20260630_1')])
    expect(g.countRep).toBe(1)
    expect(g.countGlass).toBe(2)
    expect(g.countPul).toBe(1)
  })
  it('resumen omite los tipos a cero y va en orden Rep · Glass · Pul', () => {
    expect(resumenTipos(agruparPorImei([rr('R20260630_1'), rr('R20260630_2')])[0])).toBe('2 Rep')
    expect(resumenTipos(agruparPorImei([rr('P20260630_1'), rr('R20260630_1'), rr('G20260630_1')])[0])).toBe('1 Rep · 1 Glass · 1 Pul')
    expect(resumenTipos(agruparPorImei([rr('G20260630_1')])[0])).toBe('1 Glass')
  })
  it('modelo, observación y cliente son el primer valor no vacío; fechas mínima de asignación y máxima de fin; incidencias abiertas', () => {
    const [g] = agruparPorImei([
      rr('R1', { modelo: '', fechaAsig: '2026-09-11T07:00:00', fechaFin: '2026-09-11T08:00:00', esIncidencia: true, esResuelto: false, telefonoUpdatedAt: '2026-09-01T00:00:00' }),
      rr('R2', { modelo: '13mini', observacionTelefono: 'rayado', cliente: 'WEB', fechaAsig: '2026-09-10T07:00:00', fechaFin: '2026-09-12T08:00:00', esIncidencia: true, esResuelto: true }),
      rr('P1', { fechaAsig: '2026-09-12T07:00:00', fechaFin: null }),
    ])
    expect(g.imei).toBe('111111111111111')
    expect(g.modelo).toBe('13mini')
    expect(g.observacion).toBe('rayado')
    expect(g.cliente).toBe('WEB')
    expect(g.fechaMasAntigua).toBe('2026-09-10T07:00:00')
    expect(g.fechaMasReciente).toBe('2026-09-12T08:00:00')
    expect(g.incAbiertas).toBe(1)
    expect(g.telefonoUpdatedAt).toBe('2026-09-01T00:00:00')
    expect(g.trabajos).toHaveLength(3)
  })
  it('un grupo por IMEI en orden de aparición, y ordenarPorActividad pone la más reciente arriba y las sin fecha al final', () => {
    const grupos = agruparPorImei([
      resumen({ idRep: 'R1', imei: '111111111111111', fechaFin: '2026-09-01T00:00:00' }),
      resumen({ idRep: 'R2', imei: '222222222222222', fechaFin: '2026-09-05T00:00:00' }),
      resumen({ idRep: 'R3', imei: '111111111111111', fechaFin: '2026-09-03T00:00:00' }),
      resumen({ idRep: 'P9', imei: '333333333333333', fechaFin: null }),
    ])
    expect(grupos.map((g) => g.imei)).toEqual(['111111111111111', '222222222222222', '333333333333333'])
    expect(ordenarPorActividad(grupos).map((g) => g.imei)).toEqual(['222222222222222', '111111111111111', '333333333333333'])
  })
})
