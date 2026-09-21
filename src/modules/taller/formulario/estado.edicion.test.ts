import { describe, expect, it } from 'vitest'
import { agrupados, componente, detalleEdicion, solicitudAsignacion } from '../test/fabrica'
import {
  type AccionFormulario, type DatosEditar, type DatosNuevo, type EstadoFormulario, type FilaEstado,
  accionEditadaInvalida, anadirAccionHabilitado, botonDerecho, contadorAcciones, cuerpoGuardarAccion, cuerpoGuardarFila, estadoInicial,
  etiquetaImei, filaDeAccion, filaDeCuerpo, filaEditadaInvalida, filasVisibles, hayCambioEnFilaEditada, hayCambiosSinGuardar,
  planGuardarCambios, planTerminar, previsionStock, reducir, subFila, textoBotonGuardar, tituloPestana, zonaGuardarVisible,
} from './estado'

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
/** Edición de una acción "otro" (otroi13) con su texto original. */
function datosEditarAccion(parcial: Partial<DatosEditar> = {}): DatosEditar {
  return datosEditar({ detalle: detalleEdicion({ idCom: 161, cantidad: 0, observacion: 'Limpieza de altavoz' }), ...parcial })
}
function conModelo(modelo: string, parcial: Partial<DatosNuevo> = {}): EstadoFormulario {
  return reducir(estadoInicial(datosNuevo(parcial)), { tipo: 'CAMBIAR_MODELO', modelo })
}
function aplicar(estado: EstadoFormulario, ...acciones: AccionFormulario[]): EstadoFormulario {
  return acciones.reduce(reducir, estado)
}
function fila(estado: EstadoFormulario, prefijo: string): FilaEstado {
  const f = estado.filas.find((x) => x.prefijo === prefijo)
  if (!f) throw new Error(`no hay fila ${prefijo}`)
  return f
}
const FILA_VACIA = { esSolicitud: false, descripcionSolicitud: null, estadoSolicitud: null, enCamino: false }

