import { describe, expect, it } from 'vitest'
import { BORRADOR_JAVAFX, agrupados, componente, solicitudAsignacion } from '../test/fabrica'
import { aplicarBorrador, borradorVacio, capturar, leerBorrador, serializar, tieneGuardadas, type BorradorContenido, type BorradorFila } from './borrador'
import { estadoInicial, reducir, subFila, type AccionFormulario, type DatosNuevo, type EstadoFormulario } from './estado'

const datos = (parcial: Partial<DatosNuevo> = {}): DatosNuevo => ({
  modo: 'nuevo', idAsignacion: 'A20260916_1', imei: '355400000000111', agrupados: agrupados(), solicitudes: [], incidencia: null,
  modeloTelefono: null, ...parcial,
})
const aplicarAcciones = (e: EstadoFormulario, ...acciones: AccionFormulario[]) => acciones.reduce(reducir, e)
const conModelo13 = () => reducir(estadoInicial(datos()), { tipo: 'CAMBIAR_MODELO', modelo: '13' })
const fila = (e: EstadoFormulario, prefijo: string) => e.filas.find((f) => f.prefijo === prefijo)!
const filaBorrador = (parcial: Partial<BorradorFila> & { prefijo: string }): BorradorFila => ({
  idCom: -1, cantidad: 0, reutilizado: false, solicitudNueva: false, agotadoConfirmado: false, guardada: false, ...parcial,
})
const contenido = (parcial: Partial<BorradorContenido>): BorradorContenido => ({ filas: [], otros: [], ...parcial })

describe('borrador: capturar y serializar (mismo JSON que el cliente de escritorio)', () => {
  it('ida y vuelta: aplicar BORRADOR_JAVAFX y volver a capturar da el mismo contenido', () => {
    const leido = leerBorrador(BORRADOR_JAVAFX)!
    const e = aplicarBorrador(estadoInicial(datos()), leido)
    expect(capturar(e)).toEqual(JSON.parse(BORRADOR_JAVAFX))
    // mismas claves y en el mismo orden: la cadena es idéntica a la del cliente de escritorio
    expect(serializar(e)).toBe(BORRADOR_JAVAFX)
  })
  it('serializar omite cadenas nulas y escribe solicitudNueva false', () => {
    const e = aplicarAcciones(conModelo13(), { tipo: 'SUMAR', prefijo: 'bat' })
    const json = serializar(e)!
    expect(json).toBe('{"modelo":"13","filas":[{"prefijo":"bat","idCom":101,"cantidad":1,"reutilizado":false,"solicitudNueva":false,"agotadoConfirmado":false,"guardada":false}],"otros":[]}')
    expect(json).not.toContain('null')
    expect(json).not.toContain('observacion')
  })
  it('fila guardada se captura sin observación', () => {
    const e = aplicarAcciones(
      conModelo13(),
      { tipo: 'SUMAR', prefijo: 'bat' },
      { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: 'Batería hinchada' },
      { tipo: 'FILA_GUARDADA', prefijo: 'bat', idRep: 'R20260916_5', fecha: '16/09 09:15' },
    )
    expect(capturar(e).filas).toEqual([
      { prefijo: 'bat', idCom: 101, cantidad: 1, reutilizado: false, solicitudNueva: false, agotadoConfirmado: false, guardada: true, idRepGenerado: 'R20260916_5', fechaGuardado: '16/09 09:15' },
    ])
  })
  it('fila sin nada se omite; con solo observación o solo Reutilizado, no', () => {
    const e = aplicarAcciones(
      conModelo13(),
      { tipo: 'PONER_OBSERVACION', prefijo: 'lcd', texto: 'Pantalla con líneas verticales' },
      { tipo: 'MARCAR_REUTILIZADO', prefijo: 'cam', valor: true },
    )
    expect(capturar(e).filas.map((f) => f.prefijo)).toEqual(['lcd', 'cam'])
    expect(capturar(e).filas[0]).toMatchObject({ cantidad: 0, observacion: 'Pantalla con líneas verticales' })
    expect(capturar(e).filas[1]).toMatchObject({ cantidad: 0, reutilizado: true })
  })
  it('un agotado confirmado en esta sesión se captura; una solicitud del servidor no se captura como agotado', () => {
    const local = aplicarAcciones(
      reducir(estadoInicial(datos()), { tipo: 'CAMBIAR_MODELO', modelo: '14' }),
      { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'bat', descripcion: '  Batería original  ' },
    )
    expect(capturar(local).filas).toEqual([
      { prefijo: 'bat', idCom: 102, cantidad: 0, reutilizado: false, solicitudNueva: false, agotadoConfirmado: true, descripcionAgotado: 'Batería original', guardada: false },
    ])
    const delServidor = estadoInicial(datos({ solicitudes: [solicitudAsignacion({ idCom: 102, descripcionSolicitud: 'Batería original' })] }))
    expect(fila(delServidor, 'bat').solicitud).not.toBeNull()
    expect(capturar(delServidor).filas).toEqual([])
    const reutilizada = reducir(delServidor, { tipo: 'MARCAR_REUTILIZADO', prefijo: 'bat', valor: true })
    expect(capturar(reutilizada).filas).toEqual([
      { prefijo: 'bat', idCom: 102, cantidad: 0, reutilizado: true, solicitudNueva: false, agotadoConfirmado: false, guardada: false },
    ])
  })
  it('acciones: con texto o guardadas, descripción recortada', () => {
    let e = aplicarAcciones(conModelo13(), { tipo: 'ANADIR_ACCION' })
    e = reducir(e, { tipo: 'ESCRIBIR_ACCION', id: e.otros[0].id, texto: '  Limpieza del conector de carga ' })
    e = reducir(e, { tipo: 'ACCION_GUARDADA', id: e.otros[0].id, idRep: 'R20260916_6', fecha: '16/09 09:20' })
    e = reducir(e, { tipo: 'ANADIR_ACCION' })
    e = reducir(e, { tipo: 'ESCRIBIR_ACCION', id: e.otros[1].id, texto: ' Ajuste de tornillería' })
    e = reducir(e, { tipo: 'ANADIR_ACCION' }) // línea vacía: no se captura
    expect(capturar(e).otros).toEqual([
      { descripcion: 'Limpieza del conector de carga', guardada: true, idRepGenerado: 'R20260916_6', fechaGuardado: '16/09 09:20' },
      { descripcion: 'Ajuste de tornillería', guardada: false },
    ])
  })
  it('borradorVacio ignora el modelo; serializar devuelve null', () => {
    const e = conModelo13()
    expect(capturar(e)).toEqual({ modelo: '13', filas: [], otros: [] })
    expect(borradorVacio(capturar(e))).toBe(true)
    expect(serializar(e)).toBeNull()
    expect(serializar(estadoInicial(datos()))).toBeNull()
    expect(borradorVacio(contenido({ otros: [{ descripcion: 'x', guardada: false }] }))).toBe(false)
  })
})

