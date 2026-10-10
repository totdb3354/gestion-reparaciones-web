import type { CompraComponente } from '@/shared/api/client'

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
