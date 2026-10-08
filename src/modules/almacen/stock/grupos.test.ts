import { describe, expect, it } from 'vitest'
import type { Componente } from '@/shared/api/client'
import { agruparCompartidos, esGrupo, nombreGrupo } from './grupos'

const base: Componente = { idCom: 1, tipo: 'a', fechaRegistro: '2026-09-01T10:00:00', stock: 5, stockMinimo: 2, activo: true, updatedAt: '2026-09-01T10:00:00', enCamino: 0, ultimoPedido: null, idComMaster: null, consumoDiario: null, pedir60: null, autoPedido: null }
const c = (o: Partial<Componente>): Componente => ({ ...base, ...o })

describe('agruparCompartidos', () => {
  it('un master con dos slaves es una sola fila con los tres miembros y el nombre de todos', () => {
    const [master, s1, s2] = [c({ idCom: 1, tipo: 'a' }), c({ idCom: 2, tipo: 'b', idComMaster: 1 }), c({ idCom: 3, tipo: 'c', idComMaster: 1 })]
    const filas = agruparCompartidos([master, s1, s2])
    expect(filas).toHaveLength(1)
    expect(filas[0].idCom).toBe(1)
    expect(filas[0].miembros).toEqual([master, s1, s2])
    expect(nombreGrupo(filas[0])).toBe('a / b / c')
    expect(esGrupo(filas[0])).toBe(true)
  })
  it('un componente suelto lleva solo a sí mismo y no es grupo', () => {
    const suelto = c({ idCom: 7, tipo: 'z' })
    const [fila] = agruparCompartidos([suelto])
    expect(fila.miembros).toEqual([suelto])
    expect(nombreGrupo(fila)).toBe('z')
    expect(esGrupo(fila)).toBe(false)
  })
  it('un slave cuyo master no está en la lista queda como fila suelta', () => {
    const huerfano = c({ idCom: 5, tipo: 'h', idComMaster: 99 })
    const filas = agruparCompartidos([huerfano])
    expect(filas).toHaveLength(1)
    expect(filas[0].miembros).toEqual([huerfano])
  })
  it('un slave cuyo master es a su vez slave (cadena) queda como fila suelta, sin desaparecer', () => {
    const lista = [c({ idCom: 1, tipo: 'a' }), c({ idCom: 2, tipo: 'b', idComMaster: 1 }), c({ idCom: 3, tipo: 'c', idComMaster: 2 })]
    const filas = agruparCompartidos(lista)
    expect(filas.map((f) => f.idCom)).toEqual([1, 3])
    expect(filas[0].miembros.map((m) => m.idCom)).toEqual([1, 2])
    expect(filas[1].miembros.map((m) => m.idCom)).toEqual([3])
  })
  it('conserva el orden de la lista y el slave puede ir antes que su master', () => {
    const lista = [c({ idCom: 4, tipo: 'd' }), c({ idCom: 2, tipo: 'b', idComMaster: 1 }), c({ idCom: 1, tipo: 'a' }), c({ idCom: 3, tipo: 'c', idComMaster: 1 }), c({ idCom: 6, tipo: 'f' })]
    const filas = agruparCompartidos(lista)
    expect(filas.map((f) => f.idCom)).toEqual([4, 1, 6])
    expect(filas[1].miembros.map((m) => m.tipo)).toEqual(['a', 'b', 'c'])
  })
  it('una lista sin grupos sale igual', () => {
    const lista = [c({ idCom: 1, tipo: 'a' }), c({ idCom: 2, tipo: 'b' })]
    expect(agruparCompartidos(lista).map((f) => f.idCom)).toEqual([1, 2])
    expect(agruparCompartidos([])).toEqual([])
  })
})
