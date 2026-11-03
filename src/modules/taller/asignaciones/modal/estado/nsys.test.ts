import { describe, expect, it } from 'vitest'
import { noEstaEnNsys } from './derivados'
import { estado, IMEI_1, IMEI_2 } from './fabrica'
import { nsysComprobado, preguntarNsys } from './nsys'
import { reducir } from './reductor'

describe('0.9.23: pregunta a NSYS', () => {
  it('pide los IMEIs nuevos una sola vez y los apunta sin respuesta', () => {
    const r = preguntarNsys(estado(), [IMEI_1, IMEI_2, IMEI_1])
    expect(r.efectos).toEqual([{ id: 1, tipo: 'comprobarNsys', imeis: [IMEI_1, IMEI_2] }])
    expect(r.enNsys).toEqual({ [IMEI_1]: null, [IMEI_2]: null })
  })

  it('lo ya preguntado, con respuesta o sin ella, no se vuelve a pedir; sin nada nuevo no hay efecto', () => {
    const s = estado({ enNsys: { [IMEI_1]: null, [IMEI_2]: false } })
    expect(preguntarNsys(s, [IMEI_1, IMEI_2])).toBe(s)
    const vacio = estado()
    expect(preguntarNsys(vacio, [])).toBe(vacio)
  })

  it('la respuesta se fusiona (también por el reductor) y solo «false» es «no está»', () => {
    const s = nsysComprobado(estado({ enNsys: { [IMEI_1]: null, [IMEI_2]: null } }), { [IMEI_1]: false, [IMEI_2]: true })
    expect(s.enNsys).toEqual({ [IMEI_1]: false, [IMEI_2]: true })
    expect(reducir(estado(), { tipo: 'NSYS_COMPROBADO', resultado: { [IMEI_1]: false } }).enNsys).toEqual({ [IMEI_1]: false })
    expect(noEstaEnNsys(s, IMEI_1)).toBe(true)
    expect(noEstaEnNsys(s, IMEI_2)).toBe(false)
    expect(noEstaEnNsys(estado({ enNsys: { [IMEI_1]: null } }), IMEI_1)).toBe(false)
    expect(noEstaEnNsys(estado(), IMEI_1)).toBe(false)
  })
})