describe('leerBorrador', () => {
  it('null, cadena vacía, JSON corrupto u objeto sin filas ni otros → null (formulario limpio)', () => {
    expect(leerBorrador(null)).toBeNull()
    expect(leerBorrador('')).toBeNull()
    expect(leerBorrador('   ')).toBeNull()
    expect(leerBorrador('{"modelo":"13","filas":[{"prefijo":"bat"')).toBeNull()
    expect(leerBorrador('no es json')).toBeNull()
    expect(leerBorrador('null')).toBeNull()
    expect(leerBorrador('[]')).toBeNull()
    expect(leerBorrador('"13"')).toBeNull()
    expect(leerBorrador('{}')).toBeNull()
    expect(leerBorrador('{"modelo":"13"}')).toBeNull()
    expect(leerBorrador('{"modelo":"13","filas":[],"otros":[]}')).toBeNull()
    expect(leerBorrador('{"filas":"bat","otros":[]}')).toBeNull()
  })
  it('un borrador corrupto deja el formulario limpio: nada que aplicar', () => {
    const e = estadoInicial(datos())
    const leido = leerBorrador('{"filas":[{"prefijo":')
    expect(leido).toBeNull()
    // quien llama (useBorrador) no aplica nada: el estado sigue siendo el inicial, sin banda
    expect(e.borradorRecuperado).toBe(false)
    expect(e.filas.every((f) => f.cantidad === 0 && f.guardada === null)).toBe(true)
  })
  it('tolera claves ausentes (Gson omite nulos) y descarta lo que no tiene forma de fila o de acción', () => {
    const b = leerBorrador('{"filas":[{"prefijo":"lcd","cantidad":2},{"idCom":5},"basura",null],"otros":[{"descripcion":"Ajuste de tornillería"},{"guardada":true},7]}')!
    expect(b).toEqual({
      modelo: undefined,
      filas: [{ prefijo: 'lcd', idCom: -1, cantidad: 2, reutilizado: false, observacion: undefined, solicitudNueva: false, descripcionSolicitud: undefined, agotadoConfirmado: false, descripcionAgotado: undefined, guardada: false, idRepGenerado: undefined, fechaGuardado: undefined }],
      otros: [{ descripcion: 'Ajuste de tornillería', guardada: false, idRepGenerado: undefined, fechaGuardado: undefined }, { descripcion: '', guardada: true, idRepGenerado: undefined, fechaGuardado: undefined }],
    })
    expect(leerBorrador('{"otros":[{"descripcion":"Ajuste de tornillería","guardada":false}]}')!.filas).toEqual([])
  })
  it('tieneGuardadas mira filas y acciones', () => {
    expect(tieneGuardadas(leerBorrador(BORRADOR_JAVAFX)!)).toBe(true)
    expect(tieneGuardadas(contenido({ filas: [filaBorrador({ prefijo: 'lcd', cantidad: 1 })] }))).toBe(false)
    expect(tieneGuardadas(contenido({ otros: [{ descripcion: 'x', guardada: true }] }))).toBe(true)
  })
})

