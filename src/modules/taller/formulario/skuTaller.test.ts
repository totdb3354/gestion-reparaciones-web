import { describe, expect, it } from 'vitest'
import { agrupados, detalleEdicion, previaTaller } from '../test/fabrica'
import { estadoInicial, reducir, type AccionFormulario, type DatosEditar, type DatosNuevo, type EstadoFormulario } from './estado'
import { peticionPreviaTaller, textoBandaTaller } from './skuTaller'

const IMEI = '355400000000111'

function datosNuevo(parcial: Partial<DatosNuevo> = {}): DatosNuevo {
  return {
    modo: 'nuevo', idAsignacion: 'A20260916_1', imei: IMEI, agrupados: agrupados(), solicitudes: [], incidencia: null,
    modeloTelefono: null, ...parcial,
  }
}
function datosEditar(parcial: Partial<DatosEditar> = {}): DatosEditar {
  return {
    modo: 'editar', idRep: 'R20260916_5', detalle: detalleEdicion(), agrupados: agrupados(), yaReparados: [], accionesYaReparadas: [],
    ...parcial,
  }
}
const aplicar = (e: EstadoFormulario, ...acciones: AccionFormulario[]) => acciones.reduce(reducir, e)
const conModelo = (parcial: Partial<DatosNuevo> = {}) => reducir(estadoInicial(datosNuevo(parcial)), { tipo: 'CAMBIAR_MODELO', modelo: '13' })
const CHASIS_REUTILIZADO: AccionFormulario[] = [
  { tipo: 'ELEGIR', prefijo: 'cha', eleccion: 'reutilizada' }, { tipo: 'CAMBIAR_SKU', prefijo: 'cha', idCom: 131 },
]

describe('lo que se pide para la banda del SKU del taller (spec 0.9.21 pieza 2 §2.4)', () => {
  it('una batería nueva y un chasis reutilizado: las filas que se van a terminar', () => {
    const e = aplicar(conModelo(), { tipo: 'ELEGIR', prefijo: 'bat', eleccion: 'nueva' }, ...CHASIS_REUTILIZADO)
    expect(peticionPreviaTaller(e)).toEqual({
      imei: IMEI, filas: [{ idRep: null, idCom: 101, reutilizada: false }, { idRep: null, idCom: 131, reutilizada: true }],
    })
  })

  it('una pieza que no cambia el móvil (pantalla) o nada elegido: no se pregunta', () => {
    expect(peticionPreviaTaller(aplicar(conModelo(), { tipo: 'ELEGIR', prefijo: 'lcd', eleccion: 'nueva' }))).toBeNull()
    expect(peticionPreviaTaller(conModelo())).toBeNull()
  })

  it('una fila ya guardada con «✓ Guardar fila» no va: ya se aplicó', () => {
    const e = aplicar(conModelo(), { tipo: 'ELEGIR', prefijo: 'bat', eleccion: 'nueva' },
      { tipo: 'FILA_GUARDADA', prefijo: 'bat', idRep: 'R20260916_9', fecha: '16/09 09:15' }, ...CHASIS_REUTILIZADO)
    expect(peticionPreviaTaller(e)?.filas).toEqual([{ idRep: null, idCom: 131, reutilizada: true }])
  })

  it('en glass no se pregunta', () => {
    const e = aplicar(reducir(estadoInicial(datosNuevo({ modo: 'glass', idAsignacion: 'AG20260916_2' })), { tipo: 'CAMBIAR_MODELO', modelo: '13' }),
      { tipo: 'ELEGIR', prefijo: 'g', eleccion: 'nueva' })
    expect(peticionPreviaTaller(e)).toBeNull()
  })

  it('en edición, la fila editada va con su reparación y las nuevas detrás', () => {
    const e = aplicar(estadoInicial(datosEditar()), { tipo: 'VOLVER', prefijo: 'bat' },
      { tipo: 'ELEGIR', prefijo: 'bat', eleccion: 'reutilizada' }, ...CHASIS_REUTILIZADO)
    expect(peticionPreviaTaller(e)).toEqual({
      imei: IMEI, filas: [{ idRep: 'R20260916_5', idCom: 101, reutilizada: true }, { idRep: null, idCom: 131, reutilizada: true }],
    })
  })

  it('en edición sin cambios no se pregunta', () => {
    expect(peticionPreviaTaller(estadoInicial(datosEditar()))).toBeNull()
  })
})

describe('el texto de la banda (spec 0.9.21 pieza 2 §2.4)', () => {
  it('lo que cambia, con lo de ahora', () => {
    expect(textoBandaTaller(previaTaller({ despues: { color: 'Rojo', grado: 'A100' } })))
      .toBe('Al guardar, este móvil pasará a: Rojo · A100 (ahora: Azul · B)')
    expect(textoBandaTaller(previaTaller({ despues: { color: 'Azul', grado: 'B100' } })))
      .toBe('Al guardar, este móvil pasará a: B100 (ahora: B)')
  })

  it('los avisos del color y del grado', () => {
    expect(textoBandaTaller(previaTaller({ despues: { color: 'Azul', grado: 'A' }, colorSinDeducir: true })))
      .toBe('Al guardar, este móvil pasará a: A (ahora: B); el color del chasis no se puede deducir: lo corregirá un supertécnico')
    expect(textoBandaTaller(previaTaller({ antes: { color: 'Azul', grado: 'ID' }, despues: { color: 'Rojo', grado: 'ID' }, gradoSinCalcular: true })))
      .toBe('Al guardar, este móvil pasará a: Rojo (ahora: Azul); el grado (ID) no se puede calcular: lo corregirá un supertécnico')
    expect(textoBandaTaller(previaTaller({ colorSinDeducir: true })))
      .toBe('Al guardar, el color del chasis no se puede deducir: lo corregirá un supertécnico')
  })

  it('nada que decir: sin banda', () => {
    expect(textoBandaTaller(null)).toBeNull()
    expect(textoBandaTaller(previaTaller())).toBeNull()
    expect(textoBandaTaller(previaTaller({ enNsys: false, despues: { color: 'Rojo', grado: 'A' } }))).toBeNull()
  })
})
