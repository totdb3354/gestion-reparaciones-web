import { describe, expect, it } from 'vitest'
import { reducir } from './reductor'
import { estado, IMEI_1 } from './fabrica'

describe('reducir', () => {
  it('encadena un flujo corto', () => {
    let s = reducir(estado(), { tipo: 'ESCANEAR', imei: IMEI_1 })
    s = reducir(s, { tipo: 'LOOKUP_RESUELTO', seq: 1, modelo: '12', idCliBd: null })
    s = reducir(s, { tipo: 'MARCAR_TECNICO', idTec: 3, marcado: true, orden: [3] })
    s = reducir(s, { tipo: 'MARCAR_LLEVA_GLASS', valor: true })
    s = reducir(s, { tipo: 'ASIGNAR' })
    expect(s.rep[0].asignada).toBe(true)
    expect(s.glass[0].calculando).toBe(true)
    const pred = s.efectos.find((e) => e.tipo === 'prediccion')!
    s = reducir(s, { tipo: 'PREDICCION_RESUELTA', seq: s.glass[0].seq, token: 1, idTec: 4 })
    expect(s.glass[0]).toMatchObject({ asignada: true, auto: true, tecnicos: [4] })
    s = reducir(s, { tipo: 'EFECTOS_CONSUMIDOS', ids: [pred.id] })
    expect(s.efectos.some((e) => e.id === pred.id)).toBe(false)
  })
  it('pestañas y pulido', () => {
    let s = reducir(estado(), { tipo: 'CAMBIAR_PESTANA', pestana: 'PULIDO' })
    s = reducir(s, { tipo: 'PULIDO_ESCANEAR', imei: IMEI_1 })
    expect(s.pulido).toHaveLength(1)
  })
  it('cerrar el aviso de predicción', () => {
    expect(reducir(estado({ avisoPrediccion: true }), { tipo: 'CERRAR_AVISO_PREDICCION' }).avisoPrediccion).toBe(false)
  })
})
