import type { FilaVista } from '@/shared/api/client'
import { textoForzado } from '@/shared/lib/csv'
import { diaNsys } from '@/shared/lib/telefonoNsys'
import { detalleEnvio, estadoPantalla, pedidoVisible, textoEstado, textoMarca } from './filas'

/** «Descargar CSV» del menú de usuario en Pedidos: las filas que se ven (periodo o búsqueda, filtros de columna y orden), con las
 *  columnas de la tabla y la marca aparte. Los textos son los de la pantalla. */
export const NOMBRE_CSV_PEDIDOS = 'pedidos_telefonos'

export const CABECERAS_PEDIDOS = ['Fecha', 'Plataforma', 'SKU', 'IMEI', 'Pedido', 'Enviado', 'Fecha compra', 'Marca', 'Nota marca']

const dia = (iso: string | null) => (iso ? diaNsys(iso) : '')

export function filaPedidoCsv(f: FilaVista, hoy: string): string[] {
  const estado = estadoPantalla(f)
  // Como en la tabla: tras «Etiqueta generada» o «Enviado» van el transportista y el seguimiento.
  const detalle = estado === 'GENERADA' || estado === 'ENVIADO' ? detalleEnvio(f) : undefined
  // «Cancelado» ya sale en «Enviado» y su marca no se repite.
  const conMarca = !!f.marca && estado !== 'CANCELADO'
  return [
    dia(f.fecha),
    f.plataforma ?? '',
    f.sku ?? '',
    textoForzado(f.imei),
    pedidoVisible(f) ?? 'sin asociar',
    detalle ? `${textoEstado(f, estado, hoy)} · ${detalle}` : textoEstado(f, estado, hoy),
    dia(f.fechaCompra),
    conMarca ? textoMarca(f.marca!) : '',
    conMarca ? (f.marcaNota ?? '') : '',
  ]
}
