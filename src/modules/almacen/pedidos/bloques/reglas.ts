import { formatear } from '@/shared/lib/fechas'
import type { AccionBloque } from '../api'
import {
  chipDeEstado, esCompra, ESTADOS_PEDIDO, idPedido, idVisible, llevaAviso, marcaPrecioCero, marcaTotalCero, nombrePedido, totalFila,
  type EstadoPedido, type Pedido,
} from '../reglas'

/** Reglas de los bloques de pedido (0.9.9, spec «Pedidos por bloques» §3 y §6): funciones puras sobre las líneas de
 *  GET /api/compras y, desde la 0.9.15, también de GET /api/compras-otros; las dos traen los datos de su bloque. */

/** Clave de grupo de la tabla y de los mapas de plegado. Una línea sin bloque (solo en el hueco de un despliegue)
 *  va al grupo «Sin bloque», sin menú. */
export const SIN_BLOQUE = 'sin-bloque'
export function claveBloque(p: Pedido): string {
  return p.idBloque == null ? SIN_BLOQUE : String(p.idBloque)
}

/** Un bloque visto desde sus líneas: la cabecera y TODAS sus líneas, piezas y otros (sin filtrar), en el orden de la
 *  regla 7. */
export type Bloque = {
  clave: string
  idBloque: number | null
  idProv: number
  nombreProveedor: string
  fecha: string | null
  nota: string | null
  updatedAt: string | null
  antiguo: boolean
  lineas: Pedido[]
}

/** Fecha de pedido; a igual fecha, las piezas antes que los otros y después el id (0.9.15: el orden del servidor,
 *  FECHA_PEDIDO, tipo e id). */
function porFechaPedido(a: Pedido, b: Pedido): number {
  return a.fechaPedido.localeCompare(b.fechaPedido) || Number(!esCompra(a)) - Number(!esCompra(b)) || idPedido(a) - idPedido(b)
}

/** Agrupa TODAS las líneas por bloque (sin filtrar: el resumen y el total son siempre del bloque entero). */
export function agruparEnBloques(todas: Pedido[]): Map<string, Bloque> {
  const mapa = new Map<string, Bloque>()
  for (const p of todas) {
    const clave = claveBloque(p)
    let b = mapa.get(clave)
    if (b === undefined) {
      b = {
        clave, idBloque: p.idBloque ?? null, idProv: p.idProv, nombreProveedor: p.nombreProveedor, fecha: p.fechaBloque ?? null,
        nota: p.notaBloque ?? null, updatedAt: p.bloqueUpdatedAt ?? null, antiguo: p.bloqueAntiguo, lineas: [],
      }
      mapa.set(clave, b)
    }
    b.lineas.push(p)
  }
  for (const b of mapa.values()) b.lineas.sort(porFechaPedido)
  return mapa
}

/** Regla 7 (0.9.15): bloques del más reciente al más antiguo, por fecha y, a igual fecha, por número, descendentes;
 *  «Sin bloque», al final. Los bloques antiguos que la reconstrucción de la 0.9.15 crea para los otros de antes llevan
 *  números altos y fechas viejas: ordenados solo por número saldrían arriba. En los actuales, fecha y número van a la par. */
export function compararBloques(a: Bloque, b: Bloque): number {
  if (a.idBloque === null) return b.idBloque === null ? 0 : 1
  if (b.idBloque === null) return -1
  return (b.fecha ?? '').localeCompare(a.fecha ?? '') || b.idBloque - a.idBloque
}

/** Las líneas visibles (ya filtradas) en el orden de la vista agrupada: cada bloque seguido, en el orden de la regla 7. */
export function ordenarPorBloques<T extends Pedido>(visibles: T[], bloques: Map<string, Bloque>): T[] {
  const posicion = new Map([...bloques.values()].sort(compararBloques).map((b, i) => [b.clave, i]))
  return [...visibles].sort((a, b) => (posicion.get(claveBloque(a)) ?? 0) - (posicion.get(claveBloque(b)) ?? 0) || porFechaPedido(a, b))
}

export type Situacion = 'abierto' | 'en curso' | 'terminado'
const VIVOS = new Set(['pendiente', 'en_camino', 'parcial'])

/** Regla 3 (con piezas y otros desde la 0.9.15): abierto = todas pendientes; en curso = algo por hacer; terminado = todo
 *  recibido o cancelado. */
