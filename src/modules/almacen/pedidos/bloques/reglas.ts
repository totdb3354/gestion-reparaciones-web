import type { CompraComponente } from '@/shared/api/client'
import { formatear } from '@/shared/lib/fechas'
import type { AccionBloque } from '../api'
import { chipDeEstado, ESTADOS_PEDIDO, llevaAviso, marcaPrecioCero, marcaTotalCero, totalFila, type EstadoPedido } from '../reglas'

/** Reglas de los bloques de pedido (0.9.9, spec «Pedidos por bloques» §3 y §6): funciones puras sobre las líneas de
 *  GET /api/compras, que traen los datos de su bloque. */

/** Clave de grupo de la tabla y de los mapas de plegado. Una línea sin bloque (solo en el hueco de un despliegue)
 *  va al grupo «Sin bloque», sin menú. */
export const SIN_BLOQUE = 'sin-bloque'
export function claveBloque(p: CompraComponente): string {
  return p.idBloque == null ? SIN_BLOQUE : String(p.idBloque)
}

/** Un bloque visto desde sus líneas: la cabecera y TODAS sus líneas (sin filtrar), en el orden de la regla 7. */
export type Bloque = {
  clave: string
  idBloque: number | null
  idProv: number
  nombreProveedor: string
  fecha: string | null
  nota: string | null
  updatedAt: string | null
  antiguo: boolean
  lineas: CompraComponente[]
}

function porFechaPedido(a: CompraComponente, b: CompraComponente): number {
  return a.fechaPedido.localeCompare(b.fechaPedido) || a.idCompra - b.idCompra
}

