/** Importes y cantidades con el formato del JavaFX (inventario de Pedidos §15): `String.format("%.2f")` con el Locale de un
 *  Windows en español, es decir, coma decimal y sin separador de miles. Un formateador por número de decimales. */
const formatos = new Map<number, Intl.NumberFormat>()

function formato(decimales: number): Intl.NumberFormat {
  let f = formatos.get(decimales)
  if (!f) {
    f = new Intl.NumberFormat('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales, useGrouping: false })
    formatos.set(decimales, f)
  }
  return f
}

/** '12,50' (2 decimales por defecto; la tasa del editor usa 4). */
export function formatearNumero(n: number, decimales = 2): string {
  return formato(decimales).format(n)
}

/** '12,50 €': calco de `"%.2f %s"`. */
export function formatearImporte(n: number, simbolo: string): string {
  return `${formatearNumero(n)} ${simbolo}`
}

/** Símbolo de la columna P.Unit. de las tablas de Pedidos (StockController :810-814): EUR → €, USD → $, otra → el código. */
export function simboloDivisa(divisa: string): string {
  if (divisa === 'EUR') return '€'
  if (divisa === 'USD') return '$'
  return divisa
}

/** Símbolo de la celda P.Unit. de los formularios de alta (inventario §10): USD → $, cualquier otra → €. */
export function simboloFormulario(divisa: string): string {
  return divisa === 'USD' ? '$' : '€'
}

const DECIMAL = /^[+-]?(\d+(\.\d*)?|\.\d+)$/
const ENTERO = /^\d+$/

/** Calco de `Double.parseDouble(texto.trim().replace(",", "."))`: coma o punto; null si no es un número finito. */
export function parsearDecimal(texto: string): number | null {
  const t = texto.trim().replace(/,/g, '.')
  if (!DECIMAL.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Entero sin signo: solo dígitos tras recortar (las cantidades de los formularios de pedido). */
export function parsearEntero(texto: string): number | null {
  const t = texto.trim()
  return ENTERO.test(t) ? Number(t) : null
}
