import { describe, expect, it } from 'vitest'
import { asignar, borrarModelo, cambiarPestana, cargar, decidirModelo, escanear, lookupResuelto, marcarTecnico,
  pegar, propagarModelo, quitar } from './colas'
import { entrada, estado, filaTabla, IMEI_1, IMEI_2, IMEI_3 } from './fabrica'

describe('escanear y pegar', () => {
  it('añade a la cola activa, la carga y pide el lookup de modelo y cliente', () => {
    const r = escanear(estado(), IMEI_1)
    expect(r.rep[0]).toMatchObject({ seq: 1, imei: IMEI_1, tipo: 'REPARACION', modeloBuscado: true, buscando: true })
    expect(r.actual).toBe(1)
    expect(r.efectos).toEqual([{ id: 1, tipo: 'lookup', seq: 1, imei: IMEI_1, buscarModelo: true }])
  })
  it('repetido en la cola activa: mensaje y no añade', () => {
    const r = escanear(escanear(estado(), IMEI_1), IMEI_1)
    expect(r.rep).toHaveLength(1)
    expect(r.mensajeScan).toEqual({ texto: 'Ese IMEI ya está en la cola (Reparación).', tono: 'error' })
  })
  it('el mismo IMEI puede estar en Reparación y en Glass', () => {
    const r = escanear(cambiarPestana(escanear(estado(), IMEI_1), 'GLASS'), IMEI_1)
    expect(r.glass).toHaveLength(1)
    expect(r.mensajeScan).toBeNull()
  })
  it('nace con el modelo vivo y sin buscarlo; el cliente se sigue buscando', () => {
    const r = escanear(estado({ modeloPorImei: { [IMEI_1]: '12' } }), IMEI_1)
    expect(r.rep[0]).toMatchObject({ modelo: '12', buscando: false })
    expect(r.efectos[0]).toMatchObject({ tipo: 'lookup', buscarModelo: false })
  })
  it('pegado: añade sin cargar, salta repetidos y avisa en verde', () => {
    const s = escanear(estado(), IMEI_1)
    const r = pegar({ ...s, actual: null }, IMEI_1 + IMEI_2 + IMEI_3)
    expect(r.rep.map((e) => e.imei)).toEqual([IMEI_1, IMEI_2, IMEI_3])
    expect(r.actual).toBeNull()
    expect(r.mensajeScan).toEqual({ texto: '2 IMEIs añadidos · 1 ya estaban en la lista.', tono: 'ok' })
    expect(pegar(estado(), IMEI_1 + IMEI_2).mensajeScan?.texto).toBe('2 IMEIs añadidos.')
  })
  it('pegado corrupto', () => {
    expect(pegar(estado(), '1'.repeat(16)).mensajeScan).toEqual({
      texto: 'Algún IMEI del pegado está corrupto. Revisa que todos los IMEIs son válidos.', tono: 'error' })
  })
})

describe('cargar', () => {
  it('una roja nueva toma los técnicos pegajosos de SU cola, sin comentario ni chasis', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1 })], defTecnicos: { REPARACION: [3], GLASS: [8] }, seq: 1 })
    expect(cargar(s, 1).borrador).toEqual({ tecnicos: [3], comentario: '', esChasis: false })
  })
  it('los técnicos ocupados se desmarcan', () => {
    const s = estado({ tabla: [filaTabla({ idRep: 'A1', imei: IMEI_1, idTec: 3 })], rep: [entrada({ seq: 1, imei: IMEI_1 })],
      defTecnicos: { REPARACION: [3, 4], GLASS: [] }, seq: 1 })
    expect(cargar(s, 1).borrador.tecnicos).toEqual([4])
  })
  it('una verde carga lo suyo y no relanza el lookup', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1, asignada: true, tecnicos: [5], comentario: 'c', esChasis: true })], seq: 1 })
    const r = cargar(s, 1)
    expect(r.borrador).toEqual({ tecnicos: [5], comentario: 'c', esChasis: true })
    expect(r.efectos).toEqual([])
  })
  it('recibe el cliente pegajoso al viajar si no tiene decisión', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1 })], clienteDefault: { idCli: 7, sin: false }, seq: 1 })
    expect(cargar(s, 1).rep[0].idCli).toBe(7)
  })
  it('con glass abierta en BD, "Lleva glass" se desmarca', () => {
    const s = estado({ tabla: [filaTabla({ idRep: 'AG1', imei: IMEI_1, idTec: 4 })], rep: [entrada({ seq: 1, imei: IMEI_1, llevaGlass: true })], seq: 1 })
    expect(cargar(s, 1).rep[0].llevaGlass).toBe(false)
  })
  it('con decisión manual de "sin cliente" ya registrada, el cliente pegajoso no la pisa al viajar', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1 })], clienteDefault: { idCli: 7, sin: false },
      clienteManual: { [IMEI_1]: { idCli: null, sin: false } }, seq: 1 })
    const r = cargar(s, 1)
    expect(r.rep[0].idCli).toBeNull()
    expect(r.rep[0].sinCliente).toBe(false)
  })
})

