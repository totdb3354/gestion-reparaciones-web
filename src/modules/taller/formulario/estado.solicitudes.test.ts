import { describe, expect, it } from 'vitest'
import { agrupados, componente, solicitudAsignacion } from '../test/fabrica'
import {
  type AccionFormulario, type DatosNuevo, type EstadoFormulario, type FilaEstado, type OtraAccion,
  TEXTO_LIMITE, TEXTO_SIN_STOCK, accionPideConfirmacion, anadirAccionHabilitado, botonDerecho, contadorAcciones, estadoInicial,
  filaActiva, filasVisibles, idComOtro, otrasAccionesVisible, reducir, subFila, textoBotonGuardar, zonaGuardarVisible,
} from './estado'

const IMEI = '355400000000111'

function datosNuevo(parcial: Partial<DatosNuevo> = {}): DatosNuevo {
  return {
    modo: 'nuevo', idAsignacion: 'A20260916_1', imei: IMEI, agrupados: agrupados(), solicitudes: [], incidencia: null,
    modeloTelefono: null, ...parcial,
  }
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
function accion(estado: EstadoFormulario, posicion: number): OtraAccion {
  const a = estado.otros[posicion - 1]
  if (!a) throw new Error(`no hay acción ${posicion}`)
  return a
}
/** Fila de batería activa (contador 1) con el primer clic de "✓ Guardar fila" ya dado. */
function batConfirmando(): EstadoFormulario {
  return aplicar(conModelo('13'), { tipo: 'SUMAR', prefijo: 'bat' }, { tipo: 'PEDIR_CONFIRMACION_FILA', prefijo: 'bat' })
}
function batGuardada(): EstadoFormulario {
  return aplicar(batConfirmando(),
    { tipo: 'INICIO_GUARDAR_FILA', prefijo: 'bat' },
    { tipo: 'FILA_GUARDADA', prefijo: 'bat', idRep: 'R20260916_9', fecha: '16/09 09:15' })
}
/** Una línea de acción escrita y, si se pide, guardada. */
function conAccion(texto: string, guardar = false): EstadoFormulario {
  const escrita = aplicar(conModelo('13'), { tipo: 'ANADIR_ACCION' }, { tipo: 'ESCRIBIR_ACCION', id: 1, texto })
  if (!guardar) return escrita
  return aplicar(escrita,
    { tipo: 'PEDIR_CONFIRMACION_ACCION', id: 1 },
    { tipo: 'INICIO_GUARDAR_ACCION', id: 1 },
    { tipo: 'ACCION_GUARDADA', id: 1, idRep: 'R20260916_10', fecha: '16/09 09:20' })
}

describe('estado del formulario (2): solicitudes ya guardadas', () => {
  it('solicitud pendiente bloquea la fila con Reutilizado y observación habilitados', () => {
    const e = estadoInicial(datosNuevo({ solicitudes: [solicitudAsignacion({ descripcionSolicitud: ' batería hinchada ' })] }))
    const bat = fila(e, 'bat')
    expect(bat).toMatchObject({ idCom: 102, cantidad: 0, reutilizado: false, agotado: null, recibidoPendienteUso: false })
    expect(bat.solicitud).toEqual({ estado: 'pendiente', descripcion: 'batería hinchada' })
    expect(bat.controles).toEqual({ mas: false, menos: false, reutilizado: true, sku: false, observacion: true })
    expect(botonDerecho(e, bat)).toEqual({ tipo: 'ninguno' })
    expect(subFila(e, bat)).toEqual({
      tipo: 'confirmada', texto: '✓  Solicitud de reposición pendiente — batería hinchada', lapizHabilitado: false,
    })
    expect(filaActiva(bat)).toBe(false)
    // ni contador ni SKU; la observación sí
    expect(reducir(e, { tipo: 'SUMAR', prefijo: 'bat' })).toBe(e)
    expect(reducir(e, { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 101 })).toBe(e)
    expect(fila(reducir(e, { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: 'avisado' }), 'bat').observacion).toBe('avisado')
    // el lápiz de una solicitud del servidor no edita ni cancela nada
    expect(reducir(e, { tipo: 'EDITAR_DESCRIPCION_AGOTADO', prefijo: 'bat', descripcion: 'otra' })).toBe(e)
    expect(reducir(e, { tipo: 'CANCELAR_AGOTADO', prefijo: 'bat' })).toBe(e)
  })

  it('solicitud en camino deshabilita Reutilizado y muestra "⚠ En camino"', () => {
    const e = estadoInicial(datosNuevo({ solicitudes: [solicitudAsignacion({ enCamino: true })] }))
    const bat = fila(e, 'bat')
    expect(bat.solicitud).toEqual({ estado: 'enCamino', descripcion: null })
    expect(bat.controles).toEqual({ mas: false, menos: false, reutilizado: false, sku: false, observacion: true })
    expect(botonDerecho(e, bat)).toEqual({ tipo: 'enCamino' })
    expect(subFila(e, bat)).toEqual({ tipo: 'confirmada', texto: '✓  Solicitud de reposición pendiente', lapizHabilitado: false })
    expect(reducir(e, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: true })).toBe(e)
  })

  it('gestionada con stock deja la fila normal con "✓ Recibido"', () => {
    // lcdi13 tiene stock 1; "recibido" se evalúa ANTES que enCamino
    const e = estadoInicial(datosNuevo({ solicitudes: [solicitudAsignacion({ idCom: 111, estadoSolicitud: 'GESTIONADA', enCamino: true })] }))
    const lcd = fila(e, 'lcd')
    expect(lcd).toMatchObject({ idCom: 111, solicitud: null, agotado: null, recibidoPendienteUso: true })
    expect(lcd.controles).toEqual({ mas: true, menos: false, reutilizado: true, sku: true, observacion: true })
    expect(botonDerecho(e, lcd)).toEqual({ tipo: 'recibido' })
    expect(subFila(e, lcd)).toEqual({ tipo: 'oculta' })
    expect(e.modelo).toBe('13')
    expect(e.modeloBloqueado).toBe(false) // una recibida no bloquea el combo
    expect(zonaGuardarVisible(e)).toBe(false)
  })

  it('gestionada sin stock se trata como pendiente', () => {
    const pendiente = estadoInicial(datosNuevo({ solicitudes: [solicitudAsignacion({ estadoSolicitud: 'GESTIONADA' })] })) // bati14: stock 0
    expect(fila(pendiente, 'bat').solicitud).toEqual({ estado: 'pendiente', descripcion: null })
    expect(fila(pendiente, 'bat').recibidoPendienteUso).toBe(false)
    const enCamino = estadoInicial(datosNuevo({ solicitudes: [solicitudAsignacion({ estadoSolicitud: 'GESTIONADA', enCamino: true })] }))
    expect(fila(enCamino, 'bat').solicitud?.estado).toBe('enCamino')
  })

  it('rechazada solo preselecciona el SKU y deja el combo de modelo libre', () => {
    const catalogo = agrupados()
    catalogo.bat = [componente({ idCom: 108, tipo: 'bati14alta', stock: 3 }), ...catalogo.bat]
    const e = estadoInicial(datosNuevo({ agrupados: catalogo, solicitudes: [solicitudAsignacion({ estadoSolicitud: 'RECHAZADA' })] }))
    const bat = fila(e, 'bat')
    expect(e.modelo).toBe('14')
    expect(e.modeloBloqueado).toBe(false)
    expect(e.tieneSolicitudesIniciales).toBe(true)
    expect(bat.opciones.map((c) => c.idCom)).toEqual([108, 102])
    expect(bat.idCom).toBe(102) // por defecto habría salido 108, que tiene stock
    expect(bat.solicitud).toBeNull()
    expect(bat.controles).toEqual({ mas: false, menos: false, reutilizado: true, sku: true, observacion: true })
    // ninguna marca de rechazo: la fila vuelve a ofrecer "Solicitar pieza"
    expect(subFila(e, bat)).toEqual({ tipo: 'sinStock' })
    expect(botonDerecho(e, bat)).toEqual({ tipo: 'ninguno' })
    expect(reducir(e, { tipo: 'CAMBIAR_MODELO', modelo: '13' }).modelo).toBe('13')
  })

  it('el modelo sale del SKU de la primera solicitud deducible y se bloquea solo con solicitud activa', () => {
    const e = estadoInicial(datosNuevo({
      modeloTelefono: '14', // no se usa: ya hay modelo por las solicitudes
      solicitudes: [solicitudAsignacion({ idCom: 9999 }), solicitudAsignacion({ idCom: 111 }), solicitudAsignacion({ idCom: 102 })],
    }))
    expect(e.modelo).toBe('13') // el de lcdi13; la 9999 no se deduce y la de bati14 llega después
    expect(e.modeloBloqueado).toBe(true)
    expect(reducir(e, { tipo: 'CAMBIAR_MODELO', modelo: '14' })).toBe(e)
    // la solicitud de otro modelo no se pierde: su SKU se añade a las opciones de su fila
    expect(fila(e, 'bat')).toMatchObject({ idCom: 102, solicitud: { estado: 'pendiente', descripcion: null } })
    expect(fila(e, 'bat').opciones.map((c) => c.idCom)).toEqual([101, 102])
  })

  it('las solicitudes se reaplican tras fijar el modelo', () => {
    const e = estadoInicial(datosNuevo({ solicitudes: [solicitudAsignacion({ idCom: 111 })] }))
    expect(e.modelo).toBe('13')
    expect(fila(e, 'lcd').solicitud).toEqual({ estado: 'pendiente', descripcion: null }) // fijar el modelo no la borró
    expect(fila(e, 'lcd').opciones.map((c) => c.idCom)).toEqual([111])
    expect(fila(e, 'bat').opciones.map((c) => c.idCom)).toEqual([101]) // el resto, filtrado por el modelo
    expect(fila(e, 'bat').solicitud).toBeNull()
  })

  it('con solicitudes y sin modelo deducible las filas quedan visibles sin filtro', () => {
    const catalogo = agrupados()
    catalogo.bat = [...catalogo.bat, componente({ idCom: 109, tipo: 'batuniversal', stock: 0 })]
    const solicitudes = [solicitudAsignacion({ idCom: 109 })]
    const e = estadoInicial(datosNuevo({ agrupados: catalogo, solicitudes }))
    expect(e.modelo).toBeNull()
    expect(e.tieneSolicitudesIniciales).toBe(true)
    expect(filasVisibles(e)).toBe(true)
    expect(e.modeloBloqueado).toBe(true) // hay una solicitud activa
    expect(fila(e, 'bat')).toMatchObject({ idCom: 109, solicitud: { estado: 'pendiente', descripcion: null } })
    expect(fila(e, 'lcd').opciones.map((c) => c.idCom)).toEqual([111, 112]) // todos los activos
    // si el teléfono trae modelo, entra después y la solicitud sigue en su fila
    const conTelefono = estadoInicial(datosNuevo({ agrupados: catalogo, solicitudes, modeloTelefono: '13' }))
    expect(conTelefono.modelo).toBe('13')
    expect(conTelefono.modeloBloqueado).toBe(true)
    expect(fila(conTelefono, 'bat')).toMatchObject({ idCom: 109, solicitud: { estado: 'pendiente', descripcion: null } })
    expect(fila(conTelefono, 'lcd').opciones.map((c) => c.idCom)).toEqual([111])
  })

  it('"✓ Recibido" pasa a "✓ Guardar fila" al activar y no vuelve al desactivar', () => {
    const e = estadoInicial(datosNuevo({ solicitudes: [solicitudAsignacion({ idCom: 111, estadoSolicitud: 'GESTIONADA' })] }))
    // un cambio que no activa la fila no apaga el indicador
    const conNota = reducir(e, { tipo: 'PONER_OBSERVACION', prefijo: 'lcd', texto: 'llegó hoy' })
    expect(botonDerecho(conNota, fila(conNota, 'lcd'))).toEqual({ tipo: 'recibido' })
    const activa = reducir(e, { tipo: 'SUMAR', prefijo: 'lcd' })
    expect(botonDerecho(activa, fila(activa, 'lcd'))).toEqual({ tipo: 'guardarFila', texto: '✓ Guardar fila', deshabilitado: false })
    const inactiva = reducir(activa, { tipo: 'RESTAR', prefijo: 'lcd' })
    expect(botonDerecho(inactiva, fila(inactiva, 'lcd'))).toEqual({ tipo: 'ninguno' })
    expect(fila(inactiva, 'lcd').recibidoPendienteUso).toBe(false)
  })

  it('"✓ Recibido" se apaga al cambiar a un modelo sin SKU del tipo', () => {
    const e = estadoInicial(datosNuevo({ solicitudes: [solicitudAsignacion({ idCom: 121, estadoSolicitud: 'GESTIONADA' })] })) // cami13
    expect(botonDerecho(e, fila(e, 'cam'))).toEqual({ tipo: 'recibido' })
    const sinSku = reducir(e, { tipo: 'CAMBIAR_MODELO', modelo: '14' }) // no hay cámara del 14
    expect(fila(sinSku, 'cam').recibidoPendienteUso).toBe(false)
    expect(botonDerecho(sinSku, fila(sinSku, 'cam'))).toEqual({ tipo: 'ninguno' })
    const deVuelta = reducir(sinSku, { tipo: 'CAMBIAR_MODELO', modelo: '13' })
    expect(botonDerecho(deVuelta, fila(deVuelta, 'cam'))).toEqual({ tipo: 'ninguno' }) // ya no vuelve
    // si el modelo nuevo sí tiene SKU del tipo, el indicador sobrevive al reseteo
    const lcd = estadoInicial(datosNuevo({ solicitudes: [solicitudAsignacion({ idCom: 111, estadoSolicitud: 'GESTIONADA' })] }))
    const otroModelo = reducir(lcd, { tipo: 'CAMBIAR_MODELO', modelo: '14' })
    expect(botonDerecho(otroModelo, fila(otroModelo, 'lcd'))).toEqual({ tipo: 'recibido' })
  })

  it('marcar Reutilizado en fila con solicitud pendiente la activa', () => {
    const e = estadoInicial(datosNuevo({ solicitudes: [solicitudAsignacion()] }))
    const marcada = reducir(e, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: true })
    expect(fila(marcada, 'bat').reutilizado).toBe(true)
    expect(filaActiva(fila(marcada, 'bat'))).toBe(true)
    expect(zonaGuardarVisible(marcada)).toBe(true)
    expect(botonDerecho(marcada, fila(marcada, 'bat'))).toEqual({ tipo: 'ninguno' }) // nunca "✓ Guardar fila" con solicitud activa
    expect(reducir(marcada, { tipo: 'PEDIR_CONFIRMACION_FILA', prefijo: 'bat' })).toBe(marcada)
    // al desmarcar, "+" sigue apagado: la fila sigue siendo de solicitud
    const desmarcada = reducir(marcada, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: false })
    expect(fila(desmarcada, 'bat').controles).toEqual({ mas: false, menos: false, reutilizado: true, sku: false, observacion: true })
    expect(zonaGuardarVisible(desmarcada)).toBe(false)
  })
})

