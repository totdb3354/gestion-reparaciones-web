import { describe, expect, it } from 'vitest'
import type { Componente } from '@/shared/api/client'
import { lineaDePrueba } from '../bloques/datosPrueba'
import { agruparEnBloques } from '../bloques/reglas'
import { COMPONENTES, PROVEEDORES } from './datosPrueba'
import { lineaCompraVacia, lineaOtroVacia, type LineaCompra } from './lineas'
import {
  avisoYaEstaba, lineasDe, opcionesOtroProveedor, opcionesPasarA, pasarA, POR_REPARTIR, recuadrosDelPedido, repartirLineas, tambienVa,
  textoConfirmar, textoQuitarRecuadro, validarPedido,
} from './recuadros'

const L = (id: number, idCom: number | null, idProv: number | null, cantidad = '1'): LineaCompra => ({ ...lineaCompraVacia(id, idCom), idProv, cantidad })
// lcd-x-negro (1) la venden ACME (1) y Proveedor B (2); bat-x (2) y su slave bat-y (5), ACME y Proveedor A (3), que está
// desactivado; mc-x (4) no trae lista.
const ACTIVOS: Componente[] = COMPONENTES.map((c) => (c.idCom === 1 ? { ...c, proveedores: [1, 2] } : c.idCom === 2 || c.idCom === 5 ? { ...c, proveedores: [1, 3] } : c))
const ACTIVOS_IDS = new Set([1, 2])
const PROVEEDORES_ACTIVOS = PROVEEDORES.filter((p) => p.activo)
const nombre = (id: number) => PROVEEDORES.find((p) => p.idProv === id)?.nombre ?? `Proveedor ${id}`

describe('reparto automático (spec 2026-10-13 §3)', () => {
  it('al único proveedor activo que la vende; varios, ninguno, sin dato o sin pieza → «Por repartir»', () => {
    const r = repartirLineas([L(1, 2, null), L(2, 1, null), L(3, null, null), L(4, 4, null)], ACTIVOS, ACTIVOS_IDS)
    expect(r.map((l) => l.idProv)).toEqual([1, null, null, null])
  })
})

describe('recuadros', () => {
  it('en el orden en que se añadieron: primero los añadidos y después los que solo tienen líneas, sin repetir', () => {
    expect(recuadrosDelPedido([L(1, 1, 2), L(2, 2, 1), L(3, 2, null)], [2, 3])).toEqual([2, 3, 1])
  })
  it('lineasDe: las de un proveedor o las de «Por repartir», en su orden', () => {
    const ls = [L(1, 1, 2), L(2, 2, null), L(3, 2, 2)]
    expect(lineasDe(ls, 2).map((l) => l.id)).toEqual([1, 3])
    expect(lineasDe(ls, POR_REPARTIR).map((l) => l.id)).toEqual([2])
  })
})

describe('Pasar a… (§3)', () => {
  it('la línea va al final del recuadro del proveedor', () => {
    expect(pasarA([L(1, 1, null), L(2, 2, 1)], 1, 1)).toEqual({ lineas: [L(2, 2, 1), L(1, 1, 1)], repetida: false })
  })
  it('si ese recuadro ya tenía la pieza, se queda la que había', () => {
    expect(pasarA([L(1, 2, null, '5'), L(2, 2, 1, '3')], 1, 1)).toEqual({ lineas: [L(2, 2, 1, '3')], repetida: true })
    expect(avisoYaEstaba('bat-x / bat-y', 'ACME')).toBe('bat-x / bat-y ya estaba en ACME: se queda la línea que había.')
  })
  it('opciones: primero «Lo vende» y luego «Otros proveedores»', () => {
    expect(opcionesPasarA(2, ACTIVOS, PROVEEDORES_ACTIVOS)).toEqual([
      { valor: '1', etiqueta: 'ACME', grupo: 'Lo vende' },
      { valor: '2', etiqueta: 'Proveedor B', grupo: 'Otros proveedores' },
    ])
    expect(opcionesPasarA(null, ACTIVOS, PROVEEDORES_ACTIVOS).map((o) => o.grupo)).toEqual(['Otros proveedores', 'Otros proveedores'])
  })
})

