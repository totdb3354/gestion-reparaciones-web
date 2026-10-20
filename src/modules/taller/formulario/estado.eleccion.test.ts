import { describe, expect, it } from 'vitest'
import { agrupados, componente, detalleEdicion, solicitudAsignacion } from '../test/fabrica'
import {
  type AccionFormulario, type DatosEditar, type DatosNuevo, type EstadoFormulario, type FilaEstado,
  avisoAntesDeGuardar, botonNueva, estadoInicial, filaActiva, filaEditadaInvalida, filaElegidaSinSku, filaNuevaSinStock, marcaPieza, muestraEleccion, planGuardarCambios,
  planTerminar, previsionStock, reducir, reutilizadaJuntoASolicitud, subFila, textoFaltaSku, textoSinStock, zonaGuardarVisible,
} from './estado'

const IMEI = '355400000000111'
const datosNuevo = (parcial: Partial<DatosNuevo> = {}): DatosNuevo => ({
  modo: 'nuevo', idAsignacion: 'A20260916_1', imei: IMEI, agrupados: agrupados(), solicitudes: [], incidencia: null,
  modeloTelefono: null, ...parcial,
})
const datosEditar = (parcial: Partial<DatosEditar> = {}): DatosEditar => ({
  modo: 'editar', idRep: 'R20260916_5', detalle: detalleEdicion(), agrupados: agrupados(), yaReparados: [], accionesYaReparadas: [],
  ...parcial,
})
const conModelo = (modelo: string, parcial: Partial<DatosNuevo> = {}) =>
  reducir(estadoInicial(datosNuevo(parcial)), { tipo: 'CAMBIAR_MODELO', modelo })
const aplicar = (e: EstadoFormulario, ...acciones: AccionFormulario[]) => acciones.reduce(reducir, e)
function fila(e: EstadoFormulario, prefijo: string): FilaEstado {
  const f = e.filas.find((x) => x.prefijo === prefijo)
  if (!f) throw new Error(`no hay fila ${prefijo}`)
  return f
}
const nueva = (prefijo: string): AccionFormulario => ({ tipo: 'ELEGIR', prefijo, eleccion: 'nueva' })
const reutilizada = (prefijo: string): AccionFormulario => ({ tipo: 'ELEGIR', prefijo, eleccion: 'reutilizada' })
const volver = (prefijo: string): AccionFormulario => ({ tipo: 'VOLVER', prefijo })

