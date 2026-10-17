import { describe, expect, it } from 'vitest'
import { movil, movilBuscado } from '../test/fabrica'
import {
  agrupar, BATERIA_NUEVA, contarFiltros, cuentaComoStock, FILTROS_VACIOS, grupoDe, muestraColor, opciones, ordenarTabla, pasa, textoBuscado, totales, valor,
} from './modelo'

const A = movil({ imeiSn: '350000000000001', color: 'Azul', grado: 'A', ubicacion: 'Listos' })
const B = movil({ imeiSn: '350000000000002', color: 'Azul', grado: 'A-', bateriaNueva: true, ubicacion: 'Taller · Glass', estado: 'DE_PEDIDO', dias: 30 })
const C = movil({ imeiSn: '350000000000003', color: 'Rosa', grado: 'n/a', ubicacion: 'En revisión' })
const D = movil({ imeiSn: '350000000000004', color: 'Azul', grado: 'B', ubicacion: 'Esperando pieza', estado: 'NO_CUENTA' })
const E = movil({ imeiSn: '350000000000005', modelo: '14', modeloMaestro: '14', ubicacion: 'Listos' })
const F = movil({ imeiSn: '350000000000006', modelo: null, modeloMaestro: null, capacidad: null })

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
    expect(totales([B])).toEqual({ total: 0, libres: 0, listos: 0, taller: 0, revision: 0, noCuentan: 1 })
  })

  it('lo que esta de pedido no cuenta como stock vendible, como el Excel', () => {
    expect(cuentaComoStock(B)).toBe(false)
    expect(cuentaComoStock(D)).toBe(false)
    expect(cuentaComoStock(A)).toBe(true)
    expect(agrupar([B], false)).toEqual([])
    expect(agrupar([B], true)[0].moviles).toEqual([B])
  })

  it('orden de tienda: catálogo del más nuevo al más antiguo, capacidad en GB, luego solo maestro y sin modelo', () => {
    const p = (modelo: string | null, capacidad: string | null, maestro: string | null = modelo) => movil({ modelo, modeloMaestro: maestro, capacidad })
    const lista = [
      p(null, null, null), p('xsmax', '64GB'), p(null, '128GB', '17e'), p('13promax', '1TB'), p('se2020', '64GB'),
      p('16', '128GB'), p('13promax', '256GB'), p('16e', '128GB'), p('13promax', 'raro'), p('13promax', null),
    ]
    expect(agrupar(lista, false).map((g) => g.clave)).toEqual([
      'iPhone 16e 128GB', 'iPhone 16 128GB', 'iPhone 13 Pro Max 256GB', 'iPhone 13 Pro Max 1TB', 'iPhone 13 Pro Max', 'iPhone 13 Pro Max raro',
      'iPhone XS Max 64GB', 'iPhone SE 2020 64GB', 'iPhone 17e 128GB', 'Sin modelo en el maestro',
    ])
  })
})

describe('stock de teléfonos: filtros', () => {
  it('valores de cada dimensión', () => {
    expect(valor('bateria', B)).toBe(BATERIA_NUEVA)
    expect(valor('estado', B)).toBe('De pedido')
    expect(valor('ubicacion', movil({ ubicacion: null }))).toBe('—')
  })

  it('las opciones cuentan con los demás filtros puestos y los grados van en su orden', () => {
    const f = { ...FILTROS_VACIOS, color: new Set(['Azul']) }
    expect(opciones([A, B, C], 'grado', f)).toEqual([{ valor: 'A', cuenta: 1 }, { valor: 'A-', cuenta: 1 }, { valor: 'n/a', cuenta: 0 }])
    expect(opciones([A, B, C], 'color', f)).toEqual([{ valor: 'Azul', cuenta: 2 }, { valor: 'Rosa', cuenta: 1 }])
  })

  it('pasa los filtros salvo la dimensión que se está contando', () => {
    const f = { ...FILTROS_VACIOS, color: new Set(['Rosa']), ubicacion: new Set(['Listos']) }
    expect(pasa(A, f)).toBe(false)
    expect(pasa(A, f, 'color')).toBe(true)
    expect(contarFiltros(f)).toBe(2)
  })

  it('la tabla ordena por color y antigüedad; los de pedido no van primero', () => {
    const V = movil({ imeiSn: '350000000000007', color: 'Verde', estado: 'DE_PEDIDO', dias: 900 })
    expect(ordenarTabla([V, C, A, B]).map((m) => m.imeiSn)).toEqual(['350000000000002', '350000000000001', '350000000000003', '350000000000007'])
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