describe('estado del formulario (3): modo edición', () => {
  it('editar pieza: fila en rol editada con SKU, cantidad, Reutilizado y observación originales y modelo bloqueado', () => {
    const e = estadoInicial(datosEditar({ detalle: detalleEdicion({ cantidad: 2, observacion: 'conector dañado' }) }))
    expect(e).toMatchObject({ modo: 'editar', categoria: 'R', idAsignacion: null, imei: IMEI, incidencia: null, modelo: '13', modeloBloqueado: true })
    expect(e.edicion).toEqual({
      idRep: 'R20260916_5', tipo: 'pieza', idTecOriginal: 4, updatedAt: '2026-09-16T07:02:00', textoAccionOriginal: null, idComAccion: null,
    })
    expect(filasVisibles(e)).toBe(true)
    expect(reducir(e, { tipo: 'CAMBIAR_MODELO', modelo: '14' })).toBe(e)
    const bat = fila(e, 'bat')
    expect(bat).toMatchObject({ rol: 'editada', idCom: 101, cantidad: 2, reutilizado: false, observacion: 'conector dañado' })
    expect(bat.original).toEqual({ idCom: 101, cantidad: 2, reutilizado: false, observacion: 'conector dañado' })
    // cantidad > 0: "Reutilizado" apagado; "+" según stock; "-" encendido
    expect(bat.controles).toEqual({ mas: true, menos: true, reutilizado: false, sku: true, observacion: true })
    expect(e.filas.filter((f) => f.rol === 'editada')).toHaveLength(1)
    expect(fila(e, 'lcd')).toMatchObject({ rol: 'normal', idCom: 111, original: null }) // el resto, filtrado por el modelo
    expect(etiquetaImei(e)).toBe(`IMEI: ${IMEI}  ·  Editando R20260916_5`)
    expect(tituloPestana(e)).toBe('Editar reparación — R20260916_5')
    expect(hayCambioEnFilaEditada(e)).toBe(false)
    expect(zonaGuardarVisible(e)).toBe(false)
    // si era reutilizada: "+" y "-" apagados y la casilla encendida
    const reutilizada = estadoInicial(datosEditar({ detalle: detalleEdicion({ esReutilizado: true, cantidad: 0 }) }))
    expect(fila(reutilizada, 'bat')).toMatchObject({ reutilizado: true, cantidad: 0 })
    expect(fila(reutilizada, 'bat').controles).toMatchObject({ mas: false, menos: false, reutilizado: true })
    // con stock 0, "+" apagado
    const sinStock = estadoInicial(datosEditar({ detalle: detalleEdicion({ idCom: 102 }) }))
    expect(sinStock.modelo).toBe('14')
    expect(fila(sinStock, 'bat').controles.mas).toBe(false)
    // un SKU que ya no está activo no pierde su fila
    const inactivo = estadoInicial(datosEditar({ detalle: detalleEdicion({ idCom: 104 }) }))
    expect(inactivo.modelo).toBe('12')
    expect(inactivo.modelos).toEqual(['12', '13', '13promax', '14'])
    expect(fila(inactivo, 'bat')).toMatchObject({ rol: 'editada', idCom: 104 })
    expect(fila(inactivo, 'bat').opciones.map((c) => c.idCom)).toEqual([104])
    // una G… solo tiene filas de glass y categoría G
    const glass = estadoInicial(datosEditar({ idRep: 'G20260916_7', detalle: detalleEdicion({ idCom: 141 }) }))
    expect(glass.categoria).toBe('G')
    expect(glass.filas.map((f) => f.prefijo)).toEqual(['g', 'mc'])
    expect(fila(glass, 'g').rol).toBe('editada')
  })

  it('editar acción: ninguna fila editada, línea precargada sin papelera', () => {
    const e = estadoInicial(datosEditarAccion())
    expect(e.edicion).toMatchObject({ tipo: 'accion', textoAccionOriginal: 'Limpieza de altavoz', idComAccion: 161 })
    expect(e.modelo).toBe('13') // el del SKU otroi13
    expect(e.modeloBloqueado).toBe(true)
    expect(e.filas.some((f) => f.rol === 'editada')).toBe(false)
    expect(e.otros).toEqual([{ id: 1, texto: 'Limpieza de altavoz', origen: 'editada', guardada: null, confirmando: false, guardando: false }])
    expect(e.siguienteIdAccion).toBe(2)
    expect(etiquetaImei(e)).toBe(`IMEI: ${IMEI}  ·  Editando acción R20260916_5`)
    // sin papelera ni "✓ Guardar": no se puede quitar ni pedir confirmación
    expect(reducir(e, { tipo: 'QUITAR_ACCION', id: 1 })).toBe(e)
    expect(reducir(e, { tipo: 'PEDIR_CONFIRMACION_ACCION', id: 1 })).toBe(e)
    expect(zonaGuardarVisible(e)).toBe(false)
    // texto distinto y no vacío = cambio; vacío = inválido (oculta la zona aunque haya otra cosa que guardar)
    const cambiada = reducir(e, { tipo: 'ESCRIBIR_ACCION', id: 1, texto: 'Limpieza de altavoz y micrófono' })
    expect(zonaGuardarVisible(cambiada)).toBe(true)
    expect(accionEditadaInvalida(cambiada)).toBe(false)
    const mismoTexto = reducir(cambiada, { tipo: 'ESCRIBIR_ACCION', id: 1, texto: ' Limpieza de altavoz ' })
    expect(zonaGuardarVisible(mismoTexto)).toBe(false)
    const vacia = aplicar(cambiada, { tipo: 'ESCRIBIR_ACCION', id: 1, texto: '  ' }, { tipo: 'SUMAR', prefijo: 'bat' })
    expect(accionEditadaInvalida(vacia)).toBe(true)
    expect(zonaGuardarVisible(vacia)).toBe(false)
    expect(anadirAccionHabilitado(vacia)).toBe(false)
  })

  it('ya reparados: todo deshabilitado y botón yaReparado, salvo la fila editada', () => {
    // 112 (lcdi14) es de OTRO modelo y 104 (bati12) está inactivo: cuentan igual; la batería es la fila editada y manda
    const e = estadoInicial(datosEditar({ yaReparados: [112, 104] }))
    const lcd = fila(e, 'lcd')
    expect(lcd.rol).toBe('yaReparado')
    expect(lcd.controles).toEqual({ mas: false, menos: false, reutilizado: false, sku: false, observacion: false })
    expect(botonDerecho(e, lcd)).toEqual({ tipo: 'yaReparado' })
    expect(reducir(e, { tipo: 'SUMAR', prefijo: 'lcd' })).toBe(e)
    expect(reducir(e, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'lcd', valor: true })).toBe(e)
    expect(fila(e, 'bat').rol).toBe('editada')
    expect(botonDerecho(e, fila(e, 'bat'))).toEqual({ tipo: 'ninguno' })
    expect(fila(e, 'cha').rol).toBe('normal')
    // solo existe en edición: el flujo nuevo no marca nada
    expect(conModelo('13').filas.every((f) => f.rol === 'normal')).toBe(true)
  })

  it('acciones ya reparadas bloqueadas y contadas en el badge', () => {
    const e = estadoInicial(datosEditar({ accionesYaReparadas: ['Limpieza de altavoz', 'Ajuste de botón'] }))
    expect(e.otros.map((a) => [a.id, a.texto, a.origen])).toEqual([[1, 'Limpieza de altavoz', 'yaReparada'], [2, 'Ajuste de botón', 'yaReparada']])
    expect(contadorAcciones(e)).toBe(2)
    expect(reducir(e, { tipo: 'ESCRIBIR_ACCION', id: 1, texto: 'otra' })).toBe(e)
    expect(reducir(e, { tipo: 'QUITAR_ACCION', id: 1 })).toBe(e)
    expect(zonaGuardarVisible(e)).toBe(false)
    // se pueden añadir líneas nuevas, con ids que siguen a los cargados
    const conNueva = aplicar(e, { tipo: 'ANADIR_ACCION' }, { tipo: 'ESCRIBIR_ACCION', id: 3, texto: 'Cambio de tornillos' })
    expect(conNueva.otros.map((a) => a.id)).toEqual([1, 2, 3])
    expect(contadorAcciones(conNueva)).toBe(3)
    expect(zonaGuardarVisible(conNueva)).toBe(true)
    // editando una acción, las ya reparadas van delante de la línea editada
    const editandoAccion = estadoInicial(datosEditarAccion({ accionesYaReparadas: ['Ajuste de botón'] }))
    expect(editandoAccion.otros.map((a) => a.origen)).toEqual(['yaReparada', 'editada'])
    expect(editandoAccion.siguienteIdAccion).toBe(3)
  })

  it('previsión de stock: mismo SKU devuelve lo original, SKU distinto no, Reutilizado no descuenta, tendencia baja/sube/igual', () => {
    const catalogo = agrupados()
    catalogo.bat = [...catalogo.bat, componente({ idCom: 107, tipo: 'bati13oem', stock: 2 })]
    const e = estadoInicial(datosEditar({ agrupados: catalogo })) // bati13: stock 5, cantidad original 1
    expect(previsionStock(e, fila(e, 'bat'))).toEqual({ texto: '5 → 5', tendencia: 'igual' })
    const mas = reducir(e, { tipo: 'SUMAR', prefijo: 'bat' })
    expect(previsionStock(mas, fila(mas, 'bat'))).toEqual({ texto: '5 → 4', tendencia: 'baja' })
    const menos = reducir(e, { tipo: 'RESTAR', prefijo: 'bat' })
    expect(previsionStock(menos, fila(menos, 'bat'))).toEqual({ texto: '5 → 6', tendencia: 'sube' })
    // "Reutilizado" no descuenta
    const reutilizada = reducir(menos, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: true })
    expect(previsionStock(reutilizada, fila(reutilizada, 'bat'))).toEqual({ texto: '5 → 6', tendencia: 'sube' })
    // otro SKU: no se le devuelve nada y se le descuenta la cantidad
    const otroSku = reducir(e, { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 107 })
    expect(previsionStock(otroSku, fila(otroSku, 'bat'))).toEqual({ texto: '2 → 1', tendencia: 'baja' })
    // si la original era reutilizada no hay nada que devolver
    const eraReutilizada = estadoInicial(datosEditar({ detalle: detalleEdicion({ esReutilizado: true, cantidad: 0 }) }))
    expect(previsionStock(eraReutilizada, fila(eraReutilizada, 'bat'))).toEqual({ texto: '5 → 5', tendencia: 'igual' })
    // solo la fila editada tiene previsión
    expect(previsionStock(e, fila(e, 'lcd'))).toBeNull()
    const nuevo = conModelo('13')
    expect(previsionStock(nuevo, fila(nuevo, 'bat'))).toBeNull()
    // "+" sigue limitado por el stock actual: no suma las unidades que se devolverían
    const alLimite = estadoInicial(datosEditar({ detalle: detalleEdicion({ idCom: 111 }) })) // lcdi13: stock 1, cantidad 1
    expect(reducir(alLimite, { tipo: 'SUMAR', prefijo: 'lcd' })).toBe(alLimite)
    // volver al componente ORIGINAL ni pone a 0 ni toca "+", aunque su stock actual (2) sea menor que la cantidad (3)
    const escaso = { ...catalogo, bat: [componente({ idCom: 101, tipo: 'bati13', stock: 2 }), componente({ idCom: 107, tipo: 'bati13oem', stock: 5 })] }
    const tres = estadoInicial(datosEditar({ agrupados: escaso, detalle: detalleEdicion({ cantidad: 3 }) }))
    const ida = reducir(tres, { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 107 })
    expect(fila(ida, 'bat')).toMatchObject({ idCom: 107, cantidad: 3 })
    const vuelta = reducir(ida, { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 101 })
    expect(fila(vuelta, 'bat')).toMatchObject({ idCom: 101, cantidad: 3 })
    expect(fila(vuelta, 'bat').controles.mas).toBe(fila(ida, 'bat').controles.mas)
    expect(hayCambioEnFilaEditada(vuelta)).toBe(false)
    // a un SKU que NO es el original y tiene menos stock que la cantidad, sí se pone a 0
    const aOtro = reducir(estadoInicial(datosEditar({ agrupados: catalogo, detalle: detalleEdicion({ cantidad: 3 }) })),
      { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 107 }) // bati13oem: stock 2 < 3
    expect(fila(aOtro, 'bat')).toMatchObject({ idCom: 107, cantidad: 0 })
  })

  it('cambio inválido oculta la zona y marca el contador', () => {
    const e = estadoInicial(datosEditar())
    expect(filaEditadaInvalida(e)).toBe(false)
    const aCero = reducir(e, { tipo: 'RESTAR', prefijo: 'bat' })
    expect(hayCambioEnFilaEditada(aCero)).toBe(true)
    expect(filaEditadaInvalida(aCero)).toBe(true)
    expect(zonaGuardarVisible(aCero)).toBe(false)
    expect(hayCambiosSinGuardar(aCero)).toBe(false) // cerrar así no pregunta: el cambio se pierde
    // ni aunque haya una fila nueva activa
    const conFilaNueva = reducir(aCero, { tipo: 'SUMAR', prefijo: 'lcd' })
    expect(zonaGuardarVisible(conFilaNueva)).toBe(false)
    // con "Reutilizado" el cambio vuelve a ser válido
    const valida = reducir(aCero, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: true })
    expect(filaEditadaInvalida(valida)).toBe(false)
    expect(zonaGuardarVisible(valida)).toBe(true)
    expect(reducir(aCero, { tipo: 'PEDIR_CONFIRMACION_GUARDAR' })).toBe(aCero)
  })

  it('cambio válido muestra "Guardar cambios" y el primer clic "✓  Confirmar terminar"', () => {
    const e = estadoInicial(datosEditar())
    expect(textoBotonGuardar(e)).toBe('Guardar cambios')
    const cambios: AccionFormulario[] = [
      { tipo: 'SUMAR', prefijo: 'bat' },
      { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: 'conector dañado' },
      { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 101 }, // el mismo: no es cambio
    ]
    expect(zonaGuardarVisible(reducir(e, cambios[0]))).toBe(true)
    expect(zonaGuardarVisible(reducir(e, cambios[1]))).toBe(true)
    expect(zonaGuardarVisible(reducir(e, cambios[2]))).toBe(false)
    // deshacer el cambio vuelve a ocultarla
    expect(zonaGuardarVisible(aplicar(e, { tipo: 'SUMAR', prefijo: 'bat' }, { tipo: 'RESTAR', prefijo: 'bat' }))).toBe(false)
    // borrar una observación original es un cambio
    const conNota = estadoInicial(datosEditar({ detalle: detalleEdicion({ observacion: 'conector dañado' }) }))
    expect(zonaGuardarVisible(reducir(conNota, { tipo: 'BORRAR_OBSERVACION', prefijo: 'bat' }))).toBe(true)
    const primerClic = aplicar(e, { tipo: 'SUMAR', prefijo: 'bat' }, { tipo: 'PEDIR_CONFIRMACION_GUARDAR' })
    expect(textoBotonGuardar(primerClic)).toBe('✓  Confirmar terminar') // también en edición
    expect(reducir(primerClic, { tipo: 'INICIO_GUARDADO' }).guardado.enCurso).toBe(true)
  })

  it('fila nueva activa en edición muestra la zona y no ofrece "✓ Guardar fila" ni sub-fila', () => {
    const e = estadoInicial(datosEditar({ detalle: detalleEdicion({ idCom: 102 }) })) // modelo 14; lcdi14 tiene stock 3
    const activa = aplicar(e, { tipo: 'SUMAR', prefijo: 'lcd' }, { tipo: 'SUMAR', prefijo: 'lcd' }, { tipo: 'SUMAR', prefijo: 'lcd' })
    expect(fila(activa, 'lcd').cantidad).toBe(3) // en el límite la cantidad simplemente no pasa del stock
    expect(reducir(activa, { tipo: 'SUMAR', prefijo: 'lcd' })).toBe(activa)
    expect(zonaGuardarVisible(activa)).toBe(true)
    expect(botonDerecho(activa, fila(activa, 'lcd'))).toEqual({ tipo: 'ninguno' })
    expect(subFila(activa, fila(activa, 'lcd'))).toEqual({ tipo: 'oculta' })
    expect(reducir(activa, { tipo: 'PEDIR_CONFIRMACION_FILA', prefijo: 'lcd' })).toBe(activa)
    expect(reducir(activa, { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'lcd', descripcion: '' })).toBe(activa)
    // la fila editada (bati14, stock 0) tampoco tiene sub-fila de "sin stock"
    expect(subFila(activa, fila(activa, 'bat'))).toEqual({ tipo: 'oculta' })
  })

  it('hayCambiosSinGuardar solo en editar', () => {
    const editando = reducir(estadoInicial(datosEditar()), { tipo: 'SUMAR', prefijo: 'bat' })
    expect(hayCambiosSinGuardar(editando)).toBe(true)
    expect(hayCambiosSinGuardar(estadoInicial(datosEditar()))).toBe(false)
    const nuevo = reducir(conModelo('13'), { tipo: 'SUMAR', prefijo: 'bat' })
    expect(zonaGuardarVisible(nuevo)).toBe(true)
    expect(hayCambiosSinGuardar(nuevo)).toBe(false) // el flujo nuevo nunca pregunta: lo cubre el borrador
  })
})

