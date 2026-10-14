import { describe, expect, it } from 'vitest'
import { agrupados } from '../test/fabrica'
import { atajoCerrarVisible, esApertura, esCierre, estadoInicial, reducir, type DatosNuevo, type EstadoFormulario } from './estado'

const datos = (accionesImei?: string[]): DatosNuevo => ({
  modo: 'nuevo', idAsignacion: 'A20261013_1', imei: '355400000000111', agrupados: agrupados(), solicitudes: [], incidencia: null,
  modeloTelefono: null, accionesImei,
})
/** Formulario con el modelo 13 (tiene componente «otro» en la fábrica): la sección Otras acciones se ve. */
const con13 = (accionesImei?: string[]): EstadoFormulario => reducir(estadoInicial(datos(accionesImei)), { tipo: 'CAMBIAR_MODELO', modelo: '13' })

describe('atajo «+ Cerrar» (spec 2026-10-13 §2.6)', () => {
  it('apertura = «abr»/«abi», cierre = «cerr», sin mirar mayúsculas ni espacios', () => {
    expect(['Abrir', ' abrir telefono', 'Abierto para glass', 'ABRIR'].every(esApertura)).toBe(true)
    expect(['Cerrar', ' cerrado', 'CERRAR teléfono'].every(esCierre)).toBe(true)
    expect(esApertura('Cambio de tornillos')).toBe(false)
    expect(esCierre('Abrir')).toBe(false)
  })
  it('sale con más aperturas que cierres en el IMEI y no con las mismas', () => {
    expect(atajoCerrarVisible(con13(['Abrir']))).toBe(true)
    expect(atajoCerrarVisible(con13(['Abrir', 'Cerrar']))).toBe(false)
    expect(atajoCerrarVisible(con13(['Abrir', 'Cerrar', 'Abrir']))).toBe(true)
    expect(atajoCerrarVisible(con13([]))).toBe(false)
    expect(atajoCerrarVisible(con13(undefined))).toBe(false)
  })
  it('sin la sección Otras acciones (sin modelo), en edición y en glass no sale', () => {
    expect(atajoCerrarVisible(estadoInicial(datos(['Abrir'])))).toBe(false)
    expect(atajoCerrarVisible({ ...con13(['Abrir']), modo: 'editar' })).toBe(false)
    expect(atajoCerrarVisible({ ...con13(['Abrir']), modo: 'glass' })).toBe(false)
  })
  it('«+ Cerrar» añade la línea «Cerrar» y el atajo deja de salir; quitarla lo devuelve', () => {
    let s = reducir(con13(['Abrir']), { tipo: 'ANADIR_CERRAR' })
    expect(s.otros.map((a) => [a.texto, a.origen])).toEqual([['Cerrar', 'nueva']])
    expect(atajoCerrarVisible(s)).toBe(false)
    expect(reducir(s, { tipo: 'ANADIR_CERRAR' })).toBe(s)
    s = reducir(s, { tipo: 'QUITAR_ACCION', id: s.otros[0].id })
    expect(atajoCerrarVisible(s)).toBe(true)
  })
  it('una línea escrita a mano que empieza por «cerr» también cuenta como cierre', () => {
    let s = reducir(con13(['Abrir']), { tipo: 'ANADIR_ACCION' })
    s = reducir(s, { tipo: 'ESCRIBIR_ACCION', id: s.otros[0].id, texto: 'cerrado y probado' })
    expect(atajoCerrarVisible(s)).toBe(false)
  })
})