export function situacion(b: Bloque): Situacion {
  if (b.lineas.every((p) => p.estado === 'pendiente')) return 'abierto'
  return b.lineas.some((p) => VIVOS.has(p.estado)) ? 'en curso' : 'terminado'
}
export function esVivo(b: Bloque): boolean {
  return situacion(b) !== 'terminado'
}

/** Spec §6.2: lo que el usuario plegó o desplegó a mano manda; si no, con filtros todos desplegados y sin filtros solo
 *  los vivos. */
export function estaDesplegado(b: Bloque, conFiltros: boolean, mapa: Record<string, boolean>): boolean {
  return mapa[b.clave] ?? (conFiltros || esVivo(b))
}

/** Regla 4. */
export function resumenEstados(b: Bloque): { estado: EstadoPedido; n: number }[] {
  return ESTADOS_PEDIDO.map((estado) => ({ estado, n: b.lineas.filter((p) => p.estado === estado).length })).filter((r) => r.n > 0)
}

/** Regla 5: la columna EUR de las líneas no canceladas. */
export function totalBloque(b: Bloque): number {
  return b.lineas.filter((p) => p.estado !== 'cancelado').reduce((s, p) => s + totalFila(p), 0)
}

/** Regla 6. */
export function avisoBloque(b: Bloque): boolean {
  return b.lineas.some(llevaAviso)
}

/** 2026-10-13: líneas recibidas sin precio (las del «!» ámbar de su fila); el precio se pone con «Editar». */
export function sinPrecio(b: Bloque): number {
  return b.lineas.filter((p) => marcaPrecioCero(p) || marcaTotalCero(p)).length
}

export function textoSinPrecio(n: number): string {
  return `${n === 1 ? '1 línea recibida' : `${n} líneas recibidas`} sin precio: ponlo con «Editar».`
}

/** 0.9.15: cuántas líneas del bloque son otros. */
export function otrosDe(b: Bloque): number {
  return b.lineas.filter((p) => !esCompra(p)).length
}

/** Líneas de la cabecera del bloque (0.9.15, spec §5.1): «3 líneas» o, con otros, «3 líneas (1 otro)». */
export function textoLineasBloque(b: Bloque): string {
  const n = otrosDe(b)
  return n === 0 ? textoLineas(b.lineas.length) : `${textoLineas(b.lineas.length)} (${n} ${n === 1 ? 'otro' : 'otros'})`
}

/** Etiqueta accesible de una línea en los diálogos de bloque: «{componente o concepto} (ID {id})», con «O-{id}» en un
 *  otro (0.9.15, spec §5.1). */
export function etiquetaLinea(p: Pedido): string {
  return `${nombrePedido(p)} (ID ${idVisible(p)})`
}

/** Título de lo que cambia en «Recibir todo» (0.9.15): recibir un otro no toca el stock. Solo piezas (o ninguna): el de
 *  siempre; piezas y otros: «las piezas suman al stock»; solo otros: «no tocan el stock». */
export function textoSeReciben(lineas: Pedido[]): string {
  const otros = lineas.filter((p) => !esCompra(p)).length
  if (otros === 0) return 'Se reciben (suman al stock)'
  return otros === lineas.length ? 'Se reciben (no tocan el stock)' : 'Se reciben (las piezas suman al stock)'
}

const ESTADO_DE: Record<AccionBloque, EstadoPedido> = { confirmar: 'pendiente', recibir: 'en_camino', cancelar: 'en_camino', borrar: 'pendiente' }

/** Las líneas a las que se aplica cada acción (spec §6.5), piezas y otros. */
export function lineasQueCambian(b: Bloque, accion: AccionBloque): Pedido[] {
  return b.lineas.filter((p) => p.estado === ESTADO_DE[accion])
}