describe('0.9.19 · «Nueva» o «Reutilizada» en la celda del SKU (spec §2)', () => {
  it('una fila empieza sin elegir; «Nueva» pone 1 y enciende «+» y «−»', () => {
    const e = conModelo('13') // bati13: stock 5
    expect(fila(e, 'bat')).toMatchObject({ eleccion: null, cantidad: 0, reutilizado: false, idCom: 101 })
    expect(muestraEleccion(fila(e, 'bat'))).toBe(true)
    const n = reducir(e, nueva('bat'))
    expect(fila(n, 'bat')).toMatchObject({ eleccion: 'nueva', cantidad: 1, reutilizado: false })
    expect(fila(n, 'bat').controles).toMatchObject({ mas: true, menos: true, reutilizado: false })
    expect(filaActiva(fila(n, 'bat'))).toBe(true)
    expect(muestraEleccion(fila(n, 'bat'))).toBe(false)
    expect(fila(reducir(n, { tipo: 'SUMAR', prefijo: 'bat' }), 'bat').cantidad).toBe(2)
  })

  it('sin elegir o con «Reutilizada», «+» no suma', () => {
    const e = conModelo('13')
    expect(reducir(e, { tipo: 'SUMAR', prefijo: 'bat' })).toBe(e)
    const r = reducir(e, reutilizada('bat'))
    expect(reducir(r, { tipo: 'SUMAR', prefijo: 'bat' })).toBe(r)
  })

  it('«Reutilizada» no gasta: cantidad 0, sin «+» ni «−», y la fila cuenta', () => {
    const r = fila(reducir(conModelo('13'), reutilizada('bat')), 'bat')
    expect(r).toMatchObject({ eleccion: 'reutilizada', reutilizado: true, cantidad: 0 })
    expect(r.controles).toMatchObject({ mas: false, menos: false })
    expect(filaActiva(r)).toBe(true)
  })

  it('solo se elige sobre una fila sin elegir', () => {
    const n = reducir(conModelo('13'), nueva('bat'))
    expect(reducir(n, reutilizada('bat'))).toBe(n)
    expect(reducir(n, nueva('bat'))).toBe(n)
  })

  it('«−» hasta 0 y la «×» dejan la fila sin elegir y conservan el SKU', () => {
    const cero = aplicar(conModelo('13'), nueva('bat'), { tipo: 'RESTAR', prefijo: 'bat' })
    expect(fila(cero, 'bat')).toMatchObject({ eleccion: null, cantidad: 0, idCom: 101 })
    expect(fila(cero, 'bat').controles).toEqual({ mas: false, menos: false, reutilizado: true, sku: true, observacion: true })
    const vuelta = aplicar(conModelo('13'), reutilizada('bat'), volver('bat'))
    expect(fila(vuelta, 'bat')).toMatchObject({ eleccion: null, reutilizado: false, cantidad: 0, idCom: 101 })
    expect(reducir(vuelta, volver('bat'))).toBe(vuelta) // sin elegir, la «×» no hace nada
  })

  it('las bandas de pedir solo salen con «Nueva»', () => {
    const e = conModelo('14') // bati14: stock 0, el único del modelo
    expect(subFila(e, fila(e, 'bat')).tipo).toBe('oculta')
    const r = reducir(e, reutilizada('bat'))
    expect(subFila(r, fila(r, 'bat')).tipo).toBe('oculta')
    const n = reducir(e, nueva('bat'))
    expect(fila(n, 'bat').cantidad).toBe(0)
    expect(subFila(n, fila(n, 'bat')).tipo).toBe('sinStock')
    const lcd = reducir(conModelo('13'), nueva('lcd')) // lcdi13: stock 1 → en el límite
    expect(subFila(lcd, fila(lcd, 'lcd'))).toEqual({ tipo: 'limite', stock: 1 })
  })

  it('con «Nueva», cambiar de SKU ajusta la cantidad sin pasar del stock', () => {
    const catalogo = agrupados()
    catalogo.bat = [componente({ idCom: 105, tipo: 'bati13negra', stock: 0 }), componente({ idCom: 101, tipo: 'bati13', stock: 5 }),
      componente({ idCom: 106, tipo: 'bati13alta', stock: 1 })]
    const dos = aplicar(conModelo('13', { agrupados: catalogo }), nueva('bat'), { tipo: 'SUMAR', prefijo: 'bat' })
    expect(fila(dos, 'bat')).toMatchObject({ idCom: 101, cantidad: 2 })
    const uno = reducir(dos, { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 106 })
    expect(fila(uno, 'bat')).toMatchObject({ idCom: 106, cantidad: 1 })
    expect(fila(uno, 'bat').controles).toMatchObject({ mas: false, menos: true })
    const sin = reducir(uno, { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 105 })
    expect(fila(sin, 'bat')).toMatchObject({ idCom: 105, cantidad: 0, eleccion: 'nueva' })
    expect(subFila(sin, fila(sin, 'bat')).tipo).toBe('sinStock')
    expect(fila(reducir(sin, { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 101 }), 'bat').cantidad).toBe(1)
    // con «Reutilizada», cambiar de SKU no toca nada más
    const r = aplicar(conModelo('13', { agrupados: catalogo }), reutilizada('bat'), { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 105 })
    expect(fila(r, 'bat')).toMatchObject({ idCom: 105, eleccion: 'reutilizada', reutilizado: true, cantidad: 0 })
  })

  it('chasis: elegido sin color no cuenta y no deja terminar; con el color, «Nueva» pone 1', () => {
    const e = conModelo('13') // chai13negro: stock 2, sin preseleccionar
    expect(fila(e, 'cha').controles.reutilizado).toBe(true) // «Reutilizada» se puede elegir antes que el color
    const n = aplicar(e, nueva('cha'), nueva('bat'))
    expect(fila(n, 'cha')).toMatchObject({ eleccion: 'nueva', idCom: null, cantidad: 0 })
    expect(filaActiva(fila(n, 'cha'))).toBe(false)
    expect(filaElegidaSinSku(fila(n, 'cha'))).toBe(true)
    expect(textoFaltaSku(n)).toBe('Falta elegir el SKU de: Chasis.')
    expect(reducir(n, { tipo: 'PEDIR_CONFIRMACION_GUARDAR' })).toBe(n)
    const conColor = reducir(n, { tipo: 'CAMBIAR_SKU', prefijo: 'cha', idCom: 131 })
    expect(fila(conColor, 'cha')).toMatchObject({ idCom: 131, cantidad: 1 })
    expect(textoFaltaSku(conColor)).toBeNull()
    expect(reducir(conColor, { tipo: 'PEDIR_CONFIRMACION_GUARDAR' }).guardado.clics).toBe(1)
  })

  it('chasis: «Reutilizada» antes del color no se envía hasta tener SKU, pero muestra la zona para poder avisar', () => {
    const r = reducir(conModelo('13'), reutilizada('cha'))
    expect(fila(r, 'cha')).toMatchObject({ eleccion: 'reutilizada', reutilizado: true, idCom: null })
    expect(filaActiva(fila(r, 'cha'))).toBe(false)
    expect(zonaGuardarVisible(r)).toBe(true)
    expect(planTerminar(r, 4).completa?.filas).toEqual([])
    const conColor = reducir(r, { tipo: 'CAMBIAR_SKU', prefijo: 'cha', idCom: 131 })
    expect(filaActiva(fila(conColor, 'cha'))).toBe(true)
    expect(fila(conColor, 'cha').cantidad).toBe(0)
  })

  it('botón de la izquierda: «Nueva» si algún SKU tiene stock; si ninguno, «Solicitar pieza»; en edición, deshabilitado', () => {
    const e13 = conModelo('13')
    expect(botonNueva(e13, fila(e13, 'bat'))).toBe('nueva')
    const e14 = conModelo('14')
    expect(botonNueva(e14, fila(e14, 'bat'))).toBe('solicitar')
    expect(botonNueva(e14, fila(e14, 'cha'))).toBe('deshabilitada') // fila sin SKU para el modelo (spec 0.9.19 §2)
    const catalogo = agrupados()
    catalogo.bat = [componente({ idCom: 101, tipo: 'bati13', stock: 0 })]
    catalogo.cam = [componente({ idCom: 121, tipo: 'cami13', stock: 0 })]
    const ed = estadoInicial(datosEditar({ agrupados: catalogo })) // bati13 nueva ×1; ya sin stock
    expect(botonNueva(ed, fila(ed, 'cam'))).toBe('deshabilitada')
    // la fila editada cuenta la unidad que devolvería su pieza original
    expect(botonNueva(ed, fila(ed, 'bat'))).toBe('nueva')
  })

  it('«Solicitar pieza» directo: la fila sin elegir queda Nueva y pedida; la «×» la cancela', () => {
    const e = conModelo('14')
    const pedida = reducir(e, { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'bat', descripcion: '  urge  ' })
    expect(fila(pedida, 'bat')).toMatchObject({ eleccion: 'nueva', cantidad: 0, agotado: { descripcion: 'urge', registrado: false } })
    expect(filaActiva(fila(pedida, 'bat'))).toBe(true)
    expect(marcaPieza(fila(pedida, 'bat'))).toEqual({ tipo: 'solicitada', quitar: true })
    expect(subFila(pedida, fila(pedida, 'bat')).tipo).toBe('confirmada')
    expect(fila(reducir(pedida, volver('bat')), 'bat')).toMatchObject({ eleccion: null, agotado: null, cantidad: 0 })
    // «Cancelar solicitud» de la banda hace lo mismo
    expect(fila(reducir(pedida, { tipo: 'CANCELAR_AGOTADO', prefijo: 'bat' }), 'bat')).toMatchObject({ eleccion: null, agotado: null })
    // con stock no hay «Solicitar pieza» directo
    const con = conModelo('13')
    expect(reducir(con, { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'bat', descripcion: '' })).toBe(con)
    // registrada en el servidor, ya no se quita
    const registrada = reducir(pedida, { tipo: 'AGOTADO_REGISTRADO', prefijo: 'bat' })
    expect(reducir(registrada, volver('bat'))).toBe(registrada)
    expect(marcaPieza(fila(registrada, 'bat'))?.quitar).toBe(false)
  })

  it('marca de la columna «Pieza»', () => {
    const e = conModelo('13')
    expect(marcaPieza(fila(e, 'bat'))).toBeNull()
    expect(marcaPieza(fila(reducir(e, nueva('bat')), 'bat'))).toEqual({ tipo: 'nueva', quitar: true })
    expect(marcaPieza(fila(reducir(e, reutilizada('bat')), 'bat'))).toEqual({ tipo: 'reutilizada', quitar: true })
    const guardada = aplicar(e, nueva('bat'), { tipo: 'FILA_GUARDADA', prefijo: 'bat', idRep: 'R20260916_9', fecha: '16/09 09:15' })
    expect(marcaPieza(fila(guardada, 'bat'))).toEqual({ tipo: 'nueva', quitar: false })
    expect(muestraEleccion(fila(guardada, 'bat'))).toBe(false)
    expect(reducir(guardada, volver('bat'))).toBe(guardada)
  })

  it('solicitud guardada pendiente: sin marca, «↺ Reutilizada» al lado y vuelta con la «×»; en camino, nada', () => {
    const e = estadoInicial(datosNuevo({ solicitudes: [solicitudAsignacion()] })) // pendiente de bati14 → modelo 14
    const bat = fila(e, 'bat')
    expect(bat.solicitud).toEqual({ estado: 'pendiente', descripcion: null })
    expect(muestraEleccion(bat)).toBe(false)
    expect(marcaPieza(bat)).toBeNull()
    expect(reutilizadaJuntoASolicitud(bat)).toBe(true)
    expect(reducir(e, nueva('bat'))).toBe(e)
    const r = reducir(e, reutilizada('bat'))
    expect(fila(r, 'bat')).toMatchObject({ eleccion: 'reutilizada', reutilizado: true })
    expect(filaActiva(fila(r, 'bat'))).toBe(true)
    expect(reutilizadaJuntoASolicitud(fila(r, 'bat'))).toBe(false)
    expect(marcaPieza(fila(r, 'bat'))).toEqual({ tipo: 'reutilizada', quitar: true })
    const vuelta = reducir(r, volver('bat'))
    expect(fila(vuelta, 'bat')).toMatchObject({ eleccion: null, reutilizado: false })
    expect(fila(vuelta, 'bat').controles).toEqual({ mas: false, menos: false, reutilizado: true, sku: false, observacion: true })
    const enCamino = estadoInicial(datosNuevo({ solicitudes: [solicitudAsignacion({ enCamino: true })] }))
    expect(reutilizadaJuntoASolicitud(fila(enCamino, 'bat'))).toBe(false)
    expect(reducir(enCamino, reutilizada('bat'))).toBe(enCamino)
  })

  it('«Stock» de una Nueva sin guardar enseña lo que quedará', () => {
    const n = reducir(conModelo('13'), nueva('bat'))
    expect(previsionStock(n, fila(n, 'bat'))).toEqual({ texto: '5 → 4', tendencia: 'baja' })
    const r = reducir(conModelo('13'), reutilizada('bat'))
    expect(previsionStock(r, fila(r, 'bat'))).toBeNull()
  })

  it('edición: la fila arranca elegida según lo guardado y con la «×» cambia de tipo', () => {
    const e = estadoInicial(datosEditar()) // bati13 nueva ×1, stock 5
    expect(fila(e, 'bat')).toMatchObject({ rol: 'editada', eleccion: 'nueva', cantidad: 1 })
    const sinElegir = reducir(e, volver('bat'))
    expect(filaEditadaInvalida(sinElegir)).toBe(true)
    expect(zonaGuardarVisible(sinElegir)).toBe(false)
    const r = reducir(sinElegir, reutilizada('bat'))
    expect(filaEditadaInvalida(r)).toBe(false)
    expect(zonaGuardarVisible(r)).toBe(true)
    expect(previsionStock(r, fila(r, 'bat'))).toEqual({ texto: '5 → 6', tendencia: 'sube' })
    expect(planGuardarCambios(r).editarFila).toMatchObject({ idComNuevo: 101, esReutilizadoNuevo: true, nNuevas: 0 })
    const reu = estadoInicial(datosEditar({ detalle: detalleEdicion({ esReutilizado: true, cantidad: 0 }) }))
    expect(fila(reu, 'bat')).toMatchObject({ eleccion: 'reutilizada', reutilizado: true })
  })

  it('cambiar de modelo deja las filas sin elegir', () => {
    const e = aplicar(conModelo('13'), nueva('bat'), { tipo: 'CAMBIAR_MODELO', modelo: '14' })
    expect(fila(e, 'bat')).toMatchObject({ eleccion: null, cantidad: 0 })
  })
  it('chasis «Nueva»: al elegir el color se activa la observacion', () => {
    const e = aplicar(conModelo('13'), nueva('cha'))
    expect(fila(e, 'cha').controles.observacion).toBe(false)
    const c = reducir(e, { tipo: 'CAMBIAR_SKU', prefijo: 'cha', idCom: 131 })
    expect(fila(c, 'cha').controles.observacion).toBe(true)
    const o = reducir(c, { tipo: 'PONER_OBSERVACION', prefijo: 'cha', texto: 'rayado' })
    expect(o).not.toBe(c)
    expect(fila(o, 'cha').observacion).toBe('rayado')
  })
})

