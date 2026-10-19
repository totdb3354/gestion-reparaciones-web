import { describe, expect, it } from 'vitest'
import { movilBuscado, trabajo, visto } from '../test/fabrica'
import {
  BATERIA_NUEVA, capacidadCorta, contarFiltros, cuentaComoStock, FILTROS_VACIOS, modelosLista, muestraColor, opciones, ordenarTabla, pasa,
  normalizar, partesSku, pasaSku, pestanasCapacidad, reparto, textoBuscado, textoCapacidad, valores,
} from './modelo'
import { CON_DESCUADRE, SIN_ASIGNAR } from './quien'

const A = visto({ imeiSn: '350000000000001', color: 'Azul', grado: 'A', ubicacion: 'Listos' })
const B = visto({ imeiSn: '350000000000002', color: 'Azul', grado: 'A-', bateriaNueva: true, ubicacion: 'Taller · Glass', estado: 'DE_PEDIDO', dias: 30 })
const C = visto({ imeiSn: '350000000000003', color: 'Rosa', grado: 'n/a', ubicacion: 'En revisión' })
const D = visto({ imeiSn: '350000000000004', color: 'Azul', grado: 'B', ubicacion: 'Esperando pieza', estado: 'NO_CUENTA' })
const E = visto({ imeiSn: '350000000000005', modelo: '14', modeloMaestro: '14', ubicacion: 'Listos' })
const F = visto({ imeiSn: '350000000000006', modelo: null, modeloMaestro: null, capacidad: null })
const DOS = visto({ imeiSn: '350000000000008', ubicacion: 'Taller · Reparación', trabajos: [trabajo({ tecnico: 'Técnico 1' }), trabajo({ categoria: 'GLASS', tecnico: 'Técnico 3' })] })

describe('stock de teléfonos: una fila por modelo (spec 0.9.18 §4.1) y pestañas de capacidad (§4.3)', () => {
  it('una fila por modelo: del catálogo del más nuevo al más antiguo, los del maestro después y los sin modelo al final', () => {
    expect(modelosLista([A, F, E], false).map((g) => g.clave)).toEqual(['iPhone 14', 'iPhone 13', 'Sin modelo en el maestro'])
    const p = (modelo: string | null, capacidad: string | null, maestro: string | null = modelo) => visto({ modelo, modeloMaestro: maestro, capacidad })
    const lista = [
      p(null, null, null), p('xsmax', '64GB'), p(null, '128GB', '17e'), p('13promax', '1TB'), p('se2020', '64GB'),
      p('16', '128GB'), p('13promax', '256GB'), p('16e', '128GB'),
    ]
    expect(modelosLista(lista, false).map((g) => g.clave)).toEqual([
      'iPhone 16e', 'iPhone 16', 'iPhone 13 Pro Max', 'iPhone XS Max', 'iPhone SE 2020', 'iPhone 17e', 'Sin modelo en el maestro',
    ])
  })

  it('el total y las capacidades cuentan solo el stock, también con el interruptor; capacidades de menor a mayor', () => {
    const fila = modelosLista([A, B, C, D, visto({ imeiSn: '350000000000009', capacidad: '1TB' }),
      visto({ imeiSn: '350000000000010', capacidad: '256GB', estado: 'DE_PEDIDO' })], true)[0]
    expect(fila.clave).toBe('iPhone 13')
    expect(fila.total).toBe(3)
    expect(fila.capacidades).toEqual([{ capacidad: '128GB', stock: 2 }, { capacidad: '256GB', stock: 0 }, { capacidad: '1TB', stock: 1 }])
    expect(fila.reparto).toEqual({ listos: 2, taller: 0, revision: 1 })
    expect(fila.moviles).toHaveLength(6)
    expect(modelosLista([A, B, C, D], false)[0].moviles).toHaveLength(2)
  })

  it('con el interruptor apagado solo salen los modelos con stock', () => {
    expect(modelosLista([B, D], false)).toEqual([])
    expect(modelosLista([B, D], true).map((g) => g.clave)).toEqual(['iPhone 13'])
  })

  it('las pestañas: «Todas» y cada capacidad del modelo; sin stock, apagadas salvo con el interruptor si tienen algo', () => {
    const todos = [A, C, visto({ imeiSn: '350000000000010', capacidad: '512GB', estado: 'DE_PEDIDO' })]
    expect(pestanasCapacidad(todos, false)).toEqual([
      { capacidad: null, stock: 2, activa: true }, { capacidad: '128GB', stock: 2, activa: true }, { capacidad: '512GB', stock: 0, activa: false },
    ])
    expect(pestanasCapacidad(todos, true)[2]).toEqual({ capacidad: '512GB', stock: 0, activa: true })
  })

  it('textos de la capacidad: «128 GB» en las pestañas y «128» en las pastillas', () => {
    expect(textoCapacidad('128GB')).toBe('128 GB')
    expect(textoCapacidad('1TB')).toBe('1 TB')
    expect(textoCapacidad('—')).toBe('—')
    expect(capacidadCorta('128GB')).toBe('128')
    expect(capacidadCorta('1TB')).toBe('1TB')
  })

  it('lo que está de pedido no cuenta como stock vendible, como el Excel', () => {
    expect(cuentaComoStock(B)).toBe(false)
    expect(cuentaComoStock(D)).toBe(false)
    expect(cuentaComoStock(A)).toBe(true)
    expect(reparto([B, D])).toEqual({ listos: 0, taller: 0, revision: 0 })
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

describe('stock de teléfonos: filtro de SKU (spec 0.9.18 §4.2)', () => {
  const G = visto({ sku: 'i13PRO128GrafitoA' })
  it('sin mayúsculas ni espacios', () => {
    expect(normalizar(' i13 PRO ')).toBe('i13pro')
  })

  it('SKU exacto o que empieza por lo escrito; sin SKU, no pasa', () => {
    expect(pasaSku(G, null)).toBe(true)
    expect(pasaSku(G, { texto: 'i13pro128grafitoa', exacto: true })).toBe(true)
    expect(pasaSku(G, { texto: 'i13PRO128', exacto: true })).toBe(false)
    expect(pasaSku(G, { texto: 'i13 pro', exacto: false })).toBe(true)
    expect(pasaSku(visto({ sku: null }), { texto: 'i13', exacto: false })).toBe(false)
  })

  it('la parte buscada del SKU, para resaltarla', () => {
    expect(partesSku('i13PRO128GrafitoA', { texto: 'i13pro', exacto: false })).toEqual(['i13PRO', '128GrafitoA'])
    expect(partesSku('i13PRO128GrafitoA', { texto: 'i13PRO128GrafitoA', exacto: true })).toEqual(['i13PRO128GrafitoA', ''])
    expect(partesSku('i14128AzulA', { texto: 'i13', exacto: false })).toBeNull()
    expect(partesSku('i13PRO128GrafitoA', null)).toBeNull()
  })
})
