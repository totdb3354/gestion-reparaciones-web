import { describe, expect, it } from 'vitest'
import type { CompraComponente, CompraOtro } from '@/shared/api/client'
import { aplicarFiltrosPedidos, FILTROS_PEDIDOS_VACIOS, filtrosDesdeStock, firmaFiltros, hayFiltros, juntarLineas, ordenarCanceladosAlFinal, type FiltrosPedidos } from './filtros'
import { BLOQUE_PRUEBA } from './formulario/datosPrueba'
import { claveLinea, esCompra, type Pedido } from './reglas'

const compra = (o: Partial<CompraComponente>): CompraComponente => ({
  ...BLOQUE_PRUEBA,
  idCompra: 1, idCom: 11, tipoComponente: 'lcd-x-negro', idProv: 1, nombreProveedor: 'Proveedor A', cantidad: 2, cantidadRecibida: null,
  esUrgente: false, fechaPedido: '2026-09-20T08:30:00', fechaLlegada: null, precioUnidadPedido: 12.5, divisa: 'EUR', precioEur: 12.5,
  estado: 'pendiente', updatedAt: '2026-09-20T08:30:00', ...o,
})
const otro = (o: Partial<CompraOtro>): CompraOtro => ({
  ...BLOQUE_PRUEBA,
  idCompraOtro: 7, idProv: 1, nombreProveedor: 'Proveedor A', concepto: 'Cinta de embalar', cantidad: 3, cantidadRecibida: null,
  esUrgente: false, fechaPedido: '2026-09-20T08:30:00', fechaLlegada: null, precioUnidadPedido: 2, divisa: 'EUR', precioEur: 2,
  estado: 'pendiente', updatedAt: '2026-09-20T08:30:00', ...o,
})

const lista = [
  compra({ idCompra: 1, tipoComponente: 'lcd-x-negro', estado: 'pendiente', nombreProveedor: 'Proveedor A', fechaPedido: '2026-09-20T08:30:00' }),
  // 22:30 UTC del 19 = 00:30 del 20 en Madrid (CEST): cuenta como día 20.
  compra({ idCompra: 2, tipoComponente: 'bat-x', estado: 'en_camino', nombreProveedor: 'Proveedor B', fechaPedido: '2026-09-19T22:30:00' }),
  compra({ idCompra: 3, tipoComponente: 'bat-y', estado: 'parcial', nombreProveedor: 'Proveedor A', fechaPedido: '2026-09-18T10:00:00' }),
  compra({ idCompra: 4, tipoComponente: 'cam-x', estado: 'cancelado', nombreProveedor: 'ACME', fechaPedido: '2026-09-17T10:00:00' }),
]
const ids = (l: CompraComponente[]) => l.map((p) => p.idCompra)
const f = (o: Partial<FiltrosPedidos>): FiltrosPedidos => ({ ...FILTROS_PEDIDOS_VACIOS, ...o })

describe('aplicarFiltrosPedidos (StockController :934-957, AND de los cuatro)', () => {
  it('sin filtros muestra todos', () => {
    expect(ids(aplicarFiltrosPedidos(lista, FILTROS_PEDIDOS_VACIOS))).toEqual([1, 2, 3, 4])
  })
  it('Estado: varios chips se combinan con O sobre el estado del servidor', () => {
    expect(ids(aplicarFiltrosPedidos(lista, f({ estados: new Set(['en_camino', 'parcial'] as const) })))).toEqual([2, 3])
  })
  it('Proveedor: por nombre', () => {
    expect(ids(aplicarFiltrosPedidos(lista, f({ proveedores: new Set(['Proveedor A']) })))).toEqual([1, 3])
  })
  it('buscador: "contiene", sin mayúsculas y recortado, sobre el componente o el concepto', () => {
    expect(ids(aplicarFiltrosPedidos(lista, f({ buscador: '  BAT ' })))).toEqual([2, 3])
    const otros = [otro({ idCompraOtro: 7, concepto: 'Cinta de embalar' }), otro({ idCompraOtro: 8, concepto: 'Bolsas' })]
    expect(aplicarFiltrosPedidos(otros, f({ buscador: 'cinta' })).map((p) => p.idCompraOtro)).toEqual([7])
  })
  it('Desde/Hasta: día de Madrid de la fecha de pedido, inclusivos', () => {
    expect(ids(aplicarFiltrosPedidos(lista, f({ desde: '2026-09-20', hasta: '2026-09-20' })))).toEqual([1, 2])
    expect(ids(aplicarFiltrosPedidos(lista, f({ desde: '2026-09-18' })))).toEqual([1, 2, 3])
    expect(ids(aplicarFiltrosPedidos(lista, f({ hasta: '2026-09-18' })))).toEqual([3, 4])
  })
  it('los cuatro filtros se combinan con Y', () => {
    const todos = f({ estados: new Set(['pendiente', 'parcial'] as const), proveedores: new Set(['Proveedor A']), buscador: 'bat', desde: '2026-09-18' })
    expect(ids(aplicarFiltrosPedidos(lista, todos))).toEqual([3])
  })
})

describe('ordenarCanceladosAlFinal (StockController :1016)', () => {
  it('lleva los cancelados al final sin reordenar dentro de cada grupo (orden del servidor)', () => {
    const l = [compra({ idCompra: 1, estado: 'cancelado' }), compra({ idCompra: 2, estado: 'pendiente' }), compra({ idCompra: 3, estado: 'cancelado' }), compra({ idCompra: 4, estado: 'recibido' })]
    expect(ids(ordenarCanceladosAlFinal(l))).toEqual([2, 4, 1, 3])
    expect(ids(l)).toEqual([1, 2, 3, 4])
  })
})

