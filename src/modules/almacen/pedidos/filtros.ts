import { fechaLocal } from '@/shared/lib/fechas'
import { estadoDeChip, nombrePedido, type EstadoPedido, type Pedido } from './reglas'

/** Los cuatro filtros de la barra, compartidos por los dos toggles (StockController :946-953 y :1219-1225, spec 4b P4).
 *  `proveedores` son nombres (MultiSelectComboBox de nombres); las fechas, 'yyyy-MM-dd' o '' como en RangoFechas. */
export type FiltrosPedidos = { estados: Set<EstadoPedido>; proveedores: Set<string>; buscador: string; desde: string; hasta: string }
export const FILTROS_PEDIDOS_VACIOS: FiltrosPedidos = { estados: new Set(), proveedores: new Set(), buscador: '', desde: '', hasta: '' }

/** Calco de :1016 y :1283: el servidor ordena por fecha desc y el cliente manda los cancelados al final con un sort estable. */
export function ordenarCanceladosAlFinal<T extends { estado: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => Number(a.estado === 'cancelado') - Number(b.estado === 'cancelado'))
}

/** `!fecha.isBefore(desde) && !fecha.isAfter(hasta)` sobre el día de Madrid (:954-957); una fecha nula pasa (calco). */
function pasaFechas(fechaPedido: string | null, desde: string, hasta: string): boolean {
  if (desde === '' && hasta === '') return true
  const dia = fechaLocal(fechaPedido)
  if (dia === null) return true
  if (desde !== '' && dia < desde) return false
  if (hasta !== '' && dia > hasta) return false
  return true
}

/** Predicado del FilteredList (:934-957): cada filtro vacío no filtra; entre ellos, Y. El buscador es "contiene" sin
 *  mayúsculas sobre el componente (o el concepto en Otros, :1211-1212). */
export function aplicarFiltrosPedidos<T extends Pedido>(lista: T[], f: FiltrosPedidos): T[] {
  const texto = f.buscador.trim().toLowerCase()
  return lista.filter(
    (p) =>
      (f.estados.size === 0 || f.estados.has(p.estado as EstadoPedido)) &&
      (f.proveedores.size === 0 || f.proveedores.has(p.nombreProveedor)) &&
      (texto === '' || nombrePedido(p).toLowerCase().includes(texto)) &&
      pasaFechas(p.fechaPedido, f.desde, f.hasta),
  )
}

/** Llegada desde "En Camino" de Stock actual (spec 4b §6, S8): `?estados=pendiente,en camino,parcial&buscar=<tipo>`
 *  (Stock los monta con `parametrosPedidos`, `stock/columnas.tsx:31`). Devuelve solo lo que venga; null si no viene
 *  ninguno de los dos. Los chips que no son de un estado se ignoran. */
export function filtrosDesdeStock(search: URLSearchParams): Partial<Pick<FiltrosPedidos, 'estados' | 'buscador'>> | null {
  const estados = search.get('estados')
  const buscar = search.get('buscar')
  if (estados === null && buscar === null) return null
  const filtros: Partial<Pick<FiltrosPedidos, 'estados' | 'buscador'>> = {}
  if (estados !== null) {
    filtros.estados = new Set(estados.split(',').map((c) => estadoDeChip(c.trim())).filter((e): e is EstadoPedido => e !== null))
  }
  if (buscar !== null) filtros.buscador = buscar
  return filtros
}
