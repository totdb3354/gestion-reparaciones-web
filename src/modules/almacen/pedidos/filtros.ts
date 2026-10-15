import type { CompraComponente, CompraOtro } from '@/shared/api/client'
import { fechaLocal } from '@/shared/lib/fechas'
import { esCompra, estadoDeChip, nombrePedido, type EstadoPedido, type Pedido } from './reglas'

/** Filtro «Tipo» (0.9.15, spec «Añadir otro» §5.1): todas las líneas, solo las piezas o solo los otros. */
export type TipoFiltro = 'todos' | 'piezas' | 'otros'
export const TIPOS_FILTRO: TipoFiltro[] = ['todos', 'piezas', 'otros']

/** Los filtros de la barra (StockController :946-953 y :1219-1225, spec 4b P4; «Tipo» desde la 0.9.15). `proveedores` son
 *  nombres (MultiSelectComboBox de nombres); las fechas, 'yyyy-MM-dd' o '' como en RangoFechas. */
export type FiltrosPedidos = { estados: Set<EstadoPedido>; proveedores: Set<string>; buscador: string; desde: string; hasta: string; tipo: TipoFiltro }
export const FILTROS_PEDIDOS_VACIOS: FiltrosPedidos = { estados: new Set(), proveedores: new Set(), buscador: '', desde: '', hasta: '', tipo: 'todos' }

/** Calco de :1016 y :1283: el servidor ordena por fecha desc y el cliente manda los cancelados al final con un sort estable. */
export function ordenarCanceladosAlFinal<T extends { estado: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => Number(a.estado === 'cancelado') - Number(b.estado === 'cancelado'))
}

/** 0.9.15 (spec «Añadir otro» §5.1): las dos listas de Pedidos en una. Por fecha de pedido descendente, como ordena el
 *  servidor cada una; a igual fecha, las piezas primero (orden estable), y los cancelados al final, como hoy. */
export function juntarLineas(compras: CompraComponente[], otros: CompraOtro[]): Pedido[] {
  const todas: Pedido[] = [...compras, ...otros]
  return ordenarCanceladosAlFinal(todas.sort((a, b) => b.fechaPedido.localeCompare(a.fechaPedido)))
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

/** El buscador (:934-957 + 0.9.9): solo cifras busca el número de bloque exacto (0.9.15: también en los otros, que ya
 *  tienen bloque); el resto, "contiene" sin mayúsculas sobre el componente o el concepto. */
function pasaBuscador(p: Pedido, texto: string): boolean {
  if (texto === '') return true
  if (/^\d+$/.test(texto)) return p.idBloque === Number(texto)
  return nombrePedido(p).toLowerCase().includes(texto)
}

function pasaTipo(p: Pedido, tipo: TipoFiltro): boolean {
  return tipo === 'todos' || (tipo === 'piezas') === esCompra(p)
}

/** Predicado del FilteredList (:934-957): cada filtro vacío no filtra; entre ellos, Y. El buscador: ver `pasaBuscador`. */
export function aplicarFiltrosPedidos<T extends Pedido>(lista: T[], f: FiltrosPedidos): T[] {
  const texto = f.buscador.trim().toLowerCase()
  return lista.filter(
    (p) =>
      (f.estados.size === 0 || f.estados.has(p.estado as EstadoPedido)) &&
      (f.proveedores.size === 0 || f.proveedores.has(p.nombreProveedor)) &&
      pasaTipo(p, f.tipo) &&
      pasaBuscador(p, texto) &&
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

/** 0.9.15: la dirección antigua de «Otros» llega con `?tipo=otros` (spec §5.1). Un valor desconocido se ignora. */
export function tipoDesdeUrl(search: URLSearchParams): TipoFiltro | null {
  const tipo = search.get('tipo')
  return TIPOS_FILTRO.find((t) => t === tipo) ?? null
}

/** Algún filtro activo (0.9.9; «Tipo» desde la 0.9.15): con filtros, los bloques con coincidencias salen desplegados. */
export function hayFiltros(f: FiltrosPedidos): boolean {
  return f.estados.size > 0 || f.proveedores.size > 0 || f.buscador.trim() !== '' || f.desde !== '' || f.hasta !== '' || f.tipo !== 'todos'
}

/** Identifica unos filtros para olvidar el plegado a mano al cambiarlos. */
export function firmaFiltros(f: FiltrosPedidos): string {
  return JSON.stringify([[...f.estados].sort(), [...f.proveedores].sort(), f.buscador.trim().toLowerCase(), f.desde, f.hasta, f.tipo])
}
