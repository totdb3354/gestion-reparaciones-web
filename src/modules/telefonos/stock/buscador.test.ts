import { describe, expect, it } from 'vitest'
import { visto } from '../test/fabrica'
import { aplicarSku, filtrarModelos, modeloExacto, resolverEnter, sugerenciasSku } from './buscador'
import { modelosLista } from './modelo'

/** Un iPhone 13 Pro en stock (por defecto). */
const pro = (p: Parameters<typeof visto>[0]) => visto({ modelo: '13pro', modeloMaestro: '13 PRO', ...p })
const MOVILES = [
  pro({ imeiSn: '350000000000001', sku: 'i13PRO128GrafitoA' }),
  pro({ imeiSn: '350000000000002', sku: 'i13PRO128GrafitoA' }),
  pro({ imeiSn: '350000000000003', sku: 'i13PRO128GrafitoA100' }),
  pro({ imeiSn: '350000000000004', sku: 'i13PRO256OroB', capacidad: '256GB' }),
  pro({ imeiSn: '350000000000005', sku: 'i13PRO128PlataA', estado: 'DE_PEDIDO' }),
  visto({ imeiSn: '350000000000006', sku: 'i14128AzulA', modelo: '14', modeloMaestro: '14' }),
  pro({ imeiSn: '350000000000007', sku: null }),
]
const LISTA = modelosLista(MOVILES, false)

describe('buscador de modelo o SKU (spec 0.9.18 §4.2)', () => {
  it('los SKU en stock que empiezan así: los más cortos primero, luego los que más hay; a partir de 2 caracteres', () => {
    expect(sugerenciasSku(MOVILES, 'i')).toEqual([])
    expect(sugerenciasSku(MOVILES, 'I13 pro')).toEqual([
      { sku: 'i13PRO256OroB', modelo: 'iPhone 13 Pro', capacidad: '256GB', cuenta: 1 },
      { sku: 'i13PRO128GrafitoA', modelo: 'iPhone 13 Pro', capacidad: '128GB', cuenta: 2 },
      { sku: 'i13PRO128GrafitoA100', modelo: 'iPhone 13 Pro', capacidad: '128GB', cuenta: 1 },
    ])
    expect(sugerenciasSku(MOVILES, 'i13PRO128Plata'), 'el de pedido no es stock').toEqual([])
  })

  it('la lista de modelos: los que lo llevan en el nombre y los que tienen esos SKU', () => {
    expect(filtrarModelos(LISTA, '13 pro', []).map((g) => g.clave)).toEqual(['iPhone 13 Pro'])
    expect(filtrarModelos(LISTA, 'i14', sugerenciasSku(MOVILES, 'i14')).map((g) => g.clave)).toEqual(['iPhone 14'])
    expect(filtrarModelos(LISTA, '', [])).toHaveLength(2)
  })

  it('el modelo exacto, con «iPhone» o sin él', () => {
    expect(modeloExacto(LISTA, '13 pro')?.clave).toBe('iPhone 13 Pro')
    expect(modeloExacto(LISTA, 'iphone 14')?.clave).toBe('iPhone 14')
    expect(modeloExacto(LISTA, '13')).toBeNull()
  })

  it('un SKU exacto abre su modelo y su capacidad con ese SKU', () => {
    expect(aplicarSku(MOVILES, 'i13PRO128GrafitoA', true)).toEqual({
      destino: { modelo: 'iPhone 13 Pro', capacidad: '128GB', sku: { texto: 'i13PRO128GrafitoA', exacto: true } },
    })
  })

  it('un principio de SKU: su modelo y, si es de una capacidad, también esa; si un SKU es igual a lo escrito, ese exacto', () => {
    expect(aplicarSku(MOVILES, 'i13pro', false)).toEqual({ destino: { modelo: 'iPhone 13 Pro', capacidad: null, sku: { texto: 'i13pro', exacto: false } } })
    expect(aplicarSku(MOVILES, 'i13PRO128', false)).toEqual({ destino: { modelo: 'iPhone 13 Pro', capacidad: '128GB', sku: { texto: 'i13PRO128', exacto: false } } })
    expect(aplicarSku(MOVILES, 'i13pro128grafitoa', false)).toEqual({
      destino: { modelo: 'iPhone 13 Pro', capacidad: '128GB', sku: { texto: 'i13PRO128GrafitoA', exacto: true } },
    })
  })

  it('SKU de varios modelos o ninguno: avisa', () => {
    expect(aplicarSku(MOVILES, 'i1', false)).toEqual({ aviso: 'Hay SKU de 2 modelos que empiezan así: elige uno o escribe más' })
    expect(aplicarSku(MOVILES, 'x9', false)).toEqual({ aviso: 'Ningún móvil en stock tiene un SKU que empiece así' })
  })

  it('Enter: el modelo exacto si ningún SKU empieza así; si no, el filtro por el principio del SKU', () => {
    expect(resolverEnter(LISTA, MOVILES, '14')).toEqual({ destino: { modelo: 'iPhone 14', capacidad: null, sku: null } })
    expect(resolverEnter(LISTA, MOVILES, 'i14')).toEqual({ destino: { modelo: 'iPhone 14', capacidad: '128GB', sku: { texto: 'i14', exacto: false } } })
  })
})