/** Motivo de cada línea que no cambia (tabla de la spec §6.5). */
export function motivoNoCambia(p: Pedido, accion: AccionBloque): string {
  const e = p.estado
  if (accion === 'confirmar') return e === 'cancelado' ? 'cancelado' : `ya ${chipDeEstado(e as EstadoPedido)}`
  if (accion === 'recibir') {
    if (e === 'pendiente') return 'pendiente: aún no se ha pedido'
    if (e === 'parcial') return `parcial (${p.cantidadRecibida ?? 0}/${p.cantidad}): usa «Recibir resto» en su fila`
    return e === 'recibido' ? 'ya recibido' : 'cancelado'
  }
  if (accion === 'cancelar') {
    if (e === 'pendiente') return 'pendiente: se borra, no se cancela'
    if (e === 'parcial') return 'parcial: usa «Cerrar sin resto» en su fila'
    return e === 'recibido' ? 'ya recibido' : 'ya cancelado'
  }
  return chipDeEstado(e as EstadoPedido)
}

/** 0.9.13: lo que pasa con una línea desmarcada en «Confirmar bloque», «Recibir todo» o «Cancelar bloque». */
export function textoQueda(accion: AccionBloque): string {
  return accion === 'confirmar' ? 'se queda pendiente' : 'se queda en camino'
}

/** 0.9.13: aviso bajo la lista de un diálogo de bloque con líneas desmarcadas. */
export function textoDesmarcadas(accion: AccionBloque, n: number): string {
  const pendiente = accion === 'confirmar'
  if (n === 1) return `${pendiente ? 'Se queda pendiente' : 'Se queda en camino'} 1 línea: la desmarcada no cambia.`
  return `${pendiente ? 'Se quedan pendientes' : 'Se quedan en camino'} ${n} líneas: las desmarcadas no cambian.`
}

export type AccionMenuBloque = AccionBloque | 'anadir' | 'otro' | 'prevision' | 'separar' | 'juntar' | 'nota' | 'exportar'
export type EntradaMenuBloque =
  | { accion: AccionMenuBloque; texto: string; deshabilitada: boolean; motivo: string | null; peligro: boolean }
  | 'separador'

/** Menú del bloque (spec §6.4). `otrosVivos`: cuántos bloques vivos más tiene su proveedor. 0.9.13: «Exportar bloque en
 *  CSV» siempre disponible; sin `puedeEditar` (admin y técnico) es la única entrada. 0.9.15: «Añadir otro…» justo tras «Añadir líneas…», cerrado
 *  como ella en un bloque terminado. */
export function entradasMenuBloque(b: Bloque, otrosVivos: number, puedeEditar = true): EntradaMenuBloque[] {
  const entrada = (accion: AccionMenuBloque, texto: string, deshabilitada: boolean, motivo: string | null, peligro = false): EntradaMenuBloque =>
    ({ accion, texto, deshabilitada, motivo: deshabilitada ? motivo : null, peligro })
  const exportar = entrada('exportar', 'Exportar bloque en CSV', false, null)
  if (!puedeEditar) return [exportar]
  const cerrado = !esVivo(b)
  const TERMINADO = 'el bloque está terminado'
  const pendientes = lineasQueCambian(b, 'confirmar').length
  const enCamino = lineasQueCambian(b, 'recibir').length
  return [
    entrada('confirmar', `Confirmar bloque (${pendientes})`, pendientes === 0, 'nada pendiente'),
    entrada('recibir', `Recibir todo (${enCamino})`, enCamino === 0, 'nada en camino'),
    'separador',
    entrada('anadir', 'Añadir líneas…', cerrado, TERMINADO),
    entrada('otro', 'Añadir otro…', cerrado, TERMINADO),
    entrada('prevision', 'Añadir previsión…', cerrado, TERMINADO),
    entrada('separar', 'Separar líneas…', cerrado || b.lineas.length < 2, cerrado ? TERMINADO : 'solo tiene una línea'),
    entrada('juntar', 'Juntar con…', cerrado || otrosVivos === 0, cerrado ? TERMINADO : 'no hay otro bloque vivo de este proveedor'),
    entrada('nota', b.nota ? 'Editar nota…' : 'Añadir nota…', false, null),
    exportar,
    'separador',
    entrada('cancelar', `Cancelar bloque (${enCamino})`, enCamino === 0, 'nada en camino', true),
    entrada('borrar', 'Borrar bloque', pendientes !== b.lineas.length, 'hay líneas ya pedidas', true),
  ]
}

/** Bloques del proveedor (sin `excluir`), del más reciente al más antiguo (regla 7). «Sin bloque» nunca cuenta. */
export function bloquesDelProveedor(bloques: Map<string, Bloque>, idProv: number, excluir?: string): Bloque[] {
  return [...bloques.values()].filter((b) => b.idBloque !== null && b.idProv === idProv && b.clave !== excluir).sort(compararBloques)
}

