import { describe, expect, it } from 'vitest'
import { agrupados, componente, detalleEdicion, solicitudAsignacion } from '../test/fabrica'
import { aplicarBorrador, capturar } from './borrador'
import {
  type AccionFormulario, type DatosEditar, type DatosNuevo, type EstadoFormulario, type FilaEstado,
  chasisResaltados, estadoInicial, reducir, subFila,
} from './estado'

/** Catálogo del modelo 16 con chasis SIM y eSIM y tapas (spec 0.9.7 §9). */
function catalogo16() {
  const a = agrupados()
  const sku = (idCom: number, tipo: string) => componente({ idCom, tipo, stock: 9999, stockMinimo: 2 })
  a.cha = [sku(201, 'chai16black'), sku(202, 'chai16blackesim'), sku(203, 'chai16teal'), sku(204, 'chai16tealesim'), ...a.cha]
  a.bat = [...a.bat, sku(205, 'bati16')]
  return { ...a, tapa: [sku(211, 'tapai16black'), sku(212, 'tapai16teal')] }
}
function datosNuevo(parcial: Partial<DatosNuevo> = {}): DatosNuevo {
  return { modo: 'nuevo', idAsignacion: 'A20261009_1', imei: '355400000000111', agrupados: catalogo16(), solicitudes: [], incidencia: null, modeloTelefono: null, ...parcial }
}
function datosEditar(parcial: Partial<DatosEditar> = {}): DatosEditar {
  return { modo: 'editar', idRep: 'R20261009_5', detalle: detalleEdicion({ idCom: 205 }), agrupados: catalogo16(), yaReparados: [], accionesYaReparadas: [], ...parcial }
}
const aplicar = (e: EstadoFormulario, ...acciones: AccionFormulario[]) => acciones.reduce(reducir, e)
const fila = (e: EstadoFormulario, prefijo: string): FilaEstado => {
  const f = e.filas.find((x) => x.prefijo === prefijo)
  if (!f) throw new Error(`no hay fila ${prefijo}`)
  return f
}
const modelo16 = () => aplicar(estadoInicial(datosNuevo()), { tipo: 'CAMBIAR_MODELO', modelo: '16' })

describe('chasis y tapa sin SKU preseleccionado (spec 0.9.7 §9.1)', () => {
  it('al elegir el modelo, chasis y tapa quedan sin elegir; el resto se preselecciona como siempre', () => {
    const e = modelo16()
    expect(fila(e, 'cha').idCom).toBeNull()
    expect(fila(e, 'tapa').idCom).toBeNull()
    expect(fila(e, 'bat').idCom).toBe(205)
    expect(fila(e, 'cha').controles).toEqual({ mas: false, menos: false, reutilizado: false, sku: true, observacion: false })
  })
  it('sin SKU, "+" y "Reutilizado" no hacen nada y no sale la sub-fila de sin stock', () => {
    const e = modelo16()
    expect(aplicar(e, { tipo: 'SUMAR', prefijo: 'cha' }, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'cha', valor: true })).toBe(e)
    expect(subFila(e, fila(e, 'cha'))).toEqual({ tipo: 'oculta' })
  })
  it('al elegir el SKU se encienden los controles y se puede sumar', () => {
    const e = aplicar(modelo16(), { tipo: 'CAMBIAR_SKU', prefijo: 'cha', idCom: 204 }, { tipo: 'SUMAR', prefijo: 'cha' })
    expect(fila(e, 'cha')).toMatchObject({ idCom: 204, cantidad: 1 })
  })
  it('al cambiar de modelo vuelven a sin elegir', () => {
    const e = aplicar(modelo16(), { tipo: 'CAMBIAR_SKU', prefijo: 'cha', idCom: 201 }, { tipo: 'CAMBIAR_MODELO', modelo: '13' })
    expect(fila(e, 'cha').idCom).toBeNull()
  })
})

