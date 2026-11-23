import { describe, expect, it } from 'vitest'
import { fila } from '../test/fabrica'
import { CABECERAS_PEDIDOS, filaPedidoCsv } from './csv'

const HOY = '2026-11-23'

describe('CSV de Pedidos', () => {
  it('lleva las columnas de la tabla y la marca aparte', () => {
    expect(CABECERAS_PEDIDOS).toEqual(['Fecha', 'Plataforma', 'SKU', 'IMEI', 'Pedido', 'Enviado', 'Fecha compra', 'Marca', 'Nota marca'])
  })

  it('una pendiente: fechas como en la tabla, IMEI como texto para Excel y sin marca', () => {
    const f = fila({ fecha: '2026-11-20', plataforma: 'Web', sku: 'i13128AzulA', imei: '350000000000001', pedido: 'P-1', fechaCompra: '2026-11-19' })
    expect(filaPedidoCsv(f, HOY)).toEqual(['20/11/2026', 'Web', 'i13128AzulA', '="350000000000001"', 'P-1', 'Pendiente', '19/11/2026', '', ''])
  })

  it('una enviada lleva la fecha de impresión, el transportista y el seguimiento, como en la tabla', () => {
    const f = fila({ estado: 'ENVIADA', impresaEn: '2026-11-21T09:00:00', tieneEtiqueta: true, transportista: 'SEURv2', seguimiento: 'ABC123' })
    expect(filaPedidoCsv(f, HOY)[5]).toBe('Enviado 21/11 · SEUR · ABC123')
  })

  it('en Amazon sin asociar el pedido sale como «sin asociar» y sin IMEI la celda va vacía', () => {
    const f = fila({ canal: 'AMAZON', plataforma: 'Amazon', pedido: '402-0000000-0000021', asociadaEn: null, imei: null })
    const csv = filaPedidoCsv(f, HOY)
    expect(csv[3]).toBe('')
    expect(csv[4]).toBe('sin asociar')
  })

  it('la marca y su nota van en sus columnas; «Cancelado» sale en Enviado y no se repite como marca', () => {
    const enEspera = fila({ marca: 'ESPERA_STOCK', marcaNota: 'llega el jueves' })
    expect(filaPedidoCsv(enEspera, HOY).slice(5)).toEqual(['Pendiente', '08/11/2026', 'En espera de stock', 'llega el jueves'])
    const cancelada = fila({ marca: 'CANCELADO', marcaNota: 'lo anuló el cliente' })
    expect(filaPedidoCsv(cancelada, HOY).slice(5)).toEqual(['Cancelado', '08/11/2026', '', ''])
  })
})
