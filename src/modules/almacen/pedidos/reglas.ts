import type { CompraComponente, CompraOtro } from '@/shared/api/client'

/** `CompraComponente.Estado` del JavaFX; el servidor lo manda tal cual (`name()`), con guion bajo en `en_camino`. */
export type EstadoPedido = 'pendiente' | 'en_camino' | 'parcial' | 'recibido' | 'cancelado'
/** En el orden de los cinco checks del menú "Estado" (StockController :943-949). */
export const ESTADOS_PEDIDO: EstadoPedido[] = ['pendiente', 'en_camino', 'parcial', 'recibido', 'cancelado']

/** Toggle "Componentes" | "Otros" (spec 4b, P4). */
export type TipoPedido = 'componentes' | 'otros'
export type Pedido = CompraComponente | CompraOtro

export function esCompra(p: Pedido): p is CompraComponente {
  return 'idCompra' in p
}

export function idPedido(p: Pedido): number {
  return esCompra(p) ? p.idCompra : p.idCompraOtro
}

/** Lo que va en `{componente}` de los textos y en el buscador: el tipo del componente o, en otros, el concepto. */
export function nombrePedido(p: Pedido): string {
  return esCompra(p) ? p.tipoComponente : p.concepto
}

/** Texto del check del filtro: `estado.name().replace('_', ' ')` (StockController :925-933). */
export function chipDeEstado(e: EstadoPedido): string {
  return e.replace('_', ' ')
}

export function estadoDeChip(chip: string): EstadoPedido | null {
  return ESTADOS_PEDIDO.find((e) => chipDeEstado(e) === chip) ?? null
}

/** Columna "Cant." (StockController :782-794). */
export function textoCantidad(p: Pedido): string {
  if (p.estado === 'parcial') return p.cantidadRecibida != null ? `${p.cantidadRecibida}/${p.cantidad}` : String(p.cantidad)
  if (p.estado === 'recibido') return String(p.cantidadRecibida ?? p.cantidad)
  return String(p.cantidad)
}

/** Unidades del total de la columna EUR y del CSV (:825-849, :1968-1970): la recibida en `recibido` si no es nula. */
export function unidadesFila(p: Pedido): number {
  return p.estado === 'recibido' && p.cantidadRecibida != null ? p.cantidadRecibida : p.cantidad
}

export function totalFila(p: Pedido): number {
  return unidadesFila(p) * p.precioEur
}

/** "!" ámbar de P.Unit. (:815-819). */
export function marcaPrecioCero(p: Pedido): boolean {
  return p.estado === 'recibido' && p.precioUnidadPedido === 0
}

/** "!" ámbar de EUR (:841-845). */
export function marcaTotalCero(p: Pedido): boolean {
  return p.estado === 'recibido' && totalFila(p) === 0
}

/** "⚠" junto al badge (:901, :915): urgente y en camino o parcial; un pendiente urgente no lo lleva (calco). */
export function llevaAviso(p: Pedido): boolean {
  return p.esUrgente && (p.estado === 'en_camino' || p.estado === 'parcial')
}

export type AccionMenu = 'confirmar' | 'editar' | 'borrar' | 'parcial' | 'recibido' | 'cancelar' | 'resto' | 'cerrarSinResto' | 'revertir'
export type EntradaMenu = { accion: AccionMenu; texto: string } | 'separador'

const EDITAR: EntradaMenu = { accion: 'editar', texto: 'Editar' }
const MENU: Record<EstadoPedido, EntradaMenu[]> = {
  pendiente: [{ accion: 'confirmar', texto: 'Confirmar pedido' }, 'separador', EDITAR, { accion: 'borrar', texto: 'Borrar' }],
  en_camino: [{ accion: 'parcial', texto: 'Recepción parcial' }, { accion: 'recibido', texto: 'Confirmar recibido' }, 'separador', EDITAR, { accion: 'cancelar', texto: 'Cancelar pedido' }],
  parcial: [{ accion: 'resto', texto: 'Recibir resto' }, { accion: 'cerrarSinResto', texto: 'Cerrar sin resto' }],
  recibido: [{ accion: 'revertir', texto: 'Revertir a En camino' }, 'separador', EDITAR],
  cancelado: [],
}

/** Menú contextual por estado, idéntico en las dos tablas (StockController :970-1010 y :1237-1277). Cancelado o un estado
 *  desconocido: sin entradas. */
export function entradasMenu(estado: string): EntradaMenu[] {
  return (ESTADOS_PEDIDO as string[]).includes(estado) ? MENU[estado as EstadoPedido] : []
}

export type Validacion = { ok: true; valor: number } | { ok: false; error: string }

const MSG_NO_VALIDA = 'Cantidad no válida.'
const ENTERO_CON_SIGNO = /^[+-]?\d+$/

/** `Integer.parseInt(texto.trim())`: admite signo, así que "-3" es un número (y cae en el rango, no en "no válida"). */
function parsearEnteroJava(texto: string): number | null {
  const t = texto.trim()
  return ENTERO_CON_SIGNO.test(t) ? Number(t) : null
}

/** "Recepción parcial" (:1510-1521). */
export function validarParcial(texto: string, cantidad: number): Validacion {
  const n = parsearEnteroJava(texto)
  if (n === null) return { ok: false, error: MSG_NO_VALIDA }
  if (n <= 0 || n >= cantidad) return { ok: false, error: `La cantidad debe ser mayor que 0 y menor que ${cantidad}.` }
  return { ok: true, valor: n }
}

/** "Recibir unidades" (:1546-1561). */
export function validarResto(texto: string, recibida: number | null, cantidad: number): Validacion {
  const n = parsearEnteroJava(texto)
  if (n === null) return { ok: false, error: MSG_NO_VALIDA }
  if (n <= 0) return { ok: false, error: 'La cantidad debe ser mayor que 0.' }
  const yaRecibidas = recibida ?? 0
  if (yaRecibidas + n > cantidad) return { ok: false, error: `No puedes recibir más de lo pedido. Faltan ${cantidad - yaRecibidas} unidad(es).` }
  return { ok: true, valor: n }
}

/** Unidades que faltan (:1535): valor inicial de "Recibir unidades". */
export function restante(p: Pedido): number {
  return p.cantidad - (p.cantidadRecibida ?? 0)
}

/** Unidades que "Revertir a En camino" descuenta del stock (:1622). */
export function cantidadARevertir(p: Pedido): number {
  return p.cantidadRecibida ?? p.cantidad
}
