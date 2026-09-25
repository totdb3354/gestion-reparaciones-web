import { describe, expect, it } from 'vitest'
import type { CompraComponente, CompraOtro } from '@/shared/api/client'
import {
  cantidadARevertir, chipDeEstado, entradasMenu, esCompra, estadoDeChip, ESTADOS_PEDIDO, idPedido, llevaAviso, marcaPrecioCero,
  marcaTotalCero, nombrePedido, restante, textoCantidad, totalFila, unidadesFila, validarParcial, validarResto,
} from './reglas'

const compra = (o: Partial<CompraComponente> = {}): CompraComponente => ({
  idCompra: 2, idCom: 12, tipoComponente: 'bat-x', idProv: 1, nombreProveedor: 'Proveedor A', cantidad: 10, cantidadRecibida: null,
  esUrgente: false, fechaPedido: '2026-09-20T08:30:00', fechaLlegada: null, precioUnidadPedido: 12.5, divisa: 'EUR', precioEur: 12.5,
  estado: 'pendiente', updatedAt: '2026-09-20T08:30:00', ...o,
})
const otro = (o: Partial<CompraOtro> = {}): CompraOtro => ({
  idCompraOtro: 7, idProv: 1, nombreProveedor: 'Proveedor A', concepto: 'Cinta de embalar', cantidad: 3, cantidadRecibida: null,
  esUrgente: false, fechaPedido: '2026-09-20T08:30:00', fechaLlegada: null, precioUnidadPedido: 2, divisa: 'EUR', precioEur: 2,
  estado: 'pendiente', updatedAt: '2026-09-20T08:30:00', ...o,
})

describe('estados y chips', () => {
  it('los cinco estados en el orden de los checks; el chip "en camino" lleva espacio y el estado guion bajo', () => {
    expect(ESTADOS_PEDIDO).toEqual(['pendiente', 'en_camino', 'parcial', 'recibido', 'cancelado'])
    expect(ESTADOS_PEDIDO.map(chipDeEstado)).toEqual(['pendiente', 'en camino', 'parcial', 'recibido', 'cancelado'])
    expect(estadoDeChip('en camino')).toBe('en_camino')
    expect(estadoDeChip('recibido')).toBe('recibido')
    expect(estadoDeChip('en_camino')).toBeNull()
    expect(estadoDeChip('otro')).toBeNull()
  })
  it('esCompra, idPedido y nombrePedido sirven para las dos tablas', () => {
    expect(esCompra(compra())).toBe(true)
    expect(esCompra(otro())).toBe(false)
    expect(idPedido(compra())).toBe(2)
    expect(idPedido(otro())).toBe(7)
    expect(nombrePedido(compra())).toBe('bat-x')
    expect(nombrePedido(otro())).toBe('Cinta de embalar')
  })
})

describe('columna Cant. (StockController :782-794)', () => {
  it('parcial: "recibida/cantidad", o solo la cantidad si la recibida es nula', () => {
    expect(textoCantidad(compra({ estado: 'parcial', cantidadRecibida: 3 }))).toBe('3/10')
    expect(textoCantidad(compra({ estado: 'parcial', cantidadRecibida: null }))).toBe('10')
  })
  it('recibido: la recibida si no es nula, si no la cantidad; resto de estados: la cantidad', () => {
    expect(textoCantidad(compra({ estado: 'recibido', cantidadRecibida: 8 }))).toBe('8')
    expect(textoCantidad(compra({ estado: 'recibido', cantidadRecibida: null }))).toBe('10')
    expect(textoCantidad(compra({ estado: 'en_camino', cantidadRecibida: 4 }))).toBe('10')
    expect(textoCantidad(otro({ estado: 'cancelado' }))).toBe('3')
  })
})