/** 2026-10-12: solo se mueven las líneas vivas; lo recibido y lo cancelado es historial. 0.9.15: también los otros. */
export function sePuedeMover(p: Pedido): boolean {
  return VIVOS.has(p.estado)
}

/** Bloques vivos (abiertos o en curso) del proveedor, sin `excluir`, del más reciente al más antiguo: los únicos que
 *  admiten líneas (un bloque terminado está cerrado, spec 2026-10-12). */
export function vivosDelProveedor(bloques: Map<string, Bloque>, idProv: number, excluir?: string): Bloque[] {
  return bloquesDelProveedor(bloques, idProv, excluir).filter(esVivo)
}

/** Bloques abiertos del proveedor: primero los actuales y después los antiguos (0.9.15, decisión del usuario: uno
 *  antiguo, reconstruido, nunca se prefiere a uno actual), cada grupo en el orden de `compararBloques`. El primero es el
 *  destino que propone «Nuevo pedido» y el sugerido al editar, igual que el `abiertoMasReciente` del servidor. */
export function abiertosDe(bloques: Map<string, Bloque>, idProv: number): Bloque[] {
  const abiertos = bloquesDelProveedor(bloques, idProv).filter((b) => situacion(b) === 'abierto')
  return [...abiertos.filter((b) => !b.antiguo), ...abiertos.filter((b) => b.antiguo)]
}

export function textoLineas(n: number): string {
  return `${n} ${n === 1 ? 'línea' : 'líneas'}`
}

export function fechaCorta(fecha: string | null): string {
  return formatear(fecha, 'dd/MM')
}

export type DestinoMover = { idBloque: number; texto: string; detalle: string }

/** Submenú «Mover a bloque ▸» (spec §6.4 y 2026-10-12): los bloques vivos del proveedor sin el propio. */
export function destinosMover(p: Pedido, bloques: Map<string, Bloque>): DestinoMover[] {
  return vivosDelProveedor(bloques, p.idProv, claveBloque(p)).map((b) => ({
    idBloque: b.idBloque as number,
    texto: `Bloque ${b.idBloque}`,
    detalle: `${fechaCorta(b.fecha)} · ${textoLineas(b.lineas.length)} · ${situacion(b)}`,
  }))
}

/** «Bloque nuevo» no tiene sentido para una línea que ya está sola en su bloque. */
export function estaSola(p: Pedido, bloques: Map<string, Bloque>): boolean {
  return (bloques.get(claveBloque(p))?.lineas.length ?? 0) <= 1
}

/** Bloque sugerido al cambiar el proveedor en «Editar» (spec §6.6): pendiente → el abierto más reciente del proveedor
 *  nuevo; si no hay, o la línea ya se pidió, null (= bloque nuevo). */
export function destinoSugeridoEdicion(p: Pedido, idProvNuevo: number, bloques: Map<string, Bloque>): number | null {
  if (p.estado !== 'pendiente') return null
  return abiertosDe(bloques, idProvNuevo)[0]?.idBloque ?? null
}

/** Confirmación «Mover línea ya pedida» (spec §6.4); con un otro, su concepto y «O-{id}» (0.9.15). */
export function textoMoverYaPedida(p: Pedido, idBloque: number | null): string {
  const destino = idBloque === null ? 'a un bloque nuevo' : `al Bloque ${idBloque}`
  return `La línea ${nombrePedido(p)} (ID ${idVisible(p)}) está ${chipDeEstado(p.estado as EstadoPedido)}. ¿Moverla ${destino} igualmente?\n`
    + 'El stock no cambia. El movimiento queda apuntado en el registro de actividad.'
}

export function textoYaPedidasSeparar(n: number): string {
  return `${textoLineas(n)} de las marcadas ya ${n === 1 ? 'se pidió' : 'se pidieron'}: el movimiento quedará apuntado en el registro.`
}

export function textoYaPedidasJuntar(idBloque: number, n: number): string {
  return `El Bloque ${idBloque} tiene ${textoLineas(n)} ya ${n === 1 ? 'pedida' : 'pedidas'}: el movimiento quedará apuntado en el registro.`
}
