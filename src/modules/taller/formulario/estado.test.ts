import { describe, expect, it } from 'vitest'
import { agrupados, asignacionActiva, componente } from '../test/fabrica'
import {
  type AccionFormulario, type DatosNuevo, type EstadoFormulario, type FilaEstado,
  componenteDe, estadoInicial, etiquetaImei, filaActiva, filaSinSku, filasVisibles, reducir, stockDe, textoConflicto, tituloPestana,
} from './estado'

const IMEI = '355400000000111'

function datosNuevo(parcial: Partial<DatosNuevo> = {}): DatosNuevo {
  return {
    modo: 'nuevo', idAsignacion: 'A20260916_1', imei: IMEI, agrupados: agrupados(), solicitudes: [], incidencia: null,
    modeloTelefono: null, ...parcial,
  }
}
/** Estado de flujo nuevo con el modelo ya elegido a mano (combo libre). */
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

describe('estado del formulario (1): estado inicial, modelo y cabecera', () => {
  it('sin modelo las filas están ocultas', () => {
    const e = estadoInicial(datosNuevo())
    expect(e.modelo).toBeNull()
    expect(e.modeloBloqueado).toBe(false)
    expect(filasVisibles(e)).toBe(false)
    expect(filasVisibles(conModelo('13'))).toBe(true)
    // las filas existen igualmente, en el orden del servidor y sin g, mc ni otro
    expect(e.filas.map((f) => f.prefijo)).toEqual(['bat', 'cha', 'lcd', 'cam'])
    expect(e.filas.map((f) => f.nombre)).toEqual(['Batería', 'Chasis', 'Pantalla', 'Cámara'])
    expect(e.componentesOtro.map((c) => c.idCom)).toEqual([161, 162])
    expect(e.categoria).toBe('R')
    expect(e.revision).toBe(0)
    expect(e.volcados).toBe(0)
  })

  it('el modelo del teléfono se selecciona y bloquea el combo', () => {
    const e = estadoInicial(datosNuevo({ modeloTelefono: '13' }))
    expect(e.modelo).toBe('13')
    expect(e.modeloBloqueado).toBe(true)
    expect(filasVisibles(e)).toBe(true)
    expect(fila(e, 'bat').opciones.map((c) => c.idCom)).toEqual([101])
    // bloqueado: el combo ya no cambia el modelo
    expect(reducir(e, { tipo: 'CAMBIAR_MODELO', modelo: '14' })).toBe(e)
  })

  it('un modelo de teléfono fuera de la lista se ignora', () => {
    for (const modeloTelefono of ['', '12', 'desconocido']) {
      const e = estadoInicial(datosNuevo({ modeloTelefono }))
      expect(e.modelo).toBeNull()
      expect(e.modeloBloqueado).toBe(false)
    }
  })

  it('los modelos salen en orden de tienda y solo de SKU activos de filas visibles', () => {
    // bati12 está inactivo (no aporta "12"); "otro" no aporta modelos
    expect(estadoInicial(datosNuevo()).modelos).toEqual(['13', '13promax', '14'])
    // elegir un modelo que no está en el combo no hace nada
    const e = estadoInicial(datosNuevo())
    expect(reducir(e, { tipo: 'CAMBIAR_MODELO', modelo: '12' })).toBe(e)
  })

  it('elegir modelo filtra los SKU y preselecciona el primero con stock', () => {
    const catalogo = agrupados()
    catalogo.bat = [componente({ idCom: 105, tipo: 'bati13negra', stock: 0 }), ...catalogo.bat]
    const e = conModelo('13', { agrupados: catalogo })
    const bat = fila(e, 'bat')
    expect(bat.opciones.map((c) => c.idCom)).toEqual([105, 101]) // ni bati14, ni bati13promax, ni el inactivo
    expect(bat.idCom).toBe(101) // el primero CON stock, no el primero de la lista
    expect(componenteDe(bat)?.tipo).toBe('bati13')
    expect(stockDe(bat)).toBe(5)
    expect(bat.controles).toEqual({ mas: true, menos: false, reutilizado: true, sku: true, observacion: true })
    expect(bat.cantidad).toBe(0)
    expect(filaActiva(bat)).toBe(false)
  })

  it('sin ninguno con stock preselecciona el primero', () => {
    const bat = fila(conModelo('14'), 'bat')
    expect(bat.idCom).toBe(102)
    expect(stockDe(bat)).toBe(0)
    expect(bat.controles.mas).toBe(false) // "+" deshabilitado con stock ≤ 0
    expect(bat.controles.reutilizado).toBe(true)
  })

  it('tipo sin SKU para el modelo queda sin idCom', () => {
    const cam = fila(conModelo('14'), 'cam')
    expect(cam.opciones).toEqual([])
    expect(cam.idCom).toBeNull()
    expect(filaSinSku(cam)).toBe(true)
    expect(stockDe(cam)).toBeNull()
    expect(cam.controles).toEqual({ mas: false, menos: false, reutilizado: false, sku: false, observacion: false })
    // la fila no desaparece y no admite nada
    const e = conModelo('14')
    expect(e.filas.map((f) => f.prefijo)).toContain('cam')
    expect(reducir(e, { tipo: 'SUMAR', prefijo: 'cam' })).toBe(e)
    expect(reducir(e, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'cam', valor: true })).toBe(e)
    expect(reducir(e, { tipo: 'PONER_OBSERVACION', prefijo: 'cam', texto: 'rota' })).toBe(e)
  })

  it('textoConflicto agrupa por categoría, ordena Reparación·Glass·Pulido, excluye la propia y marca (tú)', () => {
    const activas = [
      asignacionActiva({ idRep: 'AP20260916_3', nombreTecnico: 'Técnico J', idTec: 7 }),
      asignacionActiva({ idRep: 'AG20260916_2', nombreTecnico: 'Técnico H', idTec: 6 }),
      asignacionActiva({ idRep: 'A20260916_1', nombreTecnico: 'Técnico A', idTec: 4 }),
      asignacionActiva({ idRep: 'A20260916_8', nombreTecnico: 'Técnico F', idTec: 3 }),
      asignacionActiva({ idRep: 'A20260916_9', nombreTecnico: 'Técnico A', idTec: 4 }),
    ]
    expect(textoConflicto(activas, 'A20260916_1', 4)).toBe(
      '⚠ Este IMEI también está asignado a — Reparación: Técnico F, Técnico A (tú) · Glass: Técnico H · Pulido: Técnico J',
    )
    // desde la glass: la propia AG queda fuera y las categorías vacías se omiten
    expect(textoConflicto(activas.slice(1, 3), 'AG20260916_2', 6)).toBe('⚠ Este IMEI también está asignado a — Reparación: Técnico A')
    expect(textoConflicto([asignacionActiva({ idRep: 'A20260916_1' })], 'A20260916_1', 4)).toBeNull()
    expect(textoConflicto([], 'A20260916_1', null)).toBeNull()
  })

  it('etiquetaImei y tituloPestana en flujo nuevo', () => {
    const e = estadoInicial(datosNuevo())
    expect(etiquetaImei(e)).toBe(`IMEI: ${IMEI}`)
    expect(tituloPestana(e)).toBe(`Nueva reparación — IMEI ${IMEI}`)
  })

  it('glass solo crea filas g y mc', () => {
    const e = estadoInicial(datosNuevo({ modo: 'glass', idAsignacion: 'AG20260916_2' }))
    expect(e.modo).toBe('glass')
    expect(e.categoria).toBe('G')
    expect(e.filas.map((f) => f.prefijo)).toEqual(['g', 'mc'])
    expect(e.filas.map((f) => f.nombre)).toEqual(['Glass', 'Marco'])
    expect(e.modelos).toEqual(['13', '14']) // solo de g y mc
    expect(e.componentesOtro).toHaveLength(2)
    expect(tituloPestana(e)).toBe(`Nueva reparación — IMEI ${IMEI}`)
  })
})