describe('estado del formulario (2): sub-fila de agotado y solicitud local', () => {
  it('subFila: sin stock, límite, oculta con Reutilizado, oculta en editar', () => {
    expect(TEXTO_SIN_STOCK).toBe('⚠  Sin stock disponible. Solicita la pieza para que el admin gestione el pedido.')
    expect(TEXTO_LIMITE).toBe('⚠  Stock agotado. Puedes descontar los componentes fallidos y solicitar reposición.')
    // sin stock: se evalúa ya al pintar la fila por primera vez
    const catorce = conModelo('14')
    expect(subFila(catorce, fila(catorce, 'bat'))).toEqual({ tipo: 'sinStock' })
    // la variante sin stock no mira "Reutilizado"
    const reutilizadaSinStock = reducir(catorce, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: true })
    expect(subFila(reutilizadaSinStock, fila(reutilizadaSinStock, 'bat'))).toEqual({ tipo: 'sinStock' })
    // límite: contador = stock (lcdi13 tiene 1), con N = stock del SKU
    const trece = conModelo('13')
    expect(subFila(trece, fila(trece, 'lcd'))).toEqual({ tipo: 'oculta' })
    const enLimite = reducir(trece, { tipo: 'SUMAR', prefijo: 'lcd' })
    expect(subFila(enLimite, fila(enLimite, 'lcd'))).toEqual({ tipo: 'limite', stock: 1 })
    const conMargen = reducir(trece, { tipo: 'SUMAR', prefijo: 'bat' })
    expect(subFila(conMargen, fila(conMargen, 'bat'))).toEqual({ tipo: 'oculta' })
    // con "Reutilizado" y stock no hay sub-fila
    const reutilizada = reducir(trece, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'lcd', valor: true })
    expect(subFila(reutilizada, fila(reutilizada, 'lcd'))).toEqual({ tipo: 'oculta' })
    // fila sin SKU para el modelo
    expect(subFila(catorce, fila(catorce, 'cam'))).toEqual({ tipo: 'oculta' })
    // en modo editar no existe nunca, ni se puede confirmar
    const editando: EstadoFormulario = { ...catorce, modo: 'editar' }
    expect(subFila(editando, fila(editando, 'bat'))).toEqual({ tipo: 'oculta' })
    expect(reducir(editando, { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'bat', descripcion: '' })).toBe(editando)
  })

  it('confirmar agotado bloquea la fila, borra la observación y conserva la cantidad en límite', () => {
    const enLimite = aplicar(conModelo('13'),
      { tipo: 'SUMAR', prefijo: 'lcd' },
      { tipo: 'PONER_OBSERVACION', prefijo: 'lcd', texto: 'pantalla con líneas' })
    const e = reducir(enLimite, { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'lcd', descripcion: '  negra original \n' })
    const lcd = fila(e, 'lcd')
    expect(lcd.agotado).toEqual({ descripcion: 'negra original', registrado: false })
    expect(lcd.cantidad).toBe(1) // = stock: lo que se descontará
    expect(lcd.observacion).toBeNull()
    expect(lcd.controles).toEqual({ mas: false, menos: false, reutilizado: false, sku: false, observacion: false })
    expect(lcd.solicitud).toBeNull()
    expect(botonDerecho(e, lcd)).toEqual({ tipo: 'ninguno' }) // no ofrece "✓ Guardar fila"
    expect(filaActiva(lcd)).toBe(true)
    expect(e.revision).toBe(enLimite.revision + 1)
    for (const a of [
      { tipo: 'RESTAR', prefijo: 'lcd' }, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'lcd', valor: true },
      { tipo: 'PONER_OBSERVACION', prefijo: 'lcd', texto: 'x' }, { tipo: 'PEDIR_CONFIRMACION_FILA', prefijo: 'lcd' },
      { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'lcd', descripcion: 'otra vez' },
    ] satisfies AccionFormulario[]) expect(reducir(e, a)).toBe(e)
    // sin stock: contador 0 y descripción vacía = sin descripción
    const sinStock = reducir(conModelo('14'), { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'bat', descripcion: '   ' })
    expect(fila(sinStock, 'bat')).toMatchObject({ cantidad: 0, agotado: { descripcion: null, registrado: false } })
    // una fila que no ofrece ninguna variante no se puede confirmar
    const normal = conModelo('13')
    expect(reducir(normal, { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'bat', descripcion: '' })).toBe(normal)
  })

  it('texto de la etiqueta confirmada con stock 0, con stock > 0 y con descripción', () => {
    const sinStock = reducir(conModelo('14'), { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'bat', descripcion: '' })
    expect(subFila(sinStock, fila(sinStock, 'bat'))).toEqual({
      tipo: 'confirmada', texto: '✓  Solicitud de reposición pendiente', lapizHabilitado: true,
    })
    const limite = aplicar(conModelo('13'), { tipo: 'SUMAR', prefijo: 'lcd' }, { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'lcd', descripcion: '' })
    expect(subFila(limite, fila(limite, 'lcd'))).toEqual({
      tipo: 'confirmada', texto: '✓  1 uds. se descontarán al guardar — solicitud pendiente', lapizHabilitado: true,
    })
    const conTexto = reducir(conModelo('14'), { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'bat', descripcion: 'batería hinchada' })
    expect(subFila(conTexto, fila(conTexto, 'bat'))).toMatchObject({ texto: '✓  Solicitud de reposición pendiente — batería hinchada' })
    const limiteConTexto = aplicar(conModelo('13'),
      { tipo: 'SUMAR', prefijo: 'lcd' }, { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'lcd', descripcion: 'negra original' })
    expect(subFila(limiteConTexto, fila(limiteConTexto, 'lcd'))).toMatchObject({
      texto: '✓  1 uds. se descontarán al guardar — solicitud pendiente — negra original',
    })
  })

  it('editar descripción no sube revision', () => {
    const confirmada = reducir(conModelo('14'), { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'bat', descripcion: 'batería hinchada' })
    const e = reducir(confirmada, { tipo: 'EDITAR_DESCRIPCION_AGOTADO', prefijo: 'bat', descripcion: '  con tapa  ' })
    expect(fila(e, 'bat').agotado).toEqual({ descripcion: 'con tapa', registrado: false })
    expect(e.revision).toBe(confirmada.revision)
    expect(e.volcados).toBe(confirmada.volcados)
    const vaciada = reducir(e, { tipo: 'EDITAR_DESCRIPCION_AGOTADO', prefijo: 'bat', descripcion: '' })
    expect(fila(vaciada, 'bat').agotado?.descripcion).toBeNull()
    // sobre una fila sin agotado local no hace nada
    expect(reducir(e, { tipo: 'EDITAR_DESCRIPCION_AGOTADO', prefijo: 'lcd', descripcion: 'x' })).toBe(e)
    // un agotado ya registrado en el servidor no se edita ni se cancela: su lápiz queda deshabilitado
    const registrado = reducir(e, { tipo: 'AGOTADO_REGISTRADO', prefijo: 'bat' })
    expect(fila(registrado, 'bat').agotado).toEqual({ descripcion: 'con tapa', registrado: true })
    expect(registrado.revision).toBe(e.revision)
    expect(subFila(registrado, fila(registrado, 'bat'))).toMatchObject({ tipo: 'confirmada', lapizHabilitado: false })
    expect(reducir(registrado, { tipo: 'EDITAR_DESCRIPCION_AGOTADO', prefijo: 'bat', descripcion: 'x' })).toBe(registrado)
    expect(reducir(registrado, { tipo: 'CANCELAR_AGOTADO', prefijo: 'bat' })).toBe(registrado)
  })

  it('cancelar agotado devuelve la fila y recalcula la variante', () => {
    const limite = aplicar(conModelo('13'), { tipo: 'SUMAR', prefijo: 'lcd' }, { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'lcd', descripcion: 'x' })
    const e = reducir(limite, { tipo: 'CANCELAR_AGOTADO', prefijo: 'lcd' })
    expect(fila(e, 'lcd')).toMatchObject({ agotado: null, cantidad: 0, reutilizado: false })
    expect(fila(e, 'lcd').controles).toEqual({ mas: true, menos: false, reutilizado: true, sku: true, observacion: true })
    expect(subFila(e, fila(e, 'lcd'))).toEqual({ tipo: 'oculta' }) // con contador 0 ya no está en el límite
    expect(e.revision).toBe(limite.revision + 1)
    const sinStock = aplicar(conModelo('14'),
      { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'bat', descripcion: '' }, { tipo: 'CANCELAR_AGOTADO', prefijo: 'bat' })
    expect(fila(sinStock, 'bat').controles).toEqual({ mas: false, menos: false, reutilizado: true, sku: true, observacion: true })
    expect(subFila(sinStock, fila(sinStock, 'bat'))).toEqual({ tipo: 'sinStock' })
    expect(zonaGuardarVisible(sinStock)).toBe(false)
  })
})