describe('filtrosDesdeStock (llegada desde "En Camino", S8)', () => {
  it('lee ?estados y ?buscar con el formato de parametrosPedidos (codificado o no)', () => {
    const esperado = { estados: new Set(['pendiente', 'en_camino', 'parcial']), buscador: 'bat-x' }
    expect(filtrosDesdeStock(new URLSearchParams('estados=pendiente%2Cen+camino%2Cparcial&buscar=bat-x'))).toEqual(esperado)
    expect(filtrosDesdeStock(new URLSearchParams('estados=pendiente,en camino,parcial&buscar=bat-x'))).toEqual(esperado)
  })
  it('sin parámetros devuelve null; un chip desconocido se ignora; solo lo que venga', () => {
    expect(filtrosDesdeStock(new URLSearchParams(''))).toBeNull()
    expect(filtrosDesdeStock(new URLSearchParams('componente=12'))).toBeNull()
    expect(filtrosDesdeStock(new URLSearchParams('estados=parcial,otro'))).toEqual({ estados: new Set(['parcial']) })
    expect(filtrosDesdeStock(new URLSearchParams('buscar=lcd'))).toEqual({ buscador: 'lcd' })
  })
})

describe('hayFiltros y firmaFiltros (0.9.9)', () => {
  it('cualquier filtro cuenta y la firma no depende del orden ni de mayúsculas o espacios del buscador', () => {
    expect(hayFiltros(FILTROS_PEDIDOS_VACIOS)).toBe(false)
    expect(hayFiltros({ ...FILTROS_PEDIDOS_VACIOS, buscador: '  ' })).toBe(false)
    expect(hayFiltros({ ...FILTROS_PEDIDOS_VACIOS, desde: '2026-10-01' })).toBe(true)
    const a = firmaFiltros({ ...FILTROS_PEDIDOS_VACIOS, estados: new Set(['pendiente', 'en_camino']), buscador: 'LCD ' })
    const b = firmaFiltros({ ...FILTROS_PEDIDOS_VACIOS, estados: new Set(['en_camino', 'pendiente']), buscador: 'lcd' })
    expect(a).toBe(b)
  })
})

describe('buscador con número de bloque (spec 2026-10-11 §5.4)', () => {
  const lista = [
    compra({ idCompra: 1, tipoComponente: 'bati13', idBloque: 13 }),
    compra({ idCompra: 2, tipoComponente: 'bati14', idBloque: 41 }),
    compra({ idCompra: 3, tipoComponente: 'lcd-x', idBloque: 4 }),
    compra({ idCompra: 4, tipoComponente: 'cami13pro', idBloque: null }),
  ]

  it('solo cifras: las líneas del bloque con ese número exacto', () => {
    expect(ids(aplicarFiltrosPedidos(lista, f({ buscador: ' 41 ' })))).toEqual([2])
    expect(ids(aplicarFiltrosPedidos(lista, f({ buscador: '4' })))).toEqual([3])
    expect(ids(aplicarFiltrosPedidos(lista, f({ buscador: '13' })))).toEqual([1])
  })

  it('con letras busca la pieza como siempre', () => {
    expect(ids(aplicarFiltrosPedidos(lista, f({ buscador: 'bati1' })))).toEqual([1, 2])
  })

  it('un otro (0.9.15, con bloque) también se busca por el número de su bloque, no por las cifras del concepto', () => {
    const otros = [otro({ idCompraOtro: 9, concepto: 'Cable 41 cm', idBloque: 7 }), otro({ idCompraOtro: 10, concepto: 'Bolsas', idBloque: 41 })]
    expect(aplicarFiltrosPedidos(otros, f({ buscador: '41' })).map((p) => p.idCompraOtro)).toEqual([10])
  })
})

describe('juntarLineas (0.9.15)', () => {
  it('piezas y otros en una lista por fecha de pedido descendente; a igual fecha, las piezas primero; los cancelados al final', () => {
    const lista = juntarLineas(
      [compra({ idCompra: 1, fechaPedido: '2026-09-20T08:30:00' }), compra({ idCompra: 2, fechaPedido: '2026-09-18T10:00:00', estado: 'cancelado' })],
      [otro({ idCompraOtro: 7, fechaPedido: '2026-09-20T08:30:00' }), otro({ idCompraOtro: 8, fechaPedido: '2026-09-19T10:00:00' })],
    )
    expect(lista.map((p) => (esCompra(p) ? `p-${p.idCompra}` : `o-${p.idCompraOtro}`))).toEqual(['p-1', 'o-7', 'o-8', 'p-2'])
  })
})

describe('buscador con piezas y otros (0.9.15)', () => {
  const mezcla: Pedido[] = [
    compra({ idCompra: 1, tipoComponente: 'cinta-x' }),
    otro({ idCompraOtro: 7, concepto: 'Cinta de embalar' }),
    otro({ idCompraOtro: 8, concepto: 'Bolsas' }),
  ]
  it('sin filtros, la lista mezclada entera; el buscador encuentra un otro por su concepto', () => {
    expect(aplicarFiltrosPedidos(mezcla, f({})).map(claveLinea)).toEqual(['p-1', 'o-7', 'o-8'])
    expect(aplicarFiltrosPedidos(mezcla, f({ buscador: 'bol' })).map(claveLinea)).toEqual(['o-8'])
  })
  it('el buscador encuentra el componente o el concepto en la misma lista', () => {
    expect(aplicarFiltrosPedidos(mezcla, f({ buscador: 'CINTA' })).map(claveLinea)).toEqual(['p-1', 'o-7'])
  })
})
