import { describe, expect, it } from 'vitest'
import type { CompraComponente, CompraOtro } from '@/shared/api/client'
import { confirmacionDe } from './confirmaciones'

const compra: CompraComponente = {
  idCompra: 4, idCom: 14, tipoComponente: 'cam-x', idProv: 1, nombreProveedor: 'Proveedor A', cantidad: 5, cantidadRecibida: 2,
  esUrgente: false, fechaPedido: '2026-09-16T08:00:00', fechaLlegada: '2026-09-18T08:00:00', precioUnidadPedido: 12.5, divisa: 'EUR',
  precioEur: 12.5, estado: 'recibido', updatedAt: '2026-09-18T08:00:00',
}
const otro: CompraOtro = {
  idCompraOtro: 7, idProv: 1, nombreProveedor: 'Proveedor A', concepto: 'Cinta de embalar', cantidad: 3, cantidadRecibida: null,
  esUrgente: false, fechaPedido: '2026-09-20T08:30:00', fechaLlegada: null, precioUnidadPedido: 2, divisa: 'EUR', precioEur: 2,
  estado: 'recibido', updatedAt: '2026-09-20T08:30:00',
}

/** Textos de ConfirmDialog.mostrar en StockController :1576-1640 (componentes) y :1302-1457 (otros). */
describe('confirmacionDe', () => {
  it('Cancelar pedido: título y botón iguales (calco)', () => {
    expect(confirmacionDe('cancelar', compra)).toEqual({ titulo: 'Cancelar pedido', descripcion: '¿Cancelar el pedido #4 de cam-x?', textoAccion: 'Cancelar pedido' })
  })
  it('Borrar pedido', () => {
    expect(confirmacionDe('borrar', otro)).toEqual({ titulo: 'Borrar pedido', descripcion: '¿Borrar el pedido pendiente #7 de Cinta de embalar?', textoAccion: 'Borrar' })
  })
  it('Revertir a En camino de componentes: tres líneas con las unidades a descontar (recibida ?? cantidad)', () => {
    expect(confirmacionDe('revertir', compra)).toEqual({
      titulo: 'Revertir a En camino',
      descripcion: '¿Revertir el pedido #4 de cam-x a En camino?\nSe descontarán 2 unidad(es) del stock.\nRecuerda revisar el stock tras la operación.',
      textoAccion: 'Revertir a En camino',
    })
    expect(confirmacionDe('revertir', { ...compra, cantidadRecibida: null }).descripcion).toContain('Se descontarán 5 unidad(es) del stock.')
  })
  it('Revertir a En camino de otros: solo la primera frase (no hay stock)', () => {
    expect(confirmacionDe('revertir', otro)).toEqual({ titulo: 'Revertir a En camino', descripcion: '¿Revertir el pedido #7 de Cinta de embalar a En camino?', textoAccion: 'Revertir a En camino' })
  })
})