describe('estado del formulario (2): guardar fila', () => {
  it('botón derecho: reglas de visibilidad y "✓ Confirmar" revertido por cualquier cambio', () => {
    const base = conModelo('13')
    expect(botonDerecho(base, fila(base, 'bat'))).toEqual({ tipo: 'ninguno' })
    expect(reducir(base, { tipo: 'PEDIR_CONFIRMACION_FILA', prefijo: 'bat' })).toBe(base) // fila inactiva
    const activa = reducir(base, { tipo: 'SUMAR', prefijo: 'bat' })
    expect(botonDerecho(activa, fila(activa, 'bat'))).toEqual({ tipo: 'guardarFila', texto: '✓ Guardar fila', deshabilitado: false })
    const reutilizada = reducir(base, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'cha', valor: true })
    expect(botonDerecho(reutilizada, fila(reutilizada, 'cha'))).toMatchObject({ tipo: 'guardarFila', texto: '✓ Guardar fila' })
    // convive con la sub-fila de stock agotado cuando cantidad = stock
    const enLimite = reducir(base, { tipo: 'SUMAR', prefijo: 'lcd' })
    expect(botonDerecho(enLimite, fila(enLimite, 'lcd'))).toMatchObject({ tipo: 'guardarFila' })
    expect(subFila(enLimite, fila(enLimite, 'lcd'))).toEqual({ tipo: 'limite', stock: 1 })
    // primer clic: "✓ Confirmar" (no es un cambio de datos); el segundo INICIO no procede sin el primero
    expect(reducir(activa, { tipo: 'INICIO_GUARDAR_FILA', prefijo: 'bat' })).toBe(activa)
    const confirmando = batConfirmando()
    expect(botonDerecho(confirmando, fila(confirmando, 'bat'))).toEqual({ tipo: 'guardarFila', texto: '✓ Confirmar', deshabilitado: false })
    expect(confirmando.revision).toBe(activa.revision)
    expect(reducir(confirmando, { tipo: 'PEDIR_CONFIRMACION_FILA', prefijo: 'bat' })).toBe(confirmando)
    // cualquier cambio en la fila lo devuelve a "✓ Guardar fila"
    const cambios: AccionFormulario[] = [
      { tipo: 'SUMAR', prefijo: 'bat' }, { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: 'conector dañado' },
    ]
    for (const cambio of cambios) {
      const e = reducir(confirmando, cambio)
      expect(botonDerecho(e, fila(e, 'bat'))).toEqual({ tipo: 'guardarFila', texto: '✓ Guardar fila', deshabilitado: false })
    }
    // un cambio en OTRA fila no lo toca
    const otra = reducir(confirmando, { tipo: 'SUMAR', prefijo: 'cha' })
    expect(fila(otra, 'bat').confirmandoGuardar).toBe(true)
    // segundo clic: en vuelo, botón deshabilitado y la fila no admite cambios
    const enVuelo = reducir(confirmando, { tipo: 'INICIO_GUARDAR_FILA', prefijo: 'bat' })
    expect(botonDerecho(enVuelo, fila(enVuelo, 'bat'))).toEqual({ tipo: 'guardarFila', texto: '✓ Confirmar', deshabilitado: true })
    expect(reducir(enVuelo, { tipo: 'SUMAR', prefijo: 'bat' })).toBe(enVuelo)
    expect(reducir(enVuelo, { tipo: 'INICIO_GUARDAR_FILA', prefijo: 'bat' })).toBe(enVuelo)
    // en edición no existe nunca
    const editando: EstadoFormulario = { ...activa, modo: 'editar' }
    expect(botonDerecho(editando, fila(editando, 'bat'))).toEqual({ tipo: 'ninguno' })
    expect(reducir(editando, { tipo: 'PEDIR_CONFIRMACION_FILA', prefijo: 'bat' })).toBe(editando)
  })

  it('fila guardada ignora sumar, SKU, Reutilizado, observación y cambio de modelo', () => {
    const conNota = aplicar(conModelo('13'),
      { tipo: 'SUMAR', prefijo: 'bat' }, { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: 'conector dañado' },
      { tipo: 'SUMAR', prefijo: 'cha' },
      { tipo: 'PEDIR_CONFIRMACION_FILA', prefijo: 'bat' }, { tipo: 'INICIO_GUARDAR_FILA', prefijo: 'bat' },
      { tipo: 'FILA_GUARDADA', prefijo: 'bat', idRep: 'R20260916_9', fecha: '16/09 09:15' })
    const bat = fila(conNota, 'bat')
    expect(bat.guardada).toEqual({ idRep: 'R20260916_9', fecha: '16/09 09:15' })
    expect(bat).toMatchObject({ guardando: false, confirmandoGuardar: false, cantidad: 1, observacion: 'conector dañado' })
    expect(bat.controles).toEqual({ mas: false, menos: false, reutilizado: false, sku: false, observacion: false })
    expect(botonDerecho(conNota, bat)).toEqual({ tipo: 'guardada', texto: '✓ Guardada 16/09 09:15' })
    expect(subFila(conNota, bat)).toEqual({ tipo: 'oculta' })
    for (const a of [
      { tipo: 'SUMAR', prefijo: 'bat' }, { tipo: 'RESTAR', prefijo: 'bat' }, { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 101 },
      { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: true }, { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: 'x' },
      { tipo: 'BORRAR_OBSERVACION', prefijo: 'bat' }, // la papelera de una fila guardada está deshabilitada
      { tipo: 'PEDIR_CONFIRMACION_FILA', prefijo: 'bat' }, { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'bat', descripcion: '' },
      { tipo: 'FILA_GUARDADA', prefijo: 'bat', idRep: 'R20260916_99', fecha: '16/09 10:00' },
    ] satisfies AccionFormulario[]) expect(reducir(conNota, a)).toBe(conNota)
    // el cambio de modelo resetea el chasis pero no toca la guardada
    const otroModelo = reducir(conNota, { tipo: 'CAMBIAR_MODELO', modelo: '14' })
    expect(fila(otroModelo, 'bat')).toBe(bat)
    expect(fila(otroModelo, 'cha').cantidad).toBe(0)
    // una guardada con "Reutilizado": contador 0 y casilla marcada (y apagada)
    const reutilizada = aplicar(conModelo('13'),
      { tipo: 'MARCAR_REUTILIZADO', prefijo: 'cha', valor: true },
      { tipo: 'PEDIR_CONFIRMACION_FILA', prefijo: 'cha' }, { tipo: 'INICIO_GUARDAR_FILA', prefijo: 'cha' },
      { tipo: 'FILA_GUARDADA', prefijo: 'cha', idRep: 'R20260916_11', fecha: '16/09 09:30' })
    expect(fila(reutilizada, 'cha')).toMatchObject({ cantidad: 0, reutilizado: true, controles: { reutilizado: false } })
  })

  it('FALLO_GUARDAR_FILA rehabilita', () => {
    const enVuelo = reducir(batConfirmando(), { tipo: 'INICIO_GUARDAR_FILA', prefijo: 'bat' })
    const e = reducir(enVuelo, { tipo: 'FALLO_GUARDAR_FILA', prefijo: 'bat' })
    expect(fila(e, 'bat')).toMatchObject({ guardando: false, confirmandoGuardar: false, guardada: null, cantidad: 1 })
    expect(botonDerecho(e, fila(e, 'bat'))).toEqual({ tipo: 'guardarFila', texto: '✓ Guardar fila', deshabilitado: false })
    expect(fila(reducir(e, { tipo: 'SUMAR', prefijo: 'bat' }), 'bat').cantidad).toBe(2) // la fila no quedó bloqueada
    expect(e.volcados).toBe(0)
    expect(reducir(e, { tipo: 'FALLO_GUARDAR_FILA', prefijo: 'bat' })).toBe(e)
  })
})

