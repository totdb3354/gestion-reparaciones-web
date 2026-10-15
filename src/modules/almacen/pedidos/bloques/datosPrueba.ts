import type { CompraComponente, CompraOtro } from '@/shared/api/client'

/** Datos SINTÉTICOS de los tests de bloques (0.9.9). Por defecto: línea 1, pendiente, del Proveedor A, en el bloque 41. */
export function lineaDePrueba(o: Partial<CompraComponente> = {}): CompraComponente {
  return {
    idCompra: 1, idCom: 11, tipoComponente: 'lcd-x-negro', idProv: 1, nombreProveedor: 'Proveedor A', cantidad: 2, cantidadRecibida: null,
    esUrgente: false, fechaPedido: '2026-10-09T10:00:00', fechaLlegada: null, precioUnidadPedido: 10, divisa: 'EUR', precioEur: 10,
    estado: 'pendiente', updatedAt: '2026-10-09T10:00:00',
    idBloque: 41, fechaBloque: '2026-10-09T10:00:00', notaBloque: null, bloqueUpdatedAt: '2026-10-09T10:00:00', bloqueAntiguo: false,
    ...o,
  }
}

/** Un otro pedido SINTÉTICO (0.9.15) en el mismo bloque 41 y a la misma hora que `lineaDePrueba`: otro 1, «Cinta de
 *  embalar», 2 unidades a 1 €, pendiente. */
export function otroDePrueba(o: Partial<CompraOtro> = {}): CompraOtro {
  return {
    idCompraOtro: 1, idProv: 1, nombreProveedor: 'Proveedor A', concepto: 'Cinta de embalar', cantidad: 2, cantidadRecibida: null,
    esUrgente: false, fechaPedido: '2026-10-09T10:00:00', fechaLlegada: null, precioUnidadPedido: 1, divisa: 'EUR', precioEur: 1,
    estado: 'pendiente', updatedAt: '2026-10-09T10:00:00',
    idBloque: 41, fechaBloque: '2026-10-09T10:00:00', notaBloque: null, bloqueUpdatedAt: '2026-10-09T10:00:00', bloqueAntiguo: false,
    ...o,
  }
}