describe('lookup', () => {
  const buscando = () => estado({ rep: [entrada({ seq: 1, imei: IMEI_1, modeloBuscado: true, buscando: true })], seq: 1 })
  it('aplica el modelo y lo recuerda sin pisar una decisión manual', () => {
    const r = lookupResuelto(buscando(), 1, '12', null)
    expect(r.rep[0]).toMatchObject({ modelo: '12', buscando: false })
    expect(r.modeloPorImei[IMEI_1]).toBe('12')
    const manual = lookupResuelto({ ...buscando(), modeloPorImei: { [IMEI_1]: '13' } }, 1, '12', null)
    expect(manual.modeloPorImei[IMEI_1]).toBe('13')
  })
  it('sin resultado: no encontrado', () => {
    expect(lookupResuelto(buscando(), 1, null, null).rep[0]).toMatchObject({ buscando: false, modeloNoEncontrado: true, modelo: null })
  })
  it('una decisión manual llegada en vuelo no se pisa', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1, buscando: true, modelo: '13' })] })
    expect(lookupResuelto(s, 1, '12', null).rep[0].modelo).toBe('13')
  })
  it('el cliente de BD manda salvo decisión manual; una entrada quitada se ignora', () => {
    expect(lookupResuelto(buscando(), 1, null, 4).rep[0].idCli).toBe(4)
    expect(lookupResuelto({ ...buscando(), clienteManual: { [IMEI_1]: { idCli: null, sin: true } } }, 1, null, 4).rep[0].idCli).toBeNull()
    expect(lookupResuelto(estado(), 1, '12', 4)).toEqual(estado())
  })
})

describe('modelo', () => {
  it('propagarModelo (port de los 3 tests del JavaFX)', () => {
    const rep = [entrada({ seq: 1, imei: IMEI_1, modelo: 'viejo' }), entrada({ seq: 2, imei: IMEI_1, asignada: true }), entrada({ seq: 3, imei: IMEI_2, modelo: 'otro' })]
    const glass = [entrada({ seq: 4, imei: IMEI_1, tipo: 'GLASS' })]
    const r = propagarModelo(IMEI_1, 'nuevo', rep, glass)
    expect(r.n).toBe(3)
    expect([r.rep[0].modelo, r.rep[1].modelo, r.glass[0].modelo, r.rep[2].modelo]).toEqual(['nuevo', 'nuevo', 'nuevo', 'otro'])
    expect(propagarModelo(IMEI_1, 'nuevo', [entrada({ seq: 5, imei: IMEI_2, modelo: 'otro' })], []).n).toBe(0)
    expect(propagarModelo(null, 'nuevo', rep, glass).n).toBe(0)
  })
  it('decidir: propaga a las dos colas, lo recuerda y pide guardarlo', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1 })], glass: [entrada({ seq: 2, imei: IMEI_1, tipo: 'GLASS' })], actual: 1 })
    const r = decidirModelo(s, '14pro')
    expect([r.rep[0].modelo, r.glass[0].modelo]).toEqual(['14pro', '14pro'])
    expect(r.modeloPorImei[IMEI_1]).toBe('14pro')
    expect(r.efectos).toEqual([{ id: 1, tipo: 'guardarModelo', imei: IMEI_1, modelo: '14pro' }])
  })
  it('teclear otra cosa borra el modelo solo de la entrada cargada', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1, modelo: '12' })], glass: [entrada({ seq: 2, imei: IMEI_1, tipo: 'GLASS', modelo: '12' })], actual: 1 })
    const r = borrarModelo(s)
    expect([r.rep[0].modelo, r.glass[0].modelo]).toEqual([null, '12'])
  })
})

describe('técnicos pegajosos', () => {
  it('marcar memoriza en la cola y en la roja; en la verde solo en el borrador', () => {
    const roja = estado({ rep: [entrada({ seq: 1, imei: IMEI_1 })], actual: 1 })
    const r = marcarTecnico(roja, 3, true)
    expect(r.defTecnicos.REPARACION).toEqual([3])
    expect(r.rep[0].tecnicos).toEqual([3])
    const verde = estado({ rep: [entrada({ seq: 1, imei: IMEI_1, asignada: true, tecnicos: [5] })], actual: 1, borrador: { tecnicos: [5], comentario: '', esChasis: false } })
    const v = marcarTecnico(verde, 3, true)
    expect(v.rep[0].tecnicos).toEqual([5])
    expect(v.borrador.tecnicos).toEqual([5, 3])
  })
  it('un ocupado no se puede marcar', () => {
    const s = estado({ tabla: [filaTabla({ idRep: 'A1', imei: IMEI_1, idTec: 3 })], rep: [entrada({ seq: 1, imei: IMEI_1 })], actual: 1 })
    expect(marcarTecnico(s, 3, true).borrador.tecnicos).toEqual([])
  })
})