describe('columnas P.Unit., EUR y Estado (StockController :797-849, :885-919)', () => {
  it('unidades = recibida en recibido (si no es nula), si no la cantidad; total = unidades × precioEur', () => {
    expect(unidadesFila(compra({ estado: 'recibido', cantidadRecibida: 2 }))).toBe(2)
    expect(totalFila(compra({ estado: 'recibido', cantidadRecibida: 2 }))).toBe(25)
    expect(unidadesFila(compra({ estado: 'recibido', cantidadRecibida: null }))).toBe(10)
    expect(unidadesFila(compra({ estado: 'parcial', cantidadRecibida: 3 }))).toBe(10)
    expect(totalFila(otro({ precioEur: 1.5 }))).toBe(4.5)
  })
  it('"!" solo en recibido: precio 0 en P.Unit.; total 0 en EUR', () => {
    const gratis = compra({ estado: 'recibido', precioUnidadPedido: 0, precioEur: 0 })
    expect(marcaPrecioCero(gratis)).toBe(true)
    expect(marcaTotalCero(gratis)).toBe(true)
    const sinEuros = compra({ estado: 'recibido', precioUnidadPedido: 5, precioEur: 0 })
    expect(marcaPrecioCero(sinEuros)).toBe(false)
    expect(marcaTotalCero(sinEuros)).toBe(true)
    expect(marcaTotalCero(compra({ estado: 'recibido', cantidadRecibida: 0 }))).toBe(true)
    expect(marcaPrecioCero(compra({ estado: 'pendiente', precioUnidadPedido: 0 }))).toBe(false)
    expect(marcaTotalCero(compra({ estado: 'en_camino', precioEur: 0 }))).toBe(false)
  })
  it('"⚠" solo si urgente y en camino o parcial (un pendiente urgente no lo lleva)', () => {
    expect(llevaAviso(compra({ esUrgente: true, estado: 'en_camino' }))).toBe(true)
    expect(llevaAviso(compra({ esUrgente: true, estado: 'parcial' }))).toBe(true)
    expect(llevaAviso(compra({ esUrgente: true, estado: 'pendiente' }))).toBe(false)
    expect(llevaAviso(compra({ esUrgente: true, estado: 'recibido' }))).toBe(false)
    expect(llevaAviso(compra({ esUrgente: false, estado: 'en_camino' }))).toBe(false)
  })
})

describe('menú contextual por estado (spec §6, StockController :970-1010)', () => {
  it.each([
    ['pendiente', [{ accion: 'confirmar', texto: 'Confirmar pedido' }, 'separador', { accion: 'editar', texto: 'Editar' }, { accion: 'borrar', texto: 'Borrar' }]],
    ['en_camino', [{ accion: 'parcial', texto: 'Recepción parcial' }, { accion: 'recibido', texto: 'Confirmar recibido' }, 'separador', { accion: 'editar', texto: 'Editar' }, { accion: 'cancelar', texto: 'Cancelar pedido' }]],
    ['parcial', [{ accion: 'resto', texto: 'Recibir resto' }, { accion: 'cerrarSinResto', texto: 'Cerrar sin resto' }]],
    ['recibido', [{ accion: 'revertir', texto: 'Revertir a En camino' }, 'separador', { accion: 'editar', texto: 'Editar' }]],
    ['cancelado', []],
  ])('%s', (estado, entradas) => {
    expect(entradasMenu(estado)).toEqual(entradas)
  })
})

describe('diálogos de cantidad (StockController :1500-1560)', () => {
  it('validarParcial: entero con signo como Integer.parseInt; 0 < cant < cantidad', () => {
    expect(validarParcial('3', 10)).toEqual({ ok: true, valor: 3 })
    expect(validarParcial(' 9 ', 10)).toEqual({ ok: true, valor: 9 })
    expect(validarParcial('abc', 10)).toEqual({ ok: false, error: 'Cantidad no válida.' })
    expect(validarParcial('', 10)).toEqual({ ok: false, error: 'Cantidad no válida.' })
    expect(validarParcial('2.5', 10)).toEqual({ ok: false, error: 'Cantidad no válida.' })
    expect(validarParcial('0', 10)).toEqual({ ok: false, error: 'La cantidad debe ser mayor que 0 y menor que 10.' })
    expect(validarParcial('10', 10)).toEqual({ ok: false, error: 'La cantidad debe ser mayor que 0 y menor que 10.' })
    expect(validarParcial('-3', 10)).toEqual({ ok: false, error: 'La cantidad debe ser mayor que 0 y menor que 10.' })
    expect(validarParcial('1', 1)).toEqual({ ok: false, error: 'La cantidad debe ser mayor que 0 y menor que 1.' })
  })
  it('validarResto: > 0 y sin pasar de lo pedido; "Faltan" con el restante', () => {
    expect(validarResto('7', 3, 10)).toEqual({ ok: true, valor: 7 })
    expect(validarResto('2', null, 2)).toEqual({ ok: true, valor: 2 })
    expect(validarResto('x', 3, 10)).toEqual({ ok: false, error: 'Cantidad no válida.' })
    expect(validarResto('0', 3, 10)).toEqual({ ok: false, error: 'La cantidad debe ser mayor que 0.' })
    expect(validarResto('-1', 3, 10)).toEqual({ ok: false, error: 'La cantidad debe ser mayor que 0.' })
    expect(validarResto('8', 3, 10)).toEqual({ ok: false, error: 'No puedes recibir más de lo pedido. Faltan 7 unidad(es).' })
  })
  it('restante = cantidad − (recibida ?? 0); a revertir = recibida ?? cantidad', () => {
    expect(restante(compra({ estado: 'parcial', cantidadRecibida: 3 }))).toBe(7)
    expect(restante(compra({ cantidadRecibida: null }))).toBe(10)
    expect(cantidadARevertir(compra({ estado: 'recibido', cantidadRecibida: 2 }))).toBe(2)
    expect(cantidadARevertir(compra({ estado: 'recibido', cantidadRecibida: null }))).toBe(10)
  })
})
