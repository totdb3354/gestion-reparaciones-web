import { describe, expect, it } from 'vitest'
import type { LogActividad } from '@/shared/api/client'
import {
  aplicarBuscador, coincideTexto, FILTROS_LOGS_VACIOS, LIMITE_LOGS, MSG_TOPE, queryLogs, TEXTO_VACIO_LOGS, type FiltrosLogs,
} from './filtros'

/** Mismo log de ejemplo que `LogControllerTest.logDeEjemplo()` del JavaFX, con datos sintéticos. */
const log = (o: Partial<LogActividad> = {}): LogActividad => ({
  idLog: 1,
  fecha: '2026-06-10T10:30:00',
  nombreUsuario: 'usuario-a',
  accion: 'CREAR_REPARACION',
  detalle: 'ID_REP: 5, IMEI: 000000000000000, ID_TEC: 2',
  motivo: null,
  ...o,
})

describe('constantes', () => {
  it('filtros vacíos, límite de 1.000 filas y textos exactos (spec §6.2)', () => {
    expect(FILTROS_LOGS_VACIOS).toEqual({ texto: '', accion: null, usuario: null, desde: '', hasta: '' })
    expect(LIMITE_LOGS).toBe(1000)
    expect(MSG_TOPE).toBe('Mostrando los 1.000 registros más recientes; acota con los filtros.')
    expect(TEXTO_VACIO_LOGS).toBe('Tabla sin contenido')
  })
})

describe('queryLogs (parámetros de GET /api/logs)', () => {
  it('sin filtros solo lleva el límite', () => {
    expect(queryLogs(FILTROS_LOGS_VACIOS)).toEqual({ limite: 1000 })
  })
  it('lleva acción, el usuario como `tecnico` y las dos fechas; el buscador no viaja', () => {
    const f: FiltrosLogs = { texto: 'imei', accion: 'LOGIN', usuario: 'usuario-a', desde: '2026-09-01', hasta: '2026-09-26' }
    expect(queryLogs(f)).toEqual({ limite: 1000, accion: 'LOGIN', tecnico: 'usuario-a', desde: '2026-09-01', hasta: '2026-09-26' })
  })
  it('omite cada vacío por separado (null o cadena vacía)', () => {
    expect(queryLogs({ ...FILTROS_LOGS_VACIOS, accion: 'LOGIN' })).toEqual({ limite: 1000, accion: 'LOGIN' })
    expect(queryLogs({ ...FILTROS_LOGS_VACIOS, accion: '' })).toEqual({ limite: 1000 })
    expect(queryLogs({ ...FILTROS_LOGS_VACIOS, usuario: 'usuario-b' })).toEqual({ limite: 1000, tecnico: 'usuario-b' })
    expect(queryLogs({ ...FILTROS_LOGS_VACIOS, hasta: '2026-09-26' })).toEqual({ limite: 1000, hasta: '2026-09-26' })
  })
})

describe('coincideTexto (los 9 casos de LogControllerTest del JavaFX)', () => {
  it('texto vacío: coincide siempre', () => {
    expect(coincideTexto(log(), '')).toBe(true)
  })
  it('texto null: coincide siempre', () => {
    expect(coincideTexto(log(), null)).toBe(true)
  })
  it('texto solo espacios: coincide siempre', () => {
    expect(coincideTexto(log(), '   ')).toBe(true)
  })
  it('coincide en el usuario ignorando mayúsculas', () => {
    expect(coincideTexto(log(), 'USUARIO-A')).toBe(true)
  })
  it('coincide en la acción ignorando mayúsculas', () => {
    expect(coincideTexto(log(), 'crear_reparacion')).toBe(true)
  })
  it('coincide en el detalle por IMEI', () => {
    expect(coincideTexto(log(), '000000000000000')).toBe(true)
  })
  it('coincide con una parte del detalle ("ID_REP")', () => {
    expect(coincideTexto(log(), 'ID_REP')).toBe(true)
  })
  it('"no_existe" no coincide en ningún campo', () => {
    expect(coincideTexto(log(), 'no_existe')).toBe(false)
  })
  it('campos null no lanzan y no coinciden', () => {
    const sinCampos = { ...log(), nombreUsuario: null, accion: null, detalle: null } as unknown as LogActividad
    expect(() => coincideTexto(sinCampos, 'algo')).not.toThrow()
    expect(coincideTexto(sinCampos, 'algo')).toBe(false)
  })
})

describe('coincideTexto: lo que no mira (calco, inventario-logs §5)', () => {
  it('no busca en el motivo ni en la fecha', () => {
    const conMotivo = log({ motivo: 'Duplicada' })
    expect(coincideTexto(conMotivo, 'duplicada')).toBe(false)
    expect(coincideTexto(conMotivo, '2026-06-10')).toBe(false)
    expect(coincideTexto(conMotivo, '10/06/2026')).toBe(false)
  })
  it('recorta el texto buscado antes de comparar', () => {
    expect(coincideTexto(log(), '  usuario-a  ')).toBe(true)
  })
})

describe('aplicarBuscador', () => {
  it('con texto en blanco devuelve la misma lista', () => {
    const lista = [log(), log({ idLog: 2 })]
    expect(aplicarBuscador(lista, '  ')).toBe(lista)
  })
  it('filtra con coincideTexto y conserva el orden del servidor', () => {
    const a = log({ idLog: 3, nombreUsuario: 'usuario-a' })
    const b = log({ idLog: 2, nombreUsuario: 'usuario-b', detalle: 'ID_REP: 7' })
    const c = log({ idLog: 1, nombreUsuario: 'usuario-b', accion: 'LOGIN', detalle: '' })
    expect(aplicarBuscador([a, b, c], 'usuario-b').map((l) => l.idLog)).toEqual([2, 1])
  })
})
