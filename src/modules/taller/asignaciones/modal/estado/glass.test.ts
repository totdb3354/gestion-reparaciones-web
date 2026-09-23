import { describe, expect, it } from 'vitest'
import { crearGlassDe, marcarLlevaGlass, predecir, prediccionFallida, prediccionResuelta, quitarGlassDe, vincularGlass } from './glass'
import { entrada, estado, filaTabla, IMEI_1, IMEI_2 } from './fabrica'

const conGlassEnBd = [filaTabla({ idRep: 'AG1', imei: IMEI_1, idTec: 4 })]

describe('glass: invariante casilla ⇔ glass en la cola', () => {
  it('al escanear una reparación de un IMEI que ya está en Glass, nace marcada', () => {
    const s = estado({ glass: [entrada({ seq: 1, imei: IMEI_1, tipo: 'GLASS' })] })
    expect(vincularGlass(s, entrada({ seq: 2, imei: IMEI_1 })).e.llevaGlass).toBe(true)
  })
  it('al escanear una glass, marca las reparaciones del IMEI', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1 })] })
    expect(vincularGlass(s, entrada({ seq: 2, imei: IMEI_1, tipo: 'GLASS' })).s.rep[0].llevaGlass).toBe(true)
  })
  it('con glass abierta en BD no se vincula nada', () => {
    const s = estado({ tabla: conGlassEnBd, glass: [entrada({ seq: 1, imei: IMEI_1, tipo: 'GLASS' })] })
    expect(vincularGlass(s, entrada({ seq: 2, imei: IMEI_1 })).e.llevaGlass).toBe(false)
  })

  it('marcar en una roja es solo intención', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1 })], actual: 1, seq: 1 })
    const r = marcarLlevaGlass(s, true)
    expect(r.rep[0].llevaGlass).toBe(true)
    expect(r.glass).toEqual([])
  })
  it('marcar en una verde crea la glass con modelo y cliente, sin comentario, y pide la predicción', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1, asignada: true, tecnicos: [3], modelo: '12', idCli: 5, comentario: 'x' })], actual: 1, seq: 1 })
    const r = marcarLlevaGlass(s, true)
    expect(r.glass[0]).toMatchObject({ seq: 2, imei: IMEI_1, tipo: 'GLASS', modelo: '12', idCli: 5, comentario: '', calculando: true, tokenPrediccion: 1, modeloBuscado: true })
    expect(r.efectos).toEqual([{ id: 1, tipo: 'prediccion', seq: 2, token: 1, imei: IMEI_1, conCliente: true,
      verdes: [{ imei: IMEI_1, idTec: 3, tipo: 'REPARACION', esChasis: false, conCliente: true }] }])
  })
  it('desmarcar retira la glass del IMEI esté como esté', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1, llevaGlass: true })],
      glass: [entrada({ seq: 2, imei: IMEI_1, tipo: 'GLASS', asignada: true, tecnicos: [4] })], actual: 1 })
    const r = marcarLlevaGlass(s, false)
    expect(r.glass).toEqual([])
    expect(r.rep[0].llevaGlass).toBe(false)
  })
  it('la glass creada toma el modelo vivo si la reparación no lo tiene', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1 })], modeloPorImei: { [IMEI_1]: '13' }, seq: 1 })
    expect(crearGlassDe(s, 1).glass[0].modelo).toBe('13')
  })
  it('no crea una segunda glass del mismo IMEI', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1 })], glass: [entrada({ seq: 2, imei: IMEI_1, tipo: 'GLASS' })], seq: 2 })
    expect(crearGlassDe(s, 1).glass).toHaveLength(1)
  })
  it('quitar la glass vacía el detalle si era la cargada', () => {
    const s = estado({ glass: [entrada({ seq: 2, imei: IMEI_1, tipo: 'GLASS' })], actual: 2 })
    expect(quitarGlassDe(s, IMEI_1).actual).toBeNull()
  })
})

describe('glass: predicción', () => {
  const roja = (p = {}) => estado({ glass: [entrada({ seq: 2, imei: IMEI_1, tipo: 'GLASS', ...p })] })

  it('una glass asignada a mano o con técnicos no se predice', () => {
    expect(predecir(roja({ asignada: true, tecnicos: [4] }), 2).efectos).toEqual([])
    expect(predecir(roja({ tecnicos: [4] }), 2).efectos).toEqual([])
  })
  it('una auto se resetea y se vuelve a pedir', () => {
    const r = predecir(roja({ asignada: true, auto: true, tecnicos: [4], tokenPrediccion: 1 }), 2)
    expect(r.glass[0]).toMatchObject({ asignada: false, auto: false, tecnicos: [], calculando: true, tokenPrediccion: 2 })
    expect(r.efectos).toHaveLength(1)
  })
  it('la respuesta la deja verde y "auto"', () => {
    const r = prediccionResuelta(roja({ calculando: true, tokenPrediccion: 1 }), 2, 1, 4)
    expect(r.glass[0]).toMatchObject({ calculando: false, asignada: true, auto: true, tecnicos: [4] })
  })
  it('sin candidato se queda roja', () => {
    expect(prediccionResuelta(roja({ calculando: true, tokenPrediccion: 1 }), 2, 1, null).glass[0])
      .toMatchObject({ calculando: false, asignada: false, tecnicos: [] })
  })
  it('una respuesta vieja, o de una glass quitada o ya asignada a mano, se ignora', () => {
    const s = roja({ calculando: true, tokenPrediccion: 2 })
    expect(prediccionResuelta(s, 2, 1, 4)).toBe(s)
    expect(prediccionResuelta(estado(), 2, 1, 4)).toEqual(estado())
    const aMano = roja({ asignada: true, tecnicos: [5], calculando: false, tokenPrediccion: 1 })
    expect(prediccionResuelta(aMano, 2, 1, 4)).toBe(aMano)
  })
  it('si falla, roja y aviso', () => {
    const r = prediccionFallida(roja({ calculando: true, tokenPrediccion: 1 }), 2, 1)
    expect(r.glass[0].calculando).toBe(false)
    expect(r.avisoPrediccion).toBe(true)
  })
  it('las verdes que viajan excluyen a la propia glass reseteada', () => {
    const s = estado({ glass: [entrada({ seq: 2, imei: IMEI_1, tipo: 'GLASS', asignada: true, auto: true, tecnicos: [4] }),
      entrada({ seq: 3, imei: IMEI_2, tipo: 'GLASS', asignada: true, tecnicos: [5] })] })
    const ef = predecir(s, 2).efectos[0]
    expect(ef.tipo === 'prediccion' && ef.verdes.map((v) => v.idTec)).toEqual([5])
  })
})