describe('estado del formulario (1): filas', () => {
  it('sumar respeta el stock y deshabilita Reutilizado', () => {
    const uno = aplicar(conModelo('13'), { tipo: 'SUMAR', prefijo: 'lcd' }) // lcdi13: stock 1
    expect(fila(uno, 'lcd').cantidad).toBe(1)
    expect(fila(uno, 'lcd').controles).toMatchObject({ mas: false, menos: true, reutilizado: false })
    expect(filaActiva(fila(uno, 'lcd'))).toBe(true)
    // en el límite el clic ya no suma ni cuenta como cambio
    expect(reducir(uno, { tipo: 'SUMAR', prefijo: 'lcd' })).toBe(uno)
    // con margen, "+" sigue encendido
    const bat = fila(aplicar(conModelo('13'), { tipo: 'SUMAR', prefijo: 'bat' }), 'bat')
    expect(bat.controles).toMatchObject({ mas: true, menos: true, reutilizado: false })
    // cantidad > 0 y Reutilizado son excluyentes
    expect(reducir(uno, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'lcd', valor: true })).toBe(uno)
  })

  it('restar hasta cero rehabilita Reutilizado', () => {
    const dos = aplicar(conModelo('13'), { tipo: 'SUMAR', prefijo: 'bat' }, { tipo: 'SUMAR', prefijo: 'bat' })
    const uno = reducir(dos, { tipo: 'RESTAR', prefijo: 'bat' })
    expect(fila(uno, 'bat').cantidad).toBe(1)
    expect(fila(uno, 'bat').controles).toMatchObject({ mas: true, menos: true, reutilizado: false })
    const cero = reducir(uno, { tipo: 'RESTAR', prefijo: 'bat' })
    expect(fila(cero, 'bat').cantidad).toBe(0)
    expect(fila(cero, 'bat').controles).toMatchObject({ mas: true, menos: false, reutilizado: true })
    expect(reducir(cero, { tipo: 'RESTAR', prefijo: 'bat' })).toBe(cero)
    // restar desde el límite vuelve a encender "+"
    const lcd = aplicar(conModelo('13'), { tipo: 'SUMAR', prefijo: 'lcd' }, { tipo: 'RESTAR', prefijo: 'lcd' })
    expect(fila(lcd, 'lcd').controles.mas).toBe(true)
  })

  it('marcar Reutilizado deshabilita + y -', () => {
    const e = aplicar(conModelo('13'), { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: true })
    const bat = fila(e, 'bat')
    expect(bat.reutilizado).toBe(true)
    expect(bat.cantidad).toBe(0)
    expect(bat.controles).toMatchObject({ mas: false, menos: false, reutilizado: true })
    expect(filaActiva(bat)).toBe(true)
    expect(reducir(e, { tipo: 'SUMAR', prefijo: 'bat' })).toBe(e)
  })

  it('desmarcar Reutilizado habilita + aunque el stock sea 0 y el clic no suma', () => {
    const marcada = aplicar(conModelo('14'), { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: true }) // bati14: stock 0
    const e = reducir(marcada, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: false })
    expect(fila(e, 'bat').reutilizado).toBe(false)
    expect(fila(e, 'bat').controles).toMatchObject({ mas: true, menos: false, reutilizado: true })
    expect(reducir(e, { tipo: 'SUMAR', prefijo: 'bat' })).toBe(e)
    expect(fila(e, 'bat').cantidad).toBe(0)
  })

  it('cambiar de SKU pone a cero si la cantidad supera el nuevo stock', () => {
    // tres baterías del mismo modelo con stock 5, 1 y 2
    const catalogo = agrupados()
    catalogo.bat = [componente({ idCom: 101, tipo: 'bati13', stock: 5 }), componente({ idCom: 106, tipo: 'bati13alta', stock: 1 }),
      componente({ idCom: 107, tipo: 'bati13oem', stock: 2 })]
    const dos = aplicar(conModelo('13', { agrupados: catalogo }), { tipo: 'SUMAR', prefijo: 'bat' }, { tipo: 'SUMAR', prefijo: 'bat' })
    // al de stock 2: la cantidad cabe, pero "+" se apaga por estar en el límite
    const justo = reducir(dos, { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 107 })
    expect(fila(justo, 'bat')).toMatchObject({ idCom: 107, cantidad: 2 })
    expect(fila(justo, 'bat').controles).toMatchObject({ mas: false, menos: true, reutilizado: false })
    expect(stockDe(fila(justo, 'bat'))).toBe(2)
    // al de stock 1: la cantidad no cabe → 0 y Reutilizado vuelve
    const vacia = reducir(dos, { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 106 })
    expect(fila(vacia, 'bat')).toMatchObject({ idCom: 106, cantidad: 0 })
    expect(fila(vacia, 'bat').controles).toMatchObject({ mas: true, menos: false, reutilizado: true })
    // con Reutilizado marcado, cambiar de SKU no enciende "+"
    const reutilizada = aplicar(conModelo('13', { agrupados: catalogo }),
      { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: true }, { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 107 })
    expect(fila(reutilizada, 'bat').controles.mas).toBe(false)
    // un SKU que no está entre las opciones, o el mismo, no cambia nada
    expect(reducir(dos, { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 102 })).toBe(dos)
    expect(reducir(dos, { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 101 })).toBe(dos)
  })

  it('poner observación recorta y vacío no cambia nada', () => {
    const e = aplicar(conModelo('13'), { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: '  conector dañado \n' })
    expect(fila(e, 'bat').observacion).toBe('conector dañado')
    expect(filaActiva(fila(e, 'bat'))).toBe(false) // la observación sola no activa la fila
    // "Guardar" con el texto vacío no borra la existente
    expect(reducir(e, { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: '   ' })).toBe(e)
    expect(reducir(e, { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: '' })).toBe(e)
  })

  it('borrar observación', () => {
    const con = aplicar(conModelo('13'), { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: 'conector dañado' })
    const sin = reducir(con, { tipo: 'BORRAR_OBSERVACION', prefijo: 'bat' })
    expect(fila(sin, 'bat').observacion).toBeNull()
    expect(reducir(sin, { tipo: 'BORRAR_OBSERVACION', prefijo: 'bat' })).toBe(sin)
  })

  it('cambiar modelo resetea las filas no guardadas', () => {
    const trabajado = aplicar(conModelo('13'),
      { tipo: 'SUMAR', prefijo: 'bat' },
      { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: 'conector dañado' },
      { tipo: 'MARCAR_REUTILIZADO', prefijo: 'lcd', valor: true })
    const e = reducir(trabajado, { tipo: 'CAMBIAR_MODELO', modelo: '14' })
    expect(e.modelo).toBe('14')
    expect(fila(e, 'bat')).toMatchObject({ idCom: 102, cantidad: 0, reutilizado: false, observacion: null })
    expect(fila(e, 'lcd')).toMatchObject({ idCom: 112, cantidad: 0, reutilizado: false })
    expect(fila(e, 'lcd').controles).toEqual({ mas: true, menos: false, reutilizado: true, sku: true, observacion: true })
    // vaciar el modelo vuelve a ocultar las filas
    const vacio = reducir(e, { tipo: 'CAMBIAR_MODELO', modelo: null })
    expect(filasVisibles(vacio)).toBe(false)
    expect(fila(vacio, 'bat').opciones.map((c) => c.idCom)).toEqual([101, 102, 103])
    // elegir el mismo modelo no resetea nada
    expect(reducir(trabajado, { tipo: 'CAMBIAR_MODELO', modelo: '13' })).toBe(trabajado)
  })

  it('una fila guardada, con agotado confirmado, en vuelo o ya reparada no admite cambios', () => {
    const base = conModelo('13')
    const variantes: Partial<FilaEstado>[] = [
      { guardada: { idRep: 'R20260916_5', fecha: '16/09 09:15' } },
      { agotado: { descripcion: null, registrado: false } },
      { guardando: true },
      { rol: 'yaReparado' },
    ]
    for (const parcial of variantes) {
      const e: EstadoFormulario = { ...base, filas: base.filas.map((f) => (f.prefijo === 'bat' ? { ...f, ...parcial } : f)) }
      expect(reducir(e, { tipo: 'SUMAR', prefijo: 'bat' })).toBe(e)
      expect(reducir(e, { tipo: 'CAMBIAR_SKU', prefijo: 'bat', idCom: 101 })).toBe(e)
      expect(reducir(e, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: true })).toBe(e)
      expect(reducir(e, { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: 'x' })).toBe(e)
      expect(reducir(e, { tipo: 'BORRAR_OBSERVACION', prefijo: 'bat' })).toBe(e)
    }
  })

  it('cada cambio sube revision', () => {
    let e = conModelo('13')
    expect(e.revision).toBe(1)
    const pasos: AccionFormulario[] = [
      { tipo: 'SUMAR', prefijo: 'bat' },
      { tipo: 'RESTAR', prefijo: 'bat' },
      { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: true },
      { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: 'conector dañado' },
      { tipo: 'BORRAR_OBSERVACION', prefijo: 'bat' },
      { tipo: 'CAMBIAR_MODELO', modelo: '14' },
    ]
    for (const [i, paso] of pasos.entries()) {
      e = reducir(e, paso)
      expect(e.revision).toBe(i + 2)
    }
    expect(e.volcados).toBe(0)
    // lo que no cambia nada no reprograma el autoguardado; una acción de otra tarea tampoco
    expect(reducir(e, { tipo: 'RESTAR', prefijo: 'bat' })).toBe(e)
    expect(reducir(e, { tipo: 'SUMAR', prefijo: 'no-existe' })).toBe(e)
  })
})

