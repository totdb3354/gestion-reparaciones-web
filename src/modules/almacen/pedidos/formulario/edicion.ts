import { formatearImporte, parsearDecimal, parsearEntero } from '@/shared/lib/importes'
import type { OpcionCombo } from '@/shared/ui/ComboNavy'
import type { EstadoTasa } from '../tasa'
import { etiquetaTasa, totalLinea } from './conversion'

/** Solo EUR y USD, como el combo del editor (FCE :63), independiente de la divisa del proveedor (calco). */
export const DIVISAS_EDICION: OpcionCombo[] = [{ valor: 'EUR', etiqueta: 'EUR' }, { valor: 'USD', etiqueta: 'USD' }]
export const MSG_PEDIDO_MODIFICADO = 'El pedido fue modificado por otro usuario. Cierra y recarga los datos.'
export const MSG_CONCEPTO_VACIO = 'El concepto no puede estar vacío.'
export const MSG_SIN_PROVEEDOR = 'Selecciona un proveedor.'
export const MSG_CANTIDAD_NO_VALIDA = 'Cantidad no válida (debe ser > 0).'
export const MSG_PRECIO_NO_VALIDO = 'Precio no válido.'

/** `form-label` del GridPane (12 px negrita #586376) y el campo `buscador` (como los diálogos de Stock). */
export const CLASE_ETIQUETA = 'text-[12px] font-bold text-azul-gris'
export const CLASE_CAMPO = 'bg-superficie text-[13px] text-azul-medio'

export type CamposEdicion = { concepto?: string; idProv: number | null; cantidad: string; precio: string }
export type EdicionValida = { concepto: string | null; idProv: number; cantidad: number; precioUnidad: number }

/** Validación de "Guardar" de los dos editores, parando en el primer fallo. `concepto` solo viene en otros. */
export function validarEdicion(c: CamposEdicion): { ok: true; valor: EdicionValida } | { ok: false; error: string } {
  if (c.concepto !== undefined && c.concepto.trim() === '') return { ok: false, error: MSG_CONCEPTO_VACIO }
  if (c.idProv === null) return { ok: false, error: MSG_SIN_PROVEEDOR }
  const cantidad = parsearEntero(c.cantidad)
  if (cantidad === null || cantidad <= 0) return { ok: false, error: MSG_CANTIDAD_NO_VALIDA }
  const precio = parsearDecimal(c.precio)
  if (precio === null || precio < 0) return { ok: false, error: MSG_PRECIO_NO_VALIDO }
  return { ok: true, valor: { concepto: c.concepto === undefined ? null : c.concepto.trim(), idProv: c.idProv, cantidad, precioUnidad: precio } }
}

/** "Total EUR:" del editor (calcularTotal, FCE :99-111, con P7): tasa dividida, etiqueta "(1 {DIV} = {1/tasa} €)" y "—"
 *  si precio o cantidad no parsean (también con divisa distinta de EUR). */
export function textoTotalEdicion(precio: string, cantidad: string, divisa: string, tasa: EstadoTasa): string {
  if (tasa.cargando) return 'Obteniendo tasa…'
  if (tasa.error) return 'Error al obtener tasa'
  const total = totalLinea(parsearDecimal(precio), tasa.tasa, parsearEntero(cantidad))
  if (total === null || tasa.tasa === null) return '—'
  return formatearImporte(total, '€') + etiquetaTasa(divisa, tasa.tasa)
}
