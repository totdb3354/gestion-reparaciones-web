import { describe, expect, it } from 'vitest'
import {
  BORRADOR_JAVAFX, agrupados, asignacionActiva, componente, detalleEdicion, reparacion, solicitudAsignacion, solicitudPreventiva,
  solicitudUrgente,
} from './fabrica'

describe('fábrica de tests del formulario y la campana (datos sintéticos)', () => {
  it('agrupados() conserva el orden de claves del servidor y el catálogo canónico', () => {
    const a = agrupados()
    expect(Object.keys(a)).toEqual(['bat', 'cha', 'g', 'mc', 'lcd', 'cam', 'otro'])
    expect(a.bat.map((c) => [c.idCom, c.tipo, c.stock, c.stockMinimo, c.activo])).toEqual([
      [101, 'bati13', 5, 2, true], [102, 'bati14', 0, 2, true], [103, 'bati13promax', 1, 2, true], [104, 'bati12', 3, 1, false],
    ])
    expect(a.cha.map((c) => c.idCom)).toEqual([131])
    expect(a.g.map((c) => [c.idCom, c.tipo, c.stock])).toEqual([[141, 'gi13', 6], [142, 'gi14', 0]])
    expect(a.mc.map((c) => c.idCom)).toEqual([151])
    expect(a.lcd.map((c) => [c.idCom, c.tipo, c.stock, c.stockMinimo])).toEqual([[111, 'lcdi13', 1, 1], [112, 'lcdi14', 3, 1]])
    expect(a.cam.map((c) => [c.idCom, c.tipo, c.stock])).toEqual([[121, 'cami13', 4]])
    expect(a.otro.map((c) => [c.idCom, c.tipo, c.stock, c.stockMinimo])).toEqual([[161, 'otroi13', 0, 0], [162, 'otroi14', 0, 0]])
  })
  it('cada llamada devuelve objetos nuevos (un test puede mutarlos sin contaminar a otro)', () => {
    const a = agrupados()
    a.bat[0].stock = 0
    expect(agrupados().bat[0].stock).toBe(5)
  })
  it('valores por defecto y sobrescritura parcial', () => {
    expect(componente()).toMatchObject({ idCom: 101, tipo: 'bati13', stock: 5, stockMinimo: 2, activo: true, idComMaster: null, enCamino: 0, ultimoPedido: null })
    expect(componente({ stock: 0 }).stock).toBe(0)
    expect(solicitudAsignacion()).toEqual({
      idCom: 102, cantidad: 1, reutilizado: false, observacion: null, prefijo: null, esSolicitud: true, descripcionSolicitud: null,
      estadoSolicitud: 'PENDIENTE', enCamino: false,
    })
    expect(detalleEdicion()).toEqual({ imei: '355400000000111', idTec: 4, idCom: 101, esReutilizado: false, observacion: null, cantidad: 1, updatedAt: '2026-09-16T07:02:00' })
    expect(asignacionActiva()).toEqual({ idRep: 'AG20260916_2', nombreTecnico: 'Técnico H', idTec: 6 })
    expect(solicitudUrgente()).toMatchObject({ idRc: 501, idRep: 'A20260916_1', imei: '355400000000111', nombreTecnico: 'Técnico A', idCom: 102, tipoComponente: 'bati14', descripcion: null, estado: 'PENDIENTE' })
    expect(solicitudPreventiva()).toMatchObject({ idSol: 701, idCom: 111, tipoComponente: 'lcdi13', idUsu: 8, nombreUsuario: 'tecnico_n', descripcion: null, estado: 'PENDIENTE' })
    expect(reparacion()).toMatchObject({ idRep: 'R20260916_5', imei: '355400000000111', idTec: 4 })
    expect(reparacion({ idRep: 'R20260916_6' }).idRep).toBe('R20260916_6')
  })
  it('BORRADOR_JAVAFX es un JSON con la forma del cliente de escritorio: modelo, filas y otros, sin nulos', () => {
    const b = JSON.parse(BORRADOR_JAVAFX) as { modelo: string; filas: Record<string, unknown>[]; otros: Record<string, unknown>[] }
    expect(Object.keys(b)).toEqual(['modelo', 'filas', 'otros'])
    expect(b.modelo).toBe('13')
    expect(b.filas.map((f) => f.prefijo)).toEqual(['bat', 'lcd', 'cam'])
    expect(b.filas[0]).toEqual({
      prefijo: 'bat', idCom: 101, cantidad: 1, reutilizado: false, solicitudNueva: false, agotadoConfirmado: false, guardada: true,
      idRepGenerado: 'R20260916_5', fechaGuardado: '16/09 09:15',
    })
    expect(b.filas[1]).toMatchObject({ prefijo: 'lcd', idCom: 111, cantidad: 1, observacion: 'Pantalla con líneas verticales', guardada: false })
    expect(b.filas[2]).toMatchObject({ prefijo: 'cam', idCom: 121, agotadoConfirmado: true, descripcionAgotado: 'Cámara trasera completa' })
    expect(b.otros).toEqual([
      { descripcion: 'Limpieza del conector de carga', guardada: true, idRepGenerado: 'R20260916_6', fechaGuardado: '16/09 09:20' },
      { descripcion: 'Ajuste de tornillería', guardada: false },
    ])
    expect(BORRADOR_JAVAFX).not.toContain('null')
  })
})