describe('aplicarBorrador (recuperación, después de cargar componentes y solicitudes)', () => {
  it('aplica modelo, fila guardada, fila normal, agotado confirmado y acciones', () => {
    const e = aplicarBorrador(estadoInicial(datos()), leerBorrador(BORRADOR_JAVAFX)!)
    expect(e.modelo).toBe('13')
    expect(fila(e, 'bat')).toMatchObject({ idCom: 101, cantidad: 1, reutilizado: false, guardada: { idRep: 'R20260916_5', fecha: '16/09 09:15' } })
    expect(fila(e, 'bat').controles).toEqual({ mas: false, menos: false, reutilizado: false, sku: false, observacion: false })
    expect(fila(e, 'lcd')).toMatchObject({ idCom: 111, cantidad: 1, observacion: 'Pantalla con líneas verticales', guardada: null, agotado: null })
    expect(fila(e, 'lcd').controles.menos).toBe(true)
    expect(fila(e, 'cam')).toMatchObject({ idCom: 121, cantidad: 4, agotado: { descripcion: 'Cámara trasera completa', registrado: false } })
    expect(fila(e, 'cha')).toMatchObject({ cantidad: 0, guardada: null, agotado: null })
  })
  it('el modelo no se toca si está bloqueado o no existe entre las opciones', () => {
    const bloqueado = estadoInicial(datos({ modeloTelefono: '14' }))
    expect(bloqueado.modeloBloqueado).toBe(true)
    expect(aplicarBorrador(bloqueado, contenido({ modelo: '13', filas: [filaBorrador({ prefijo: 'lcd', cantidad: 1 })] })).modelo).toBe('14')
    const libre = estadoInicial(datos())
    expect(aplicarBorrador(libre, contenido({ modelo: 'xr', filas: [filaBorrador({ prefijo: 'lcd', cantidad: 1 })] })).modelo).toBeNull()
    expect(aplicarBorrador(libre, contenido({ filas: [filaBorrador({ prefijo: 'lcd', cantidad: 1 })] })).modelo).toBeNull()
  })
  it('SKU fuera de las opciones deja el SKU por defecto; dentro, lo preselecciona y recalcula "+"', () => {
    const fuera = aplicarBorrador(estadoInicial(datos()), contenido({ modelo: '13', filas: [filaBorrador({ prefijo: 'bat', idCom: 102, cantidad: 1 })] }))
    expect(fila(fuera, 'bat')).toMatchObject({ idCom: 101, cantidad: 1 })
    // sin modelo, todas las baterías activas son opción: bati14 (stock 0) se preselecciona y "+" queda deshabilitado
    const dentro = aplicarBorrador(estadoInicial(datos()), contenido({ filas: [filaBorrador({ prefijo: 'bat', idCom: 102, reutilizado: true })] }))
    expect(dentro.modelo).toBeNull()
    expect(fila(dentro, 'bat')).toMatchObject({ idCom: 102, reutilizado: true })
    expect(fila(dentro, 'bat').controles.mas).toBe(false)
    // un SKU inactivo (bati12) nunca es opción
    const inactivo = aplicarBorrador(estadoInicial(datos()), contenido({ filas: [filaBorrador({ prefijo: 'bat', idCom: 104, cantidad: 1 })] }))
    expect(fila(inactivo, 'bat').idCom).toBe(101)
  })
  it('fila guardada con id y fecha ausentes → "?" y ""', () => {
    const e = aplicarBorrador(estadoInicial(datos()), contenido({ modelo: '13', filas: [filaBorrador({ prefijo: 'bat', idCom: 101, reutilizado: true, guardada: true })] }))
    expect(fila(e, 'bat')).toMatchObject({ cantidad: 0, reutilizado: true, guardada: { idRep: '?', fecha: '' } })
  })
  it('agotado confirmado usa el stock actual para la variante', () => {
    const b = contenido({ modelo: '13', filas: [filaBorrador({ prefijo: 'cam', idCom: 121, cantidad: 4, agotadoConfirmado: true, descripcionAgotado: 'Cámara trasera completa' })] })
    const conStock = aplicarBorrador(estadoInicial(datos()), b)
    expect(subFila(conStock, fila(conStock, 'cam'))).toEqual({ tipo: 'confirmada', texto: '✓  4 uds. se descontarán al guardar — solicitud pendiente — Cámara trasera completa', lapizHabilitado: true })
    const a = agrupados()
    a.cam = [componente({ idCom: 121, tipo: 'cami13', stock: 0, stockMinimo: 1 })]
    const sinStock = aplicarBorrador(estadoInicial(datos({ agrupados: a })), b)
    expect(fila(sinStock, 'cam').cantidad).toBe(0)
    expect(subFila(sinStock, fila(sinStock, 'cam'))).toEqual({ tipo: 'confirmada', texto: '✓  Solicitud de reposición pendiente — Cámara trasera completa', lapizHabilitado: true })
    expect(fila(sinStock, 'cam').controles).toEqual({ mas: false, menos: false, reutilizado: false, sku: false, observacion: false })
  })
  it('fila normal restaura la cantidad sin revalidar contra el stock (mínimo 0)', () => {
    const e = aplicarBorrador(estadoInicial(datos()), contenido({ modelo: '13', filas: [filaBorrador({ prefijo: 'lcd', idCom: 111, cantidad: 3 }), filaBorrador({ prefijo: 'cha', idCom: 131, cantidad: -2, observacion: 'Chasis doblado' })] }))
    expect(fila(e, 'lcd').cantidad).toBe(3) // lcdi13 solo tiene 1 en stock
    expect(fila(e, 'cha')).toMatchObject({ cantidad: 0, observacion: 'Chasis doblado' })
  })
  it('ignora la fila con solicitud activa y la fila sin SKU para el modelo', () => {
    const conSolicitud = estadoInicial(datos({ solicitudes: [solicitudAsignacion({ idCom: 102 })] }))
    const e = aplicarBorrador(conSolicitud, contenido({ filas: [filaBorrador({ prefijo: 'bat', idCom: 102, cantidad: 2, observacion: 'no debe entrar' }), filaBorrador({ prefijo: 'cam', cantidad: 1 })] }))
    expect(fila(e, 'bat')).toEqual(fila(conSolicitud, 'bat'))
    expect(fila(e, 'cam')).toEqual(fila(conSolicitud, 'cam')) // modelo 14: no hay cámara → sin SKU
    expect(e.borradorRecuperado).toBe(true)
  })
  it('un prefijo que no existe en el formulario se ignora', () => {
    const e = aplicarBorrador(estadoInicial(datos()), contenido({ modelo: '13', filas: [filaBorrador({ prefijo: 'g', idCom: 141, cantidad: 1 })] }))
    expect(e.filas.every((f) => f.cantidad === 0)).toBe(true)
  })
  it('acciones: una línea por descripción no vacía, guardadas bloqueadas', () => {
    const e = aplicarBorrador(estadoInicial(datos()), contenido({
      modelo: '13',
      otros: [
        { descripcion: '  Limpieza del conector de carga ', guardada: true, idRepGenerado: 'R20260916_6', fechaGuardado: '16/09 09:20' },
        { descripcion: '   ', guardada: false },
        { descripcion: 'Ajuste de tornillería', guardada: false },
        { descripcion: 'Soldadura de antena', guardada: true },
      ],
    }))
    expect(e.otros.map((a) => [a.texto, a.origen, a.guardada])).toEqual([
      ['Limpieza del conector de carga', 'nueva', { idRep: 'R20260916_6', fecha: '16/09 09:20' }],
      ['Ajuste de tornillería', 'nueva', null],
      ['Soldadura de antena', 'nueva', { idRep: '?', fecha: '' }],
    ])
    expect(new Set(e.otros.map((a) => a.id)).size).toBe(3)
    expect(e.siguienteIdAccion).toBeGreaterThan(Math.max(...e.otros.map((a) => a.id)))
    expect(e.otros.every((a) => !a.confirmando && !a.guardando)).toBe(true)
  })
  it('marca borradorRecuperado y no sube revision ni volcados', () => {
    const base = estadoInicial(datos())
    const e = aplicarBorrador(base, leerBorrador(BORRADOR_JAVAFX)!)
    expect(e.borradorRecuperado).toBe(true)
    expect(e.revision).toBe(base.revision)
    expect(e.volcados).toBe(base.volcados)
    expect(base.borradorRecuperado).toBe(false) // no muta la entrada
  })
})
