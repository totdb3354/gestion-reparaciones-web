import { describe, expect, it } from 'vitest'
import { movilBuscado, trabajo, visto } from '../test/fabrica'
import {
  agrupar, BATERIA_NUEVA, contarFiltros, cuentaComoStock, FILTROS_VACIOS, grupoDe, muestraColor, opciones, ordenarTabla, pasa, textoBuscado, totales, valores,
} from './modelo'
import { CON_DESCUADRE, SIN_ASIGNAR } from './quien'

const A = visto({ imeiSn: '350000000000001', color: 'Azul', grado: 'A', ubicacion: 'Listos' })
const B = visto({ imeiSn: '350000000000002', color: 'Azul', grado: 'A-', bateriaNueva: true, ubicacion: 'Taller · Glass', estado: 'DE_PEDIDO', dias: 30 })
const C = visto({ imeiSn: '350000000000003', color: 'Rosa', grado: 'n/a', ubicacion: 'En revisión' })
const D = visto({ imeiSn: '350000000000004', color: 'Azul', grado: 'B', ubicacion: 'Esperando pieza', estado: 'NO_CUENTA' })
const E = visto({ imeiSn: '350000000000005', modelo: '14', modeloMaestro: '14', ubicacion: 'Listos' })
const F = visto({ imeiSn: '350000000000006', modelo: null, modeloMaestro: null, capacidad: null })
const DOS = visto({ imeiSn: '350000000000008', ubicacion: 'Taller · Reparación', trabajos: [trabajo({ tecnico: 'Técnico 1' }), trabajo({ categoria: 'GLASS', tecnico: 'Técnico 3' })] })

describe('stock de teléfonos: grupos y totales', () => {
  it('modelo + capacidad, del más nuevo al más antiguo y los sin modelo al final', () => {
    expect(grupoDe(A)).toBe('iPhone 13 128GB')
    expect(agrupar([A, F, E, B], false).map((g) => g.clave)).toEqual(['iPhone 14 128GB', 'iPhone 13 128GB', 'Sin modelo en el maestro'])
  })

  it('lo que no cuenta como stock solo sale con el interruptor y nunca suma en los totales', () => {
    expect(agrupar([A, B, C, D], false)[0].moviles).toHaveLength(2)
    const conTodo = agrupar([A, B, C, D], true)[0]
    expect(conTodo.moviles).toHaveLength(4)
    expect(conTodo.totales).toEqual({ total: 2, libres: 2, listos: 1, taller: 0, revision: 1, noCuentan: 2 })
    expect(totales([D])).toEqual({ total: 0, libres: 0, listos: 0, taller: 0, revision: 0, noCuentan: 1 })
  })

  it('lo que está de pedido no cuenta como stock vendible, como el Excel', () => {
    expect(cuentaComoStock(B)).toBe(false)
    expect(cuentaComoStock(D)).toBe(false)
    expect(cuentaComoStock(A)).toBe(true)
    expect(agrupar([B], false)).toEqual([])
  })
})

