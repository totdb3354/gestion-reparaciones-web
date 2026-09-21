import { describe, expect, it } from 'vitest'
import { componente } from '../test/fabrica'
import { alertasOrdenadas, esAlerta, hayAlertas } from './alertas'

describe('alertas de stock (ficha notificaciones.md, "Pulso de alertas" y "Pestaña Alertas")', () => {
  it('alertas: master, activo y stock <= mínimo (0 con mínimo 0 cuenta; slave e inactivo no)', () => {
    expect(esAlerta(componente({ stock: 2, stockMinimo: 2 }))).toBe(true)
    expect(esAlerta(componente({ stock: 0, stockMinimo: 0 }))).toBe(true)
    expect(esAlerta(componente({ stock: 3, stockMinimo: 2 }))).toBe(false)
    expect(esAlerta(componente({ stock: 0, idComMaster: 101 }))).toBe(false)
    expect(esAlerta(componente({ stock: 0, activo: false }))).toBe(false)
  })
  it('orden sin stock → stock bajo, conservando el orden recibido', () => {
    const lista = [
      componente({ idCom: 101, tipo: 'bati13', stock: 1, stockMinimo: 2 }),
      componente({ idCom: 102, tipo: 'bati14', stock: 0, stockMinimo: 2 }),
      componente({ idCom: 111, tipo: 'lcdi13', stock: 1, stockMinimo: 1 }),
      componente({ idCom: 112, tipo: 'lcdi14', stock: 3, stockMinimo: 1 }),
      componente({ idCom: 142, tipo: 'gi14', stock: 0, stockMinimo: 2 }),
    ]
    expect(alertasOrdenadas(lista).map((a) => [a.componente.idCom, a.nivel])).toEqual([
      [102, 'sinStock'],
      [142, 'sinStock'],
      [101, 'stockBajo'],
      [111, 'stockBajo'],
    ])
  })
  it('stock negativo cuenta en hayAlertas y no tiene tarjeta', () => {
    const negativo = [componente({ idCom: 121, tipo: 'cami13', stock: -1, stockMinimo: 1 })]
    expect(hayAlertas(negativo)).toBe(true)
    expect(alertasOrdenadas(negativo)).toEqual([])
    expect(hayAlertas([componente({ stock: 5, stockMinimo: 2 })])).toBe(false)
    expect(hayAlertas([])).toBe(false)
  })
})