describe('estado del formulario (2): otras acciones', () => {
  it('otras acciones visibles solo con componente otro del modelo', () => {
    const sinModelo = estadoInicial(datosNuevo())
    expect(otrasAccionesVisible(sinModelo)).toBe(false)
    expect(idComOtro(sinModelo)).toBeNull()
    expect(idComOtro(conModelo('13'))).toBe(161)
    expect(idComOtro(conModelo('14'))).toBe(162)
    expect(otrasAccionesVisible(conModelo('13promax'))).toBe(false) // no hay otroi13promax
    // no se mira si el componente "otro" está activo
    const catalogo = agrupados()
    catalogo.otro = [componente({ idCom: 161, tipo: 'otroi13', stock: 0, stockMinimo: 0, activo: false })]
    expect(idComOtro(conModelo('13', { agrupados: catalogo }))).toBe(161)
    // igual en glass
    expect(idComOtro(conModelo('13', { modo: 'glass', idAsignacion: 'AG20260916_2' }))).toBe(161)
  })

  it('añadir acción deshabilitado con una línea vacía', () => {
    const base = conModelo('13')
    expect(anadirAccionHabilitado(base)).toBe(true)
    const conLinea = reducir(base, { tipo: 'ANADIR_ACCION' })
    expect(conLinea.otros).toEqual([{ id: 1, texto: '', origen: 'nueva', guardada: null, confirmando: false, guardando: false }])
    expect(conLinea.siguienteIdAccion).toBe(2)
    expect(conLinea.revision).toBe(base.revision + 1)
    expect(anadirAccionHabilitado(conLinea)).toBe(false)
    expect(reducir(conLinea, { tipo: 'ANADIR_ACCION' })).toBe(conLinea)
    const soloEspacios = reducir(conLinea, { tipo: 'ESCRIBIR_ACCION', id: 1, texto: '   ' })
    expect(anadirAccionHabilitado(soloEspacios)).toBe(false)
    const escrita = reducir(conLinea, { tipo: 'ESCRIBIR_ACCION', id: 1, texto: 'Limpieza de altavoz' })
    expect(anadirAccionHabilitado(escrita)).toBe(true)
    const dos = reducir(escrita, { tipo: 'ANADIR_ACCION' })
    expect(dos.otros.map((a) => a.id)).toEqual([1, 2])
    // la papelera quita la línea sin más; los ids no se reutilizan
    const quitada = reducir(dos, { tipo: 'QUITAR_ACCION', id: 1 })
    expect(quitada.otros.map((a) => a.id)).toEqual([2])
    expect(reducir(quitada, { tipo: 'ANADIR_ACCION' })).toBe(quitada) // la 2 sigue vacía
    // sin sección (sin modelo) no se añade nada
    const sinModelo = estadoInicial(datosNuevo())
    expect(reducir(sinModelo, { tipo: 'ANADIR_ACCION' })).toBe(sinModelo)
  })

  it('badge cuenta guardadas o con texto', () => {
    expect(contadorAcciones(conModelo('13'))).toBe(0)
    expect(contadorAcciones(reducir(conModelo('13'), { tipo: 'ANADIR_ACCION' }))).toBe(0)
    const guardadaYEscrita = aplicar(conAccion('Limpieza de altavoz', true),
      { tipo: 'ANADIR_ACCION' }, { tipo: 'ESCRIBIR_ACCION', id: 2, texto: 'Ajuste de botón' }, { tipo: 'ANADIR_ACCION' })
    expect(guardadaYEscrita.otros).toHaveLength(3)
    expect(contadorAcciones(guardadaYEscrita)).toBe(2)
  })

  it('escribir devuelve "✓ Confirmar" a "✓ Guardar"', () => {
    const escrita = conAccion('Limpieza')
    expect(accionPideConfirmacion(accion(escrita, 1))).toBe(true)
    expect(reducir(escrita, { tipo: 'INICIO_GUARDAR_ACCION', id: 1 })).toBe(escrita) // sin primer clic no se guarda
    const confirmando = reducir(escrita, { tipo: 'PEDIR_CONFIRMACION_ACCION', id: 1 })
    expect(accion(confirmando, 1).confirmando).toBe(true)
    expect(accionPideConfirmacion(accion(confirmando, 1))).toBe(false)
    expect(confirmando.revision).toBe(escrita.revision)
    const reescrita = reducir(confirmando, { tipo: 'ESCRIBIR_ACCION', id: 1, texto: 'Limpieza de altavoz' })
    expect(accion(reescrita, 1)).toMatchObject({ texto: 'Limpieza de altavoz', confirmando: false })
    expect(reescrita.revision).toBe(confirmando.revision + 1)
    // con el texto vacío no se puede pedir confirmación ("✓ Guardar" deshabilitado)
    const vacia = reducir(conModelo('13'), { tipo: 'ANADIR_ACCION' })
    expect(reducir(vacia, { tipo: 'PEDIR_CONFIRMACION_ACCION', id: 1 })).toBe(vacia)
    // guardada: texto recortado, bloqueada y sin papelera
    const guardada = conAccion('  Limpieza de altavoz  ', true)
    expect(accion(guardada, 1)).toMatchObject({
      texto: 'Limpieza de altavoz', guardada: { idRep: 'R20260916_10', fecha: '16/09 09:20' }, confirmando: false, guardando: false,
    })
    expect(reducir(guardada, { tipo: 'ESCRIBIR_ACCION', id: 1, texto: 'otra' })).toBe(guardada)
    expect(reducir(guardada, { tipo: 'QUITAR_ACCION', id: 1 })).toBe(guardada)
    // en edición las líneas no tienen "✓ Guardar"
    const editando: EstadoFormulario = { ...escrita, modo: 'editar' }
    expect(reducir(editando, { tipo: 'PEDIR_CONFIRMACION_ACCION', id: 1 })).toBe(editando)
  })

  it('fallo al guardar acción conserva "✓ Confirmar" pero pide otro clic', () => {
    const enVuelo = aplicar(conAccion('Limpieza de altavoz'),
      { tipo: 'PEDIR_CONFIRMACION_ACCION', id: 1 }, { tipo: 'INICIO_GUARDAR_ACCION', id: 1 })
    expect(accion(enVuelo, 1).guardando).toBe(true)
    expect(reducir(enVuelo, { tipo: 'ESCRIBIR_ACCION', id: 1, texto: 'x' })).toBe(enVuelo)
    expect(reducir(enVuelo, { tipo: 'QUITAR_ACCION', id: 1 })).toBe(enVuelo)
    const fallida = reducir(enVuelo, { tipo: 'FALLO_GUARDAR_ACCION', id: 1 })
    expect(accion(fallida, 1)).toMatchObject({ guardando: false, confirmando: true, guardada: null }) // el texto sigue en "✓ Confirmar"
    expect(accionPideConfirmacion(accion(fallida, 1))).toBe(true)
    expect(reducir(fallida, { tipo: 'INICIO_GUARDAR_ACCION', id: 1 })).toBe(fallida) // un clic no basta
    const rearmada = reducir(fallida, { tipo: 'PEDIR_CONFIRMACION_ACCION', id: 1 })
    expect(accionPideConfirmacion(accion(rearmada, 1))).toBe(false)
    expect(accion(reducir(rearmada, { tipo: 'INICIO_GUARDAR_ACCION', id: 1 }), 1).guardando).toBe(true)
    expect(fallida.volcados).toBe(0)
  })
})