/** Agrupa TODAS las líneas por bloque (sin filtrar: el resumen y el total son siempre del bloque entero). */
export function agruparEnBloques(todas: CompraComponente[]): Map<string, Bloque> {
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

/** Regla 7 (0.9.9): bloques de mayor a menor número; «Sin bloque», al final. */
export function compararBloques(a: Bloque, b: Bloque): number {
  if (a.idBloque === null) return b.idBloque === null ? 0 : 1
  if (b.idBloque === null) return -1
  return b.idBloque - a.idBloque
}

/** Las líneas visibles (ya filtradas) en el orden de la vista agrupada: cada bloque seguido, en el orden de la regla 7. */
export function ordenarPorBloques(visibles: CompraComponente[], bloques: Map<string, Bloque>): CompraComponente[] {
  const posicion = new Map([...bloques.values()].sort(compararBloques).map((b, i) => [b.clave, i]))
  return [...visibles].sort((a, b) => (posicion.get(claveBloque(a)) ?? 0) - (posicion.get(claveBloque(b)) ?? 0) || porFechaPedido(a, b))
}

export type Situacion = 'abierto' | 'en curso' | 'terminado'
const VIVOS = new Set(['pendiente', 'en_camino', 'parcial'])

/** Regla 3: abierto = todas pendientes; en curso = algo por hacer; terminado = todo recibido o cancelado. */
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

const ESTADO_DE: Record<AccionBloque, EstadoPedido> = { confirmar: 'pendiente', recibir: 'en_camino', cancelar: 'en_camino', borrar: 'pendiente' }

/** Las líneas a las que se aplica cada acción (spec §6.5). */
export function lineasQueCambian(b: Bloque, accion: AccionBloque): CompraComponente[] {
  return b.lineas.filter((p) => p.estado === ESTADO_DE[accion])
}

/** Motivo de cada línea que no cambia (tabla de la spec §6.5). */
export function motivoNoCambia(p: CompraComponente, accion: AccionBloque): string {
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

export type AccionMenuBloque = AccionBloque | 'anadir' | 'prevision' | 'separar' | 'juntar' | 'nota'
export type EntradaMenuBloque =
  | { accion: AccionMenuBloque; texto: string; deshabilitada: boolean; motivo: string | null; peligro: boolean }
  | 'separador'

/** Menú del bloque (spec §6.4). `otrosVivos`: cuántos bloques vivos más tiene su proveedor. */
export function entradasMenuBloque(b: Bloque, otrosVivos: number): EntradaMenuBloque[] {
  const cerrado = !esVivo(b)
  const TERMINADO = 'el bloque está terminado'
  const pendientes = lineasQueCambian(b, 'confirmar').length
  const enCamino = lineasQueCambian(b, 'recibir').length
  const entrada = (accion: AccionMenuBloque, texto: string, deshabilitada: boolean, motivo: string | null, peligro = false): EntradaMenuBloque =>
    ({ accion, texto, deshabilitada, motivo: deshabilitada ? motivo : null, peligro })
  return [
    entrada('confirmar', `Confirmar bloque (${pendientes})`, pendientes === 0, 'nada pendiente'),
    entrada('recibir', `Recibir todo (${enCamino})`, enCamino === 0, 'nada en camino'),
    'separador',
    entrada('anadir', 'Añadir líneas…', cerrado, TERMINADO),
    entrada('prevision', 'Añadir previsión…', cerrado, TERMINADO),
    entrada('separar', 'Separar líneas…', cerrado || b.lineas.length < 2, cerrado ? TERMINADO : 'solo tiene una línea'),
    entrada('juntar', 'Juntar con…', cerrado || otrosVivos === 0, cerrado ? TERMINADO : 'no hay otro bloque vivo de este proveedor'),
    entrada('nota', b.nota ? 'Editar nota…' : 'Añadir nota…', false, null),
    'separador',
    entrada('cancelar', `Cancelar bloque (${enCamino})`, enCamino === 0, 'nada en camino', true),
    entrada('borrar', 'Borrar bloque', pendientes !== b.lineas.length, 'hay líneas ya pedidas', true),
  ]
}

/** Bloques del proveedor (sin `excluir`), de mayor a menor número. «Sin bloque» nunca cuenta. */
export function bloquesDelProveedor(bloques: Map<string, Bloque>, idProv: number, excluir?: string): Bloque[] {
  return [...bloques.values()].filter((b) => b.idBloque !== null && b.idProv === idProv && b.clave !== excluir).sort(compararBloques)
}

/** 2026-10-12: solo se mueven las líneas vivas; lo recibido y lo cancelado es historial. */
export function sePuedeMover(p: CompraComponente): boolean {
  return VIVOS.has(p.estado)
}

/** Bloques vivos (abiertos o en curso) del proveedor, sin `excluir`, de mayor a menor número: los únicos que admiten
 *  líneas (un bloque terminado está cerrado, spec 2026-10-12). */
export function vivosDelProveedor(bloques: Map<string, Bloque>, idProv: number, excluir?: string): Bloque[] {
  return bloquesDelProveedor(bloques, idProv, excluir).filter(esVivo)
}

export function abiertosDe(bloques: Map<string, Bloque>, idProv: number): Bloque[] {
  return bloquesDelProveedor(bloques, idProv).filter((b) => situacion(b) === 'abierto')
}

export function textoLineas(n: number): string {
  return `${n} ${n === 1 ? 'línea' : 'líneas'}`
}

export function fechaCorta(fecha: string | null): string {
  return formatear(fecha, 'dd/MM')
}

export type DestinoMover = { idBloque: number; texto: string; detalle: string }

/** Submenú «Mover a bloque ▸» (spec §6.4 y 2026-10-12): los bloques vivos del proveedor sin el propio. */
export function destinosMover(p: CompraComponente, bloques: Map<string, Bloque>): DestinoMover[] {
  return vivosDelProveedor(bloques, p.idProv, claveBloque(p)).map((b) => ({
    idBloque: b.idBloque as number,
    texto: `Bloque ${b.idBloque}`,
    detalle: `${fechaCorta(b.fecha)} · ${textoLineas(b.lineas.length)} · ${situacion(b)}`,
  }))
}

/** «Bloque nuevo» no tiene sentido para una línea que ya está sola en su bloque. */
export function estaSola(p: CompraComponente, bloques: Map<string, Bloque>): boolean {
  return (bloques.get(claveBloque(p))?.lineas.length ?? 0) <= 1
}

/** Bloque sugerido al cambiar el proveedor en «Editar» (spec §6.6): pendiente → el abierto más reciente del proveedor
 *  nuevo; si no hay, o la línea ya se pidió, null (= bloque nuevo). */
export function destinoSugeridoEdicion(p: CompraComponente, idProvNuevo: number, bloques: Map<string, Bloque>): number | null {
  if (p.estado !== 'pendiente') return null
  return abiertosDe(bloques, idProvNuevo)[0]?.idBloque ?? null
}

/** Confirmación «Mover línea ya pedida» (spec §6.4). */
export function textoMoverYaPedida(p: CompraComponente, idBloque: number | null): string {
  const destino = idBloque === null ? 'a un bloque nuevo' : `al Bloque ${idBloque}`
  return `La línea ${p.tipoComponente} (ID ${p.idCompra}) está ${chipDeEstado(p.estado as EstadoPedido)}. ¿Moverla ${destino} igualmente?\n`
    + 'El stock no cambia. El movimiento queda apuntado en el registro de actividad.'
}

export function textoYaPedidasSeparar(n: number): string {
  return `${textoLineas(n)} de las marcadas ya ${n === 1 ? 'se pidió' : 'se pidieron'}: el movimiento quedará apuntado en el registro.`
}

export function textoYaPedidasJuntar(idBloque: number, n: number): string {
  return `El Bloque ${idBloque} tiene ${textoLineas(n)} ya ${n === 1 ? 'pedida' : 'pedidas'}: el movimiento quedará apuntado en el registro.`
}