describe('asignar', () => {
  const lista = (p = {}) => estado({
    rep: [entrada({ seq: 1, imei: IMEI_1, modelo: '12' }), entrada({ seq: 2, imei: IMEI_2, modelo: '13' })],
    actual: 2, seq: 2, borrador: { tecnicos: [3], comentario: '  hola ', esChasis: true }, ...p })

  it('pasa a verde, recorta el comentario, fija pegajosos y carga la siguiente roja (la más nueva)', () => {
    const r = asignar(lista())
    expect(r.rep[1]).toMatchObject({ asignada: true, tecnicos: [3], comentario: 'hola', esChasis: true })
    expect(r.defTecnicos.REPARACION).toEqual([3])
    expect(r.actual).toBe(1)
    expect(r.borrador.tecnicos).toEqual([3])
    expect(r.clienteManual[IMEI_2]).toEqual({ idCli: null, sin: false })
  })
  it('sin modelo o sin técnico no hace nada', () => {
    const s = lista({ borrador: { tecnicos: [], comentario: '', esChasis: false } })
    expect(asignar(s)).toBe(s)
  })
  it('editar una verde ("Guardar cambios") vacía el detalle', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1, modelo: '12', asignada: true, tecnicos: [3] })], actual: 1,
      borrador: { tecnicos: [4], comentario: '', esChasis: false } })
    const r = asignar(s)
    expect(r.rep[0].tecnicos).toEqual([4])
    expect(r.actual).toBeNull()
  })
  it('con "Lleva glass": crea la glass con el modelo de la reparación y pide UNA predicción', () => {
    const s = lista({ rep: [entrada({ seq: 2, imei: IMEI_2, modelo: '13', llevaGlass: true })], actual: 2, seq: 2 })
    const r = asignar(s)
    expect(r.glass[0]).toMatchObject({ imei: IMEI_2, modelo: '13', calculando: true })
    expect(r.efectos.filter((e) => e.tipo === 'prediccion')).toHaveLength(1)
  })
  it('reasignar una reparación re-predice su glass "auto"', () => {
    const s = estado({
      rep: [entrada({ seq: 1, imei: IMEI_1, modelo: '12', asignada: true, tecnicos: [3], llevaGlass: true })],
      glass: [entrada({ seq: 2, imei: IMEI_1, tipo: 'GLASS', asignada: true, auto: true, tecnicos: [4], tokenPrediccion: 1 })],
      actual: 1, seq: 2, borrador: { tecnicos: [5], comentario: '', esChasis: false } })
    const r = asignar(s)
    expect(r.glass[0]).toMatchObject({ asignada: false, auto: false, calculando: true, tokenPrediccion: 2 })
  })
  it('sin "Lleva glass" retira la glass del IMEI; con glass abierta en BD no toca la cola', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1, modelo: '12' })], glass: [entrada({ seq: 2, imei: IMEI_1, tipo: 'GLASS' })],
      actual: 1, seq: 2, borrador: { tecnicos: [3], comentario: '', esChasis: false } })
    expect(asignar(s).glass).toEqual([])
    const bloqueada = { ...s, tabla: [filaTabla({ idRep: 'AG9', imei: IMEI_1, idTec: 9 })] }
    expect(asignar(bloqueada).glass).toHaveLength(1)
  })
  it('asignar a mano una glass le quita "auto" y "Calculando…"', () => {
    const s = estado({ pestana: 'GLASS', glass: [entrada({ seq: 2, imei: IMEI_1, tipo: 'GLASS', modelo: '12', auto: true, asignada: true, tecnicos: [4], calculando: true })],
      actual: 2, borrador: { tecnicos: [6], comentario: '', esChasis: true } })
    expect(asignar(s).glass[0]).toMatchObject({ auto: false, calculando: false, tecnicos: [6], esChasis: false })
  })
})

describe('quitar y cambiar de pestaña', () => {
  it('quitar una reparación se lleva su glass (si no hay glass en BD)', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1 })], glass: [entrada({ seq: 2, imei: IMEI_1, tipo: 'GLASS' })], actual: 1 })
    const r = quitar(s, 1)
    expect([r.rep, r.glass, r.actual]).toEqual([[], [], null])
  })
  it('quitar una glass desmarca la casilla de la reparación', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1, llevaGlass: true })], glass: [entrada({ seq: 2, imei: IMEI_1, tipo: 'GLASS' })] })
    expect(quitar(s, 2).rep[0].llevaGlass).toBe(false)
  })
  it('cambiar de pestaña vacía el detalle y conserva las colas', () => {
    const s = escanear(estado(), IMEI_1)
    const r = cambiarPestana(s, 'GLASS')
    expect(r.actual).toBeNull()
    expect(r.rep).toHaveLength(1)
  })
})
