import { describe, expect, it } from 'vitest'
import { atributos, movilUnidad, pedido, trabajo, unidad } from '../test/fabrica'
import {
  diferencias, filtrar, grupoDe, hace, plegar, queHacer, recuentos, resumenMovil, textoEstado, textoSinPedidoConcreto,
} from './pedidos'

const SIN = new Set<string>()
const P = [
  pedido({ idPedido: 1, unidades: [unidad({ idUnidad: 1 }), unidad({ idUnidad: 2, imei: '350000000000001', estado: 'CUADRA', movil: movilUnidad() })] }),
  pedido({
    idPedido: 2, canal: 'SIMULADOR', numero: '6488', cliente: 'Móviles Levante SL', fuente: 'SIMULADOR',
    unidades: [unidad({ idUnidad: 3, sku: 'i14128NegroA', imei: '350000000000002', estado: 'NO_CUADRA', motivo: 'MODELO', otroOrderId: '6489' })],
  }),
]

describe('reglas de «Pedidos» (spec pieza 2 §9.2)', () => {
  it('cada estado va a su grupo de filtro', () => {
    expect(['SIN_MOVIL', 'NO_EN_NSYS', 'NO_CUADRA', 'NECESITA_TALLER', 'EN_TALLER', 'CUADRA', 'CON_AVISO'].map(grupoDe))
      .toEqual(['sin', 'nocuadra', 'nocuadra', 'nocuadra', 'taller', 'cuadra', 'aviso'])
  })

  it('filtra por canal, por estado y por texto (nº, otro Order id, cliente, SKU, IMEI) y quita los pedidos sin unidades', () => {
    expect(filtrar(P, { canales: new Set(['SIMULADOR']), grupos: new Set(), texto: '' }).map((p) => p.numero)).toEqual(['6488'])
    expect(filtrar(P, { canales: SIN, grupos: new Set(['sin']), texto: '' })[0].unidades.map((u) => u.idUnidad)).toEqual([1])
    expect(filtrar(P, { canales: SIN, grupos: new Set(), texto: '6489' }).map((p) => p.numero)).toEqual(['6488'])
    expect(filtrar(P, { canales: SIN, grupos: new Set(), texto: 'levante' }).map((p) => p.numero)).toEqual(['6488'])
    expect(filtrar(P, { canales: SIN, grupos: new Set(), texto: '0000000000001' })[0].unidades.map((u) => u.idUnidad)).toEqual([2])
  })

  it('cuenta unidades por canal (de todo) y por estado (dentro del canal elegido)', () => {
    const r = recuentos(P, new Set(['AMAZON']))
    expect(r.porCanal).toEqual({ AMAZON: 2, SIMULADOR: 1 })
    expect(r.porGrupo).toEqual({ sin: 1, nocuadra: 0, aviso: 0, taller: 0, cuadra: 1 })
  })

  it('pliega las que cuadran si son 3 o más', () => {
    const us = [1, 2, 3].map((i) => unidad({ idUnidad: i, estado: 'CUADRA' })).concat(unidad({ idUnidad: 4 }))
    expect(plegar(us, false)).toEqual({ visibles: [us[3]], plegadas: 3, plegable: true })
    expect(plegar(us, true)).toEqual({ visibles: us, plegadas: 0, plegable: true })
    expect(plegar(us.slice(2), false).plegable).toBe(false)
  })

  it('la tabla de diferencias dice qué no coincide y si lo cambia el taller', () => {
    const d = diferencias(atributos(), movilUnidad({ modeloMaestro: '13 mini', color: 'Rojo' }))
    expect(d.filter((x) => x.distinto).map((x) => [x.dato, x.pide, x.es, x.taller]))
      .toEqual([['Modelo', 'iPhone 13', 'iPhone 13 mini', 'nunca'], ['Color', 'Azul', 'Rojo', 'sí (chasis)']])
  })

  it('el texto del estado y qué hacer', () => {
    expect(textoEstado(unidad())).toBe('Sin móvil')
    expect(queHacer(unidad(), 'AMAZON')).toBe('Tecléalo en PEDIDOS 2026, como hoy. El ERP lo lee en unos minutos.')
    expect(queHacer(unidad(), 'SIMULADOR')).toBe('Tecléalo en el Simulador, como hoy. El ERP lo lee en unos minutos.')
    const enTaller = unidad({ imei: '350000000000001', estado: 'EN_TALLER', movil: movilUnidad({ trabajos: [trabajo({ tecnico: 'Técnico 1' })] }) })
    expect(textoEstado(enTaller)).toBe('En el taller con Técnico 1 · tiene que acabar en i13128AzulA')
    expect(textoEstado(unidad({ estado: 'NO_CUADRA', motivo: 'MODELO' }))).toBe('No cuadra: el modelo, la capacidad o el eSIM no son los del pedido')
    expect(queHacer(unidad({ estado: 'NO_CUADRA', motivo: 'MODELO' }), 'SIMULADOR')).toBe('Hay que cambiar el IMEI en el Simulador: el taller no cambia eso.')
    expect(textoEstado(unidad({ estado: 'CON_AVISO', motivo: 'B_POR_A' }))).toBe('Cuadra, con aviso: B por A (en Amazon un B puede ir por A; míralo antes)')
  })

  it('el resumen del móvil para la lista y los días', () => {
    expect(resumenMovil(unidad())).toBe('sin móvil')
    expect(resumenMovil(unidad({ imei: '350000000000001', movil: movilUnidad() }))).toBe('3500…0001 · Listos')
    expect(hace('2026-10-30T10:00:00', '2026-11-04')).toBe('hace 5 días')
    expect(hace('2026-11-04T08:00:00', '2026-11-04')).toBe('hoy')
    expect(hace('2026-11-03T08:00:00', '2026-11-04')).toBe('ayer')
  })

  it('por qué «sin pedido concreto»: cuántos IMEIs de ese SKU hay tecleados y cuántos pedidos pendientes', () => {
    const amazon = [
      pedido({ idPedido: 1, unidades: [unidad({ idUnidad: 1, imei: '350000000000001', sinPedidoConcreto: true })] }),
      pedido({ idPedido: 2, numero: '402-0000000-0000002', unidades: [unidad({ idUnidad: 2, imei: '350000000000002', sinPedidoConcreto: true })] }),
      pedido({ idPedido: 3, numero: '402-0000000-0000003', unidades: [unidad({ idUnidad: 3 })] }),
    ]
    expect(textoSinPedidoConcreto(amazon[0].unidades[0], amazon)).toBe(
      'En PEDIDOS 2026 hay 2 IMEIs tecleados para i13128AzulA en filas «Amazon», sin número de pedido. El ERP se los da a los 2 '
      + 'pedidos más antiguos de ese SKU (hay 3 pendientes): el móvil más avanzado va al pedido más antiguo, como hoy al preparar el envío.')
  })
})