describe('otro proveedor', () => {
  it('los que no tienen recuadro, con su bloque abierto o «sin bloque abierto»', () => {
    const bloques = agruparEnBloques([lineaDePrueba({ idCompra: 9, idProv: 1, nombreProveedor: 'ACME', idBloque: 41 })])
    expect(opcionesOtroProveedor(PROVEEDORES_ACTIVOS, [], bloques)).toEqual([
      { valor: '1', etiqueta: 'ACME · Bloque 41 abierto' },
      { valor: '2', etiqueta: 'Proveedor B · sin bloque abierto' },
    ])
    expect(opcionesOtroProveedor(PROVEEDORES_ACTIVOS, [1], bloques).map((o) => o.valor)).toEqual(['2'])
  })
})

describe('también va a (§5)', () => {
  it('las piezas del recuadro que van también a otros proveedores, con su cantidad allí; «Por repartir» no cuenta', () => {
    const ls = [L(1, 1, 1, '3'), L(2, 1, 2, '4'), L(3, 2, 1), L(4, 1, null, '9')]
    expect(tambienVa(ls, 1, () => 'lcd-x-negro', nombre)).toEqual(['lcd-x-negro también va a Proveedor B (4).'])
    expect(tambienVa(ls, 2, () => 'lcd-x-negro', nombre)).toEqual(['lcd-x-negro también va a ACME (3).'])
  })
})

describe('Confirmar (§6)', () => {
  it('primero lo que queda por repartir', () => {
    expect(validarPedido([L(1, 1, null)], [], nombre)).toEqual({ error: 'Queda 1 línea por repartir: elige a quién se la pides.', recuadro: POR_REPARTIR })
    expect(validarPedido([L(1, 1, null), L(2, 2, null)], [], nombre)?.error).toBe('Quedan 2 líneas por repartir: elige a quién se las pides.')
  })
  it('sin líneas: «Añade al menos una línea.»; los recuadros vacíos no cuentan', () => {
    expect(validarPedido([], [1], nombre)).toEqual({ error: 'Añade al menos una línea.', recuadro: null })
    expect(validarPedido([L(1, 1, 2)], [1, 2], nombre)).toBeNull()
  })
  it('las líneas de cada recuadro en el orden en que se ven, con el proveedor delante', () => {
    expect(validarPedido([L(1, null, 2), L(2, 1, 1, '0')], [1, 2], nombre)).toEqual({ error: 'ACME · Línea 1: la cantidad debe ser mayor que 0.', recuadro: 1 })
  })
  it('textos del botón y de quitar un recuadro', () => {
    expect(textoConfirmar(0)).toBe('Confirmar pedido')
    expect(textoConfirmar(1)).toBe('Confirmar pedido')
    expect(textoConfirmar(3)).toBe('Confirmar pedido (3 bloques)')
    expect(textoQuitarRecuadro('ACME', 1)).toBe('¿Quitar ACME y su línea?')
    expect(textoQuitarRecuadro('ACME', 4)).toBe('¿Quitar ACME y sus 4 líneas?')
  })
})

describe('líneas de otro (0.9.15)', () => {
  const O = (id: number, idProv: number, concepto = 'Bolsas'): LineaCompra => ({ ...lineaOtroVacia(id, idProv), concepto })
  it('un recuadro con solo otros es un recuadro con líneas; un concepto vacío falla con su proveedor y su número en el recuadro', () => {
    expect(validarPedido([O(1, 2)], [2], nombre)).toBeNull()
    expect(validarPedido([L(1, 1, 1), O(2, 1, '  ')], [1], nombre)).toEqual({ error: 'ACME · Línea 2: escribe el concepto.', recuadro: 1 })
  })
  it('un otro no sale en «también va a» aunque su concepto se llame como una pieza', () => {
    expect(tambienVa([L(1, 1, 1, '3'), O(2, 2, 'lcd-x-negro')], 1, () => 'lcd-x-negro', nombre)).toEqual([])
  })
})