describe('0.9.19 · ajustes: Nueva sin stock y marca «Solicitada»', () => {
  const TEXTO_1 = 'Sin stock: Batería. Pídela con «Solicitar pieza» o quítala con la ×.'

  it('Nueva sobre un SKU sin stock y sin pedir: avisa, muestra la zona y no deja confirmar; pedirla o volver lo arregla', () => {
    const n = reducir(conModelo('14'), nueva('bat')) // bati14: stock 0
    expect(filaNuevaSinStock(fila(n, 'bat'))).toBe(true)
    expect(zonaGuardarVisible(n)).toBe(true)
    expect(textoSinStock(n)).toBe(TEXTO_1)
    expect(reducir(n, { tipo: 'PEDIR_CONFIRMACION_GUARDAR' })).toBe(n)
    const pedida = reducir(n, { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'bat', descripcion: '' })
    expect(textoSinStock(pedida)).toBeNull()
    expect(textoSinStock(reducir(n, volver('bat')))).toBeNull()
  })

  it('varias filas Nueva sin stock: plural', () => {
    const catalogo = agrupados()
    catalogo.bat = [componente({ idCom: 101, tipo: 'bati13', stock: 0 })]
    catalogo.cam = [componente({ idCom: 121, tipo: 'cami13', stock: 0 })]
    const e = aplicar(conModelo('13', { agrupados: catalogo }), nueva('bat'), nueva('cam'))
    expect(textoSinStock(e)).toBe('Sin stock: Batería, Cámara. Pídelas con «Solicitar pieza» o quítalas con la ×.')
  })

  it('avisoAntesDeGuardar: primero el SKU que falta, luego el sin stock, separados por salto de línea', () => {
    const catalogo = agrupados()
    catalogo.bat = [componente({ idCom: 101, tipo: 'bati13', stock: 0 })]
    const e = aplicar(conModelo('13', { agrupados: catalogo }), nueva('cha'), nueva('bat'))
    expect(avisoAntesDeGuardar(e)).toBe(`Falta elegir el SKU de: Chasis.
${TEXTO_1}`)
    expect(avisoAntesDeGuardar(conModelo('13'))).toBeNull()
  })

  it('edición: una fila nueva con Nueva sobre un SKU sin stock avisa de elegir otro SKU', () => {
    const catalogo = agrupados()
    catalogo.cam = [componente({ idCom: 121, tipo: 'cami13', stock: 0 })]
    const e = reducir(estadoInicial(datosEditar({ agrupados: catalogo })), nueva('cam'))
    expect(filaNuevaSinStock(fila(e, 'cam'))).toBe(true)
    expect(zonaGuardarVisible(e)).toBe(true)
    expect(textoSinStock(e)).toBe('Sin stock: Cámara. Elige otro SKU o quítala con la ×.')
  })

  it('variante límite: Nueva con cantidad = stock y «Solicitar y descontar stock» → «Solicitada»; la × vuelve al principio', () => {
    const n = reducir(conModelo('13'), nueva('lcd')) // lcdi13: stock 1 → cantidad 1
    const s = reducir(n, { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'lcd', descripcion: '' })
    expect(fila(s, 'lcd').agotado).not.toBeNull()
    expect(marcaPieza(fila(s, 'lcd'))).toEqual({ tipo: 'solicitada', quitar: true })
    expect(fila(reducir(s, volver('lcd')), 'lcd')).toMatchObject({ eleccion: null, cantidad: 0, agotado: null })
  })
})