describe('enlace de color chasis ↔ tapa (spec 0.9.7 §9.1)', () => {
  it('elegir el chasis pone la tapa del mismo color', () => {
    const e = aplicar(modelo16(), { tipo: 'CAMBIAR_SKU', prefijo: 'cha', idCom: 204 })
    expect(fila(e, 'tapa').idCom).toBe(212)
    expect(fila(e, 'tapa').cantidad).toBe(0)
  })
  it('elegir la tapa con chasis elegido cambia el color del chasis conservando su eSIM', () => {
    const e = aplicar(modelo16(), { tipo: 'CAMBIAR_SKU', prefijo: 'cha', idCom: 202 }, { tipo: 'CAMBIAR_SKU', prefijo: 'tapa', idCom: 212 })
    expect(fila(e, 'cha').idCom).toBe(204)
  })
  it('elegir la tapa con el chasis sin elegir: el chasis sigue sin elegir y se resaltan las del color de la tapa', () => {
    const e = aplicar(modelo16(), { tipo: 'CAMBIAR_SKU', prefijo: 'tapa', idCom: 212 })
    expect(fila(e, 'cha').idCom).toBeNull()
    expect([...chasisResaltados(e)].sort()).toEqual([203, 204])
    expect(chasisResaltados(aplicar(e, { tipo: 'CAMBIAR_SKU', prefijo: 'cha', idCom: 203 })).size).toBe(0)
  })
  it('el enlace no cambia la cantidad ni "Reutilizado" de la otra fila', () => {
    const e = aplicar(modelo16(),
      { tipo: 'CAMBIAR_SKU', prefijo: 'tapa', idCom: 211 }, { tipo: 'SUMAR', prefijo: 'tapa' },
      { tipo: 'CAMBIAR_SKU', prefijo: 'cha', idCom: 203 })
    expect(fila(e, 'tapa')).toMatchObject({ idCom: 212, cantidad: 1, reutilizado: false })
  })
  it('no toca la fila en edición', () => {
    // Edición de una tapa (211, modelo 16): elegir el chasis teal no cambia la tapa editada.
    const e0 = estadoInicial(datosEditar({ detalle: detalleEdicion({ idCom: 211 }) }))
    expect(fila(e0, 'tapa').rol).toBe('editada')
    const e = aplicar(e0, { tipo: 'CAMBIAR_SKU', prefijo: 'cha', idCom: 203 })
    expect(fila(e, 'tapa').idCom).toBe(211)
  })
})

describe('al abrir y con el borrador (spec 0.9.7 §9.3)', () => {
  it('editar un chasis: la tapa empieza con su color, sin subir revision', () => {
    const e = estadoInicial(datosEditar({ detalle: detalleEdicion({ idCom: 204 }) }))
    expect(fila(e, 'cha').idCom).toBe(204)
    expect(fila(e, 'tapa').idCom).toBe(212)
    expect(e.revision).toBe(0)
  })
  it('una solicitud de chasis sigue preseleccionando su SKU, y la tapa toma su color', () => {
    const e = estadoInicial(datosNuevo({ solicitudes: [solicitudAsignacion({ idCom: 203 })] }))
    expect(fila(e, 'cha').idCom).toBe(203)
    expect(fila(e, 'tapa').idCom).toBe(212)
  })
  it('el borrador recupera el chasis elegido y su cantidad', () => {
    const elegido = aplicar(modelo16(), { tipo: 'CAMBIAR_SKU', prefijo: 'cha', idCom: 202 }, { tipo: 'SUMAR', prefijo: 'cha' })
    const recuperado = aplicarBorrador(estadoInicial(datosNuevo()), capturar(elegido))
    expect(fila(recuperado, 'cha')).toMatchObject({ idCom: 202, cantidad: 1 })
    expect(fila(recuperado, 'cha').controles.menos).toBe(true)
  })
  it('una fila de chasis sin SKU en el borrador no recupera cantidad', () => {
    const recuperado = aplicarBorrador(estadoInicial(datosNuevo()), capturar(modelo16()))
    expect(fila(recuperado, 'cha')).toMatchObject({ idCom: null, cantidad: 0, reutilizado: false })
  })
})