describe('estado del formulario (3): cuerpos de las llamadas', () => {
  it('cuerpoGuardarFila y cuerpoGuardarAccion con incidencia y técnico de la sesión', () => {
    const e = aplicar(conModelo('13', { incidencia: 'R20260910_2' }),
      { tipo: 'SUMAR', prefijo: 'bat' }, { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: 'conector dañado' },
      { tipo: 'ANADIR_ACCION' }, { tipo: 'ESCRIBIR_ACCION', id: 1, texto: '  Limpieza de altavoz ' })
    expect(filaDeCuerpo(fila(e, 'bat'))).toEqual({
      idCom: 101, cantidad: 1, reutilizado: false, observacion: 'conector dañado', prefijo: 'bat', ...FILA_VACIA,
    })
    expect(filaDeAccion(161, ' Ajuste ')).toEqual({ idCom: 161, cantidad: 0, reutilizado: false, observacion: 'Ajuste', prefijo: 'otro', ...FILA_VACIA })
    expect(cuerpoGuardarFila(e, 'bat', 4)).toEqual({
      filas: [{ idCom: 101, cantidad: 1, reutilizado: false, observacion: 'conector dañado', prefijo: 'bat', ...FILA_VACIA }],
      imei: IMEI, idTec: 4, idRepAnterior: 'R20260910_2',
    })
    expect(cuerpoGuardarAccion(e, 1, 4)).toEqual({
      filas: [{ idCom: 161, cantidad: 0, reutilizado: false, observacion: 'Limpieza de altavoz', prefijo: 'otro', ...FILA_VACIA }],
      imei: IMEI, idTec: 4, idRepAnterior: 'R20260910_2',
    })
    // sin incidencia, sin observación: null
    const sinNada = reducir(conModelo('13'), { tipo: 'MARCAR_REUTILIZADO', prefijo: 'cha', valor: true })
    expect(cuerpoGuardarFila(sinNada, 'cha', 4)).toEqual({
      filas: [{ idCom: 131, cantidad: 0, reutilizado: true, observacion: null, prefijo: 'cha', ...FILA_VACIA }],
      imei: IMEI, idTec: 4, idRepAnterior: null,
    })
    // acción inexistente, vacía o sin componente "otro" para el modelo
    expect(cuerpoGuardarAccion(e, 99, 4)).toBeNull()
    expect(cuerpoGuardarAccion(reducir(conModelo('13'), { tipo: 'ANADIR_ACCION' }), 1, 4)).toBeNull()
    expect(cuerpoGuardarAccion(reducir(e, { tipo: 'CAMBIAR_MODELO', modelo: '13promax' }), 1, 4)).toBeNull()
    expect(() => cuerpoGuardarFila(e, 'no-existe', 4)).toThrow()
  })

  it('planTerminar: orden de agotados, cantidad 0 en sin stock y stock en límite, descripción null', () => {
    const catalogo = agrupados()
    catalogo.cam = [componente({ idCom: 121, tipo: 'cami13', stock: 0, stockMinimo: 1 })]
    const e = aplicar(conModelo('13', { agrupados: catalogo }),
      // se confirman en orden inverso al de las filas: el plan sigue el orden de FILAS (lcd antes que cam)
      { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'cam', descripcion: 'cámara trasera' },
      { tipo: 'SUMAR', prefijo: 'lcd' }, { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'lcd', descripcion: '' },
      { tipo: 'SUMAR', prefijo: 'bat' })
    const plan = planTerminar(e, 4)
    expect(plan.agotados).toEqual([
      { prefijo: 'lcd', cuerpo: { idCom: 111, cantidad: 1, descripcion: null } }, // límite: el stock
      { prefijo: 'cam', cuerpo: { idCom: 121, cantidad: 0, descripcion: 'cámara trasera' } }, // sin stock: 0
    ])
    // las filas con agotado nuevo no van en completa
    expect(plan.completa).toEqual({
      filas: [{ idCom: 101, cantidad: 1, reutilizado: false, observacion: null, prefijo: 'bat', ...FILA_VACIA }],
      imei: IMEI, idTec: 4, idRepAnterior: null, idAsignacion: 'A20260916_1', categoria: null,
    })
  })

  it('planTerminar no repite agotados registrados', () => {
    const catalogo = agrupados()
    catalogo.cam = [componente({ idCom: 121, tipo: 'cami13', stock: 0, stockMinimo: 1 })]
    const e = aplicar(conModelo('13', { agrupados: catalogo }),
      { tipo: 'SUMAR', prefijo: 'lcd' }, { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'lcd', descripcion: '' },
      { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'cam', descripcion: '' },
      { tipo: 'SUMAR', prefijo: 'bat' })
    expect(planTerminar(e, 4).agotados.map((a) => a.prefijo)).toEqual(['lcd', 'cam'])
    // el 1.º se registró y el 2.º falló: el reintento continúa con los que faltan
    const trasElPrimero = aplicar(e, { tipo: 'AGOTADO_REGISTRADO', prefijo: 'lcd' }, { tipo: 'FALLO_GUARDADO' })
    expect(planTerminar(trasElPrimero, 4).agotados.map((a) => a.prefijo)).toEqual(['cam'])
    // todos registrados y falló completa: el reintento solo envía completa, sin la fila agotada
    const trasTodos = reducir(trasElPrimero, { tipo: 'AGOTADO_REGISTRADO', prefijo: 'cam' })
    const plan = planTerminar(trasTodos, 4)
    expect(plan.agotados).toEqual([])
    expect(plan.completa?.filas.map((f) => f.idCom)).toEqual([101])
  })

  it('planTerminar: solo agotados → completa null, también si ya estaban registrados', () => {
    const e = reducir(conModelo('14'), { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'bat', descripcion: 'batería hinchada' })
    expect(planTerminar(e, 4)).toEqual({
      agotados: [{ prefijo: 'bat', cuerpo: { idCom: 102, cantidad: 0, descripcion: 'batería hinchada' } }],
      completa: null, // la asignación queda abierta con su solicitud
    })
    const registrado = reducir(e, { tipo: 'AGOTADO_REGISTRADO', prefijo: 'bat' })
    expect(planTerminar(registrado, 4)).toEqual({ agotados: [], completa: null })
  })

  it('planTerminar: filas vacías con filas guardadas → completa con filas []', () => {
    const e = aplicar(conModelo('13'),
      { tipo: 'SUMAR', prefijo: 'bat' }, { tipo: 'PEDIR_CONFIRMACION_FILA', prefijo: 'bat' }, { tipo: 'INICIO_GUARDAR_FILA', prefijo: 'bat' },
      { tipo: 'FILA_GUARDADA', prefijo: 'bat', idRep: 'R20260916_9', fecha: '16/09 09:15' },
      { tipo: 'ANADIR_ACCION' }, { tipo: 'ESCRIBIR_ACCION', id: 1, texto: 'Limpieza de altavoz' },
      { tipo: 'PEDIR_CONFIRMACION_ACCION', id: 1 }, { tipo: 'INICIO_GUARDAR_ACCION', id: 1 },
      { tipo: 'ACCION_GUARDADA', id: 1, idRep: 'R20260916_10', fecha: '16/09 09:20' })
    // ni la fila guardada ni la acción guardada se reenvían; completa vacía es lo que cierra la asignación
    expect(planTerminar(e, 4)).toEqual({
      agotados: [],
      completa: { filas: [], imei: IMEI, idTec: 4, idRepAnterior: null, idAsignacion: 'A20260916_1', categoria: null },
    })
  })

  it('planTerminar incluye la fila de solicitud con Reutilizado y las acciones pendientes', () => {
    const e = aplicar(estadoInicial(datosNuevo({ incidencia: 'R20260910_2', solicitudes: [solicitudAsignacion(), solicitudAsignacion({ idCom: 112 })] })),
      { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: true },
      { tipo: 'ANADIR_ACCION' }, { tipo: 'ESCRIBIR_ACCION', id: 1, texto: ' Limpieza de altavoz ' },
      { tipo: 'ANADIR_ACCION' }) // la segunda línea, vacía, no se envía
    const plan = planTerminar(e, 4)
    expect(plan.agotados).toEqual([]) // una solicitud del servidor no es un agotado nuevo
    expect(plan.completa).toEqual({
      filas: [
        { idCom: 102, cantidad: 0, reutilizado: true, observacion: null, prefijo: 'bat', ...FILA_VACIA }, // fila normal: esSolicitud false
        { idCom: 162, cantidad: 0, reutilizado: false, observacion: 'Limpieza de altavoz', prefijo: 'otro', ...FILA_VACIA },
      ],
      imei: IMEI, idTec: 4, idRepAnterior: 'R20260910_2', idAsignacion: 'A20260916_1', categoria: null,
    })
    // la solicitud de pantalla, sin tocar, no va en ninguna parte
    expect(plan.completa?.filas.some((f) => f.idCom === 112)).toBe(false)
  })

  it('planTerminar en glass no lleva categoria', () => {
    const e = aplicar(estadoInicial(datosNuevo({ modo: 'glass', idAsignacion: 'AG20260916_2' })),
      { tipo: 'CAMBIAR_MODELO', modelo: '13' }, { tipo: 'SUMAR', prefijo: 'g' })
    expect(planTerminar(e, 6).completa).toEqual({
      filas: [{ idCom: 141, cantidad: 1, reutilizado: false, observacion: null, prefijo: 'g', ...FILA_VACIA }],
      imei: IMEI, idTec: 6, idRepAnterior: null, idAsignacion: 'AG20260916_2', categoria: null,
    })
    expect(cuerpoGuardarFila(e, 'g', 6)).not.toHaveProperty('categoria')
  })

  it('planGuardarCambios: cuatro pasos, idTec original, categoria G solo si idRep empieza por G, sin idAsignacion ni idRepAnterior', () => {
    // pieza: fila editada + fila nueva + acción nueva
    const pieza = aplicar(estadoInicial(datosEditar()),
      { tipo: 'SUMAR', prefijo: 'bat' }, { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: 'conector dañado' },
      { tipo: 'MARCAR_REUTILIZADO', prefijo: 'cam', valor: true },
      { tipo: 'ANADIR_ACCION' }, { tipo: 'ESCRIBIR_ACCION', id: 1, texto: ' Limpieza de altavoz ' })
    expect(planGuardarCambios(pieza)).toEqual({
      editarAccion: null,
      editarFila: { idComNuevo: 101, esReutilizadoNuevo: false, observacionNueva: 'conector dañado', nNuevas: 2, updatedAt: '2026-09-16T07:02:00' },
      completaFilas: {
        filas: [{ idCom: 121, cantidad: 0, reutilizado: true, observacion: null, prefijo: 'cam', ...FILA_VACIA }],
        imei: IMEI, idTec: 4, idRepAnterior: null, idAsignacion: null, categoria: null, // idTec = el técnico ORIGINAL (detalle.idTec)
      },
      completaAcciones: {
        filas: [{ idCom: 161, cantidad: 0, reutilizado: false, observacion: 'Limpieza de altavoz', prefijo: 'otro', ...FILA_VACIA }],
        imei: IMEI, idTec: 4, idRepAnterior: null, idAsignacion: null, categoria: null,
      },
    })
    // sin cambios no hay nada que enviar; la fila editada nunca va en completa
    expect(planGuardarCambios(estadoInicial(datosEditar()))).toEqual({ editarAccion: null, editarFila: null, completaFilas: null, completaAcciones: null })
    // acción editada: paso 0 con nNuevas 0 y sin Reutilizado; su línea no se reenvía como acción nueva
    const accion = reducir(estadoInicial(datosEditarAccion()), { tipo: 'ESCRIBIR_ACCION', id: 1, texto: ' Limpieza de altavoz y micrófono ' })
    expect(planGuardarCambios(accion)).toEqual({
      editarAccion: { idComNuevo: 161, esReutilizadoNuevo: false, observacionNueva: 'Limpieza de altavoz y micrófono', nNuevas: 0, updatedAt: '2026-09-16T07:02:00' },
      editarFila: null, completaFilas: null, completaAcciones: null,
    })
    // edición de una G…: categoria 'G' en los dos completa
    const glass = aplicar(estadoInicial(datosEditar({ idRep: 'G20260916_7', detalle: detalleEdicion({ idCom: 141, idTec: 6 }) })),
      { tipo: 'SUMAR', prefijo: 'mc' }, { tipo: 'ANADIR_ACCION' }, { tipo: 'ESCRIBIR_ACCION', id: 1, texto: 'Limpieza de marco' })
    const planGlass = planGuardarCambios(glass)
    expect(planGlass.editarFila).toBeNull()
    expect(planGlass.completaFilas).toMatchObject({ idTec: 6, categoria: 'G', idAsignacion: null, idRepAnterior: null })
    expect(planGlass.completaAcciones).toMatchObject({ idTec: 6, categoria: 'G', idAsignacion: null, idRepAnterior: null })
    // las acciones "✓ Ya reparada" no se reenvían
    const yaReparadas = estadoInicial(datosEditar({ accionesYaReparadas: ['Limpieza de altavoz'] }))
    expect(planGuardarCambios(yaReparadas).completaAcciones).toBeNull()
    // fuera de edición no hay plan
    expect(planGuardarCambios(conModelo('13'))).toEqual({ editarAccion: null, editarFila: null, completaFilas: null, completaAcciones: null })
  })
})
