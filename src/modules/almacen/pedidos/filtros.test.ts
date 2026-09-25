import { describe, expect, it } from 'vitest'
import type { CompraComponente, CompraOtro } from '@/shared/api/client'
import { aplicarFiltrosPedidos, FILTROS_PEDIDOS_VACIOS, filtrosDesdeStock, ordenarCanceladosAlFinal, type FiltrosPedidos } from './filtros'

const compra = (o: Partial<CompraComponente>): CompraComponente => ({
  idCompra: 1, idCom: 11, tipoComponente: 'lcd-x-negro', idProv: 1, nombreProveedor: 'Proveedor A', cantidad: 2, cantidadRecibida: null,
  esUrgente: false, fechaPedido: '2026-09-20T08:30:00', fechaLlegada: null, precioUnidadPedido: 12.5, divisa: 'EUR', precioEur: 12.5,
  estado: 'pendiente', updatedAt: '2026-09-20T08:30:00', ...o,
})
const otro = (o: Partial<CompraOtro>): CompraOtro => ({
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