describe('acciones del borrador en el reductor (REEMPLAZAR y DESBLOQUEAR_BORRADAS)', () => {
  const datosBorrador: DatosNuevo = {
    modo: 'nuevo', idAsignacion: 'A20260916_1', imei: '355400000000111', agrupados: agrupados(), solicitudes: [], incidencia: null, modeloTelefono: null,
  }
  /** Modelo 13; batería guardada (R20260916_5) con observación; pantalla guardada (R20260916_7) como Reutilizado; una acción
   *  guardada (R20260916_6) y otra pendiente. */
  function conGuardadas(): EstadoFormulario {
    let e = reducir(estadoInicial(datosBorrador), { tipo: 'CAMBIAR_MODELO', modelo: '13' })
    e = reducir(e, { tipo: 'SUMAR', prefijo: 'bat' })
    e = reducir(e, { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: 'Batería hinchada' })
    e = reducir(e, { tipo: 'FILA_GUARDADA', prefijo: 'bat', idRep: 'R20260916_5', fecha: '16/09 09:15' })
    e = reducir(e, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'lcd', valor: true })
    e = reducir(e, { tipo: 'FILA_GUARDADA', prefijo: 'lcd', idRep: 'R20260916_7', fecha: '16/09 09:18' })
    e = reducir(e, { tipo: 'ANADIR_ACCION' })
    e = reducir(e, { tipo: 'ESCRIBIR_ACCION', id: e.otros[0].id, texto: 'Limpieza del conector de carga' })
    e = reducir(e, { tipo: 'ACCION_GUARDADA', id: e.otros[0].id, idRep: 'R20260916_6', fecha: '16/09 09:20' })
    e = reducir(e, { tipo: 'ANADIR_ACCION' })
    e = reducir(e, { tipo: 'ESCRIBIR_ACCION', id: e.otros[1].id, texto: 'Ajuste de tornillería' })
    return e
  }
  const filaDe = (e: EstadoFormulario, prefijo: string) => e.filas.find((f) => f.prefijo === prefijo)!

  it('REEMPLAZAR devuelve el estado recibido tal cual, sin subir revision', () => {
    const actual = estadoInicial(datosBorrador)
    const nuevo = { ...conGuardadas(), borradorRecuperado: true }
    expect(reducir(actual, { tipo: 'REEMPLAZAR', estado: nuevo })).toBe(nuevo)
  })
  it('DESBLOQUEAR_BORRADAS devuelve a editable las filas cuyo id ya no existe y sube volcados', () => {
    const antes = conGuardadas()
    const e = reducir(antes, { tipo: 'DESBLOQUEAR_BORRADAS', idsExistentes: ['R20260916_7', 'R20260916_6'] })
    expect(filaDe(e, 'bat')).toMatchObject({ guardada: null, cantidad: 0, reutilizado: false, observacion: null, confirmandoGuardar: false, guardando: false })
    // bati13 tiene stock 5: "+" habilitado, "-" no (está a 0), y el resto de controles de vuelta
    expect(filaDe(e, 'bat').controles).toEqual({ mas: true, menos: false, reutilizado: true, sku: true, observacion: true })
    expect(filaDe(e, 'bat').idCom).toBe(101)
    expect(filaDe(e, 'lcd').guardada).toEqual({ idRep: 'R20260916_7', fecha: '16/09 09:18' })
    expect(e.otros[0].guardada).toEqual({ idRep: 'R20260916_6', fecha: '16/09 09:20' })
    expect(e.volcados).toBe(antes.volcados + 1)
  })
  it('DESBLOQUEAR_BORRADAS sobre una acción conserva su texto y la deja pendiente', () => {
    const antes = conGuardadas()
    const e = reducir(antes, { tipo: 'DESBLOQUEAR_BORRADAS', idsExistentes: ['R20260916_5', 'R20260916_7'] })
    expect(e.otros[0]).toMatchObject({ texto: 'Limpieza del conector de carga', guardada: null, confirmando: false, guardando: false })
    expect(e.otros[1]).toEqual(antes.otros[1])
    expect(filaDe(e, 'bat').guardada).not.toBeNull()
    expect(e.volcados).toBe(antes.volcados + 1)
  })
  it('una fila desbloqueada con el SKU sin stock deja "+" deshabilitado', () => {
    let e = reducir(estadoInicial(datosBorrador), { tipo: 'CAMBIAR_MODELO', modelo: '14' })
    e = reducir(e, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: true })
    e = reducir(e, { tipo: 'FILA_GUARDADA', prefijo: 'bat', idRep: 'R20260916_8', fecha: '16/09 10:00' })
    e = reducir(e, { tipo: 'DESBLOQUEAR_BORRADAS', idsExistentes: [] })
    expect(filaDe(e, 'bat').controles).toEqual({ mas: false, menos: false, reutilizado: true, sku: true, observacion: true })
  })
  it('si todo sigue existiendo (o no había nada guardado) devuelve el mismo estado y no sube volcados', () => {
    const antes = conGuardadas()
    expect(reducir(antes, { tipo: 'DESBLOQUEAR_BORRADAS', idsExistentes: ['R20260916_5', 'R20260916_6', 'R20260916_7', 'R20260916_99'] })).toBe(antes)
    const limpio = estadoInicial(datosBorrador)
    expect(reducir(limpio, { tipo: 'DESBLOQUEAR_BORRADAS', idsExistentes: [] })).toBe(limpio)
  })
  it('una fila o acción recuperada sin id ("?") se desbloquea siempre', () => {
    let e = reducir(estadoInicial(datosBorrador), { tipo: 'CAMBIAR_MODELO', modelo: '13' })
    e = reducir(e, { tipo: 'SUMAR', prefijo: 'cam' })
    e = reducir(e, { tipo: 'FILA_GUARDADA', prefijo: 'cam', idRep: '?', fecha: '' })
    e = reducir(e, { tipo: 'DESBLOQUEAR_BORRADAS', idsExistentes: ['R20260916_5'] })
    expect(filaDe(e, 'cam').guardada).toBeNull()
  })
})