describe('stock de teléfonos: filtros', () => {
  it('valores de cada dimensión; en el técnico, varios o ninguno', () => {
    expect(valores('bateria', B)).toEqual([BATERIA_NUEVA])
    expect(valores('ubicacion', visto({ ubicacion: null }))).toEqual(['—'])
    expect(valores('tecnico', DOS)).toEqual(['Técnico 1', 'Técnico 3'])
    expect(valores('tecnico', visto({ ubicacion: 'Taller · Glass' }))).toEqual([SIN_ASIGNAR])
    expect(valores('tecnico', A)).toEqual([])
  })

  it('las opciones cuentan con los demás filtros puestos y los grados van en su orden', () => {
    const f = { ...FILTROS_VACIOS, color: new Set(['Azul']) }
    expect(opciones([A, B, C], 'grado', f)).toEqual([{ valor: 'A', cuenta: 1 }, { valor: 'A-', cuenta: 1 }, { valor: 'n/a', cuenta: 0 }])
    expect(opciones([A, B, C], 'color', f)).toEqual([{ valor: 'Azul', cuenta: 2 }, { valor: 'Rosa', cuenta: 1 }])
  })

  it('las opciones del técnico: los técnicos por nombre y al final sin asignar y con descuadre', () => {
    const lista = [
      visto({ imeiSn: '350000000000011', ubicacion: 'Taller · Reparación', trabajos: [trabajo({ tecnico: 'Técnico 2' })] }),
      visto({ imeiSn: '350000000000012', ubicacion: 'Taller · Glass' }),
      visto({ imeiSn: '350000000000013', ubicacion: 'Listos', trabajos: [trabajo({ tecnico: 'Técnico 1' })] }),
    ]
    expect(opciones(lista, 'tecnico', FILTROS_VACIOS)).toEqual([
      { valor: 'Técnico 1', cuenta: 1 }, { valor: 'Técnico 2', cuenta: 1 }, { valor: SIN_ASIGNAR, cuenta: 1 }, { valor: CON_DESCUADRE, cuenta: 1 },
    ])
  })

  it('dentro de un filtro basta con que coincida uno de los valores del móvil', () => {
    expect(pasa(DOS, { ...FILTROS_VACIOS, tecnico: new Set(['Técnico 3']) })).toBe(true)
    expect(pasa(DOS, { ...FILTROS_VACIOS, tecnico: new Set([SIN_ASIGNAR]) })).toBe(false)
  })

  it('pasa los filtros salvo las dimensiones que se están contando', () => {
    const f = { ...FILTROS_VACIOS, color: new Set(['Rosa']), ubicacion: new Set(['Listos']) }
    expect(pasa(A, f)).toBe(false)
    expect(pasa(A, f, ['color'])).toBe(true)
    expect(pasa(C, f, ['color', 'ubicacion'])).toBe(true)
    expect(contarFiltros(f)).toBe(2)
  })

  it('la tabla: primero lo que cuenta; dentro, los descuadres y los sin asignar; luego por días, de menos a más', () => {
    const descuadre = visto({ imeiSn: '350000000000021', ubicacion: 'Listos', dias: 40, trabajos: [trabajo()] })
    const enCaja = visto({ imeiSn: '350000000000022', ubicacion: 'Taller · Pulir', dias: 30 })
    const nuevo = visto({ imeiSn: '350000000000023', ubicacion: 'Listos', dias: 1 })
    const viejo = visto({ imeiSn: '350000000000024', ubicacion: 'Listos', dias: 9 })
    const sinDias = visto({ imeiSn: '350000000000025', ubicacion: 'Listos', dias: null })
    expect(ordenarTabla([B, viejo, sinDias, nuevo, enCaja, descuadre]).map((m) => m.imeiSn)).toEqual([
      '350000000000021', '350000000000022', '350000000000023', '350000000000024', '350000000000025', '350000000000002',
    ])
  })

  it('texto de un móvil encontrado por el buscador', () => {
    expect(textoBuscado(movilBuscado())).toBe('Listos')
    expect(textoBuscado(movilBuscado({ estado: 'DE_PEDIDO', ubicacion: 'Taller · Glass' }))).toBe('De pedido · Taller · Glass')
    expect(textoBuscado(movilBuscado({ estado: 'VENDIDO', ubicacion: null, fechaVenta: '2023-05-02' }))).toBe('Vendido el 02/05/2023')
    expect(textoBuscado(movilBuscado({ estado: 'BAJA', ubicacion: null }))).toBe('Baja en NSYS')
  })

  it('muestra del color: en español o en inglés, sin mayúsculas; gris si no se conoce', () => {
    expect(muestraColor('Azul')).toBe('#3b6fd1')
    expect(muestraColor('midnight')).toBe('#1d2533')
    expect(muestraColor('Titanio desierto')).toBe('#cccccc')
    expect(muestraColor(null)).toBe('#cccccc')
  })
})