describe('estado del formulario (2): zona de guardar', () => {
  it('zona visible: fila activa, agotado local, acción con texto, fila guardada, acción guardada', () => {
    expect(zonaGuardarVisible(estadoInicial(datosNuevo()))).toBe(false)
    expect(zonaGuardarVisible(conModelo('13'))).toBe(false)
    expect(zonaGuardarVisible(reducir(conModelo('13'), { tipo: 'SUMAR', prefijo: 'bat' }))).toBe(true)
    expect(zonaGuardarVisible(reducir(conModelo('13'), { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: true }))).toBe(true)
    expect(zonaGuardarVisible(reducir(conModelo('14'), { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'bat', descripcion: '' }))).toBe(true)
    expect(zonaGuardarVisible(reducir(conModelo('13'), { tipo: 'ANADIR_ACCION' }))).toBe(false) // línea vacía
    expect(zonaGuardarVisible(conAccion('Limpieza de altavoz'))).toBe(true)
    expect(zonaGuardarVisible(conAccion('Limpieza de altavoz', true))).toBe(true)
    expect(zonaGuardarVisible(batGuardada())).toBe(true)
    // una observación sola no cuenta
    expect(zonaGuardarVisible(reducir(conModelo('13'), { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: 'x' }))).toBe(false)
    // una acción escrita deja de contar si el modelo nuevo no tiene componente "otro"
    expect(zonaGuardarVisible(reducir(conAccion('Limpieza de altavoz'), { tipo: 'CAMBIAR_MODELO', modelo: '13promax' }))).toBe(false)
    expect(textoBotonGuardar(conModelo('13'))).toBe('Terminar asignación')
  })

  it('una solicitud del servidor no hace visible la zona', () => {
    const pendiente = estadoInicial(datosNuevo({ solicitudes: [solicitudAsignacion()] }))
    expect(zonaGuardarVisible(pendiente)).toBe(false)
    const enCamino = estadoInicial(datosNuevo({ solicitudes: [solicitudAsignacion({ enCamino: true })] }))
    expect(zonaGuardarVisible(enCamino)).toBe(false)
    expect(reducir(pendiente, { tipo: 'PEDIR_CONFIRMACION_GUARDAR' })).toBe(pendiente) // sin zona no hay clic
  })

  it('"✓  Confirmar terminar" no vuelve atrás y tras FALLO_GUARDADO pide dos clics', () => {
    const activa = reducir(conModelo('13'), { tipo: 'SUMAR', prefijo: 'bat' })
    expect(reducir(activa, { tipo: 'INICIO_GUARDADO' })).toBe(activa) // el primer clic nunca ejecuta
    const primerClic = reducir(activa, { tipo: 'PEDIR_CONFIRMACION_GUARDAR' })
    expect(primerClic.guardado).toEqual({ clics: 1, textoConfirmacion: true, enCurso: false })
    expect(textoBotonGuardar(primerClic)).toBe('✓  Confirmar terminar')
    expect(primerClic.revision).toBe(activa.revision)
    // cambiar filas no restaura el texto ni desarma el segundo clic
    const cambiada = reducir(primerClic, { tipo: 'SUMAR', prefijo: 'bat' })
    expect(textoBotonGuardar(cambiada)).toBe('✓  Confirmar terminar')
    expect(cambiada.guardado.clics).toBe(1)
    const enCurso = reducir(cambiada, { tipo: 'INICIO_GUARDADO' })
    expect(enCurso.guardado).toEqual({ clics: 1, textoConfirmacion: true, enCurso: true })
    expect(reducir(enCurso, { tipo: 'PEDIR_CONFIRMACION_GUARDAR' })).toBe(enCurso)
    expect(reducir(enCurso, { tipo: 'INICIO_GUARDADO' })).toBe(enCurso) // no se lanza dos veces
    // fallo: el texto se queda, pero hacen falta otros dos clics
    const fallido = reducir(enCurso, { tipo: 'FALLO_GUARDADO' })
    expect(fallido.guardado).toEqual({ clics: 0, textoConfirmacion: true, enCurso: false })
    expect(textoBotonGuardar(fallido)).toBe('✓  Confirmar terminar')
    expect(reducir(fallido, { tipo: 'INICIO_GUARDADO' })).toBe(fallido)
    const otraVez = aplicar(fallido, { tipo: 'PEDIR_CONFIRMACION_GUARDAR' }, { tipo: 'INICIO_GUARDADO' })
    expect(otraVez.guardado.enCurso).toBe(true)
    expect(otraVez.borradorDescartado).toBe(false)
    // guardado real: ya no se vuelve a escribir borrador
    expect(reducir(otraVez, { tipo: 'GUARDADO_COMPLETADO' }).borradorDescartado).toBe(true)
  })

  it('FILA_GUARDADA y ACCION_GUARDADA suben volcados', () => {
    const antes = reducir(batConfirmando(), { tipo: 'INICIO_GUARDAR_FILA', prefijo: 'bat' })
    const fila1 = reducir(antes, { tipo: 'FILA_GUARDADA', prefijo: 'bat', idRep: 'R20260916_9', fecha: '16/09 09:15' })
    expect(fila1.volcados).toBe(antes.volcados + 1)
    expect(fila1.revision).toBe(antes.revision)
    const accion1 = aplicar(fila1,
      { tipo: 'ANADIR_ACCION' }, { tipo: 'ESCRIBIR_ACCION', id: 1, texto: 'Limpieza de altavoz' },
      { tipo: 'PEDIR_CONFIRMACION_ACCION', id: 1 }, { tipo: 'INICIO_GUARDAR_ACCION', id: 1 },
      { tipo: 'ACCION_GUARDADA', id: 1, idRep: 'R20260916_10', fecha: '16/09 09:20' })
    expect(accion1.volcados).toBe(fila1.volcados + 1)
    // repetir el aviso de guardado no vuelve a volcar
    expect(reducir(accion1, { tipo: 'ACCION_GUARDADA', id: 1, idRep: 'R20260916_10', fecha: '16/09 09:20' })).toBe(accion1)
  })
})
