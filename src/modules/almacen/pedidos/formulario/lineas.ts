import type { Componente, SolicitudResumen, SolicitudStock } from '@/shared/api/client'
import type { PrecargaPedido } from '@/shared/lib/formularioPedido'
import { parsearDecimal, parsearEntero } from '@/shared/lib/importes'
import type { CuerpoLoteCompras, CuerpoLoteOtros } from '../api'

/** Línea de "Nuevo pedido" (LineaCompra del JavaFX). Cantidad y precio van como texto: las celdas son inputs siempre
 *  editables (P8) y el texto se valida al confirmar. */
export type LineaCompra = { id: number; idCom: number | null; idProv: number | null; cantidad: string; precio: string; urgente: boolean }
/** Línea de "Nuevo otro pedido" (LineaOtro, FO :46-73). */
export type LineaOtro = { id: number; concepto: string; idProv: number | null; cantidad: string; precio: string; urgente: boolean }
/** Lo común a las dos: las columnas Proveedor, Cant., P.Unit., Urg., Total EUR y la papelera (DialogoLineas). */
export type LineaBase = { id: number; idProv: number | null; cantidad: string; precio: string; urgente: boolean }

export const MSG_SIN_LINEAS = 'Añade al menos una línea.'

/** Cuerpo de la confirmación "Descartar" del Atrás del navegador con líneas en el pedido (decisión del usuario 2026-09-27). */
export function textoDescartar(n: number): string {
  return n === 1 ? 'Se descartará la línea del pedido.' : `Se descartarán las ${n} líneas del pedido.`
}

/** Cantidad 1, precio 0 (mostrado "0,00"), sin proveedor, sin urgente (LineaCompra del JavaFX). */
export function lineaCompraVacia(id: number, idCom: number | null = null): LineaCompra {
  return { id, idCom, idProv: null, cantidad: '1', precio: '0,00', urgente: false }
}

export function lineaOtroVacia(id: number): LineaOtro {
  return { id, concepto: '', idProv: null, cantidad: '1', precio: '0,00', urgente: false }
}

/** Id del master al que se pide un componente: el de su master si es slave, el suyo si no. Devuelve null si el id es
 *  desconocido, si su master no está entre los activos (el pedido siempre va al master) o si su "master" es a su vez un
 *  slave (cadena, dato inválido): como en Stock, ese componente es una fila suelta y no se pide a un slave. */
export function idPedible(idCom: number, activos: Componente[]): number | null {
  const c = activos.find((x) => x.idCom === idCom)
  if (c === undefined) return null
  const idMaster = c.idComMaster ?? c.idCom
  return activos.some((x) => x.idCom === idMaster && x.activo && x.idComMaster == null) ? idMaster : null
}

/** "Pedir" (1 id) y "Pedir todas las piezas" (N ids, orden de la campana): una línea por id con cantidad 1. El id de un
 *  slave se sustituye por el de su master (el pedido va al master). Un id que no está entre los activos, o cuyo master
 *  no lo está, deja la línea vacía, como el JavaFX (buscaba en `componentesDisponibles` y no rellenaba). */
export function precargarComponentes(idsCom: number[], activos: Componente[]): LineaCompra[] {
  return idsCom.map((idCom, i) => lineaCompraVacia(i + 1, idPedible(idCom, activos)))
}

/** "Pedir piezas" (initConSolicitudes, FC :606-621): agrupa por componente, con los slaves sumados en su master, en el
 *  orden de un LinkedHashMap (urgentes en su orden, luego preventivas); la cantidad es el número de solicitudes.
 *  Diferencia D10: las de un componente no activo (o de un slave cuyo master no lo está) no generan línea y se cuentan
 *  en `omitidas` para avisar (el JavaFX las omitía en silencio y aun así las marcaba). */
export function precargarSolicitudes(urgentes: SolicitudResumen[], preventivas: SolicitudStock[], activos: Componente[]): { lineas: LineaCompra[]; omitidas: number } {
  const porComponente = new Map<number, number>()
  let omitidas = 0
  for (const id of [...urgentes.map((s) => s.idCom), ...preventivas.map((s) => s.idCom)]) {
    const idCom = idPedible(id, activos)
    if (idCom === null) {
      omitidas += 1
      continue
    }
    porComponente.set(idCom, (porComponente.get(idCom) ?? 0) + 1)
  }
  const lineas = Array.from(porComponente, ([idCom, n], i) => ({ ...lineaCompraVacia(i + 1, idCom), cantidad: String(n) }))
  return { lineas, omitidas }
}

/** Líneas con las que abre el formulario según el modo del store (T8). */
export function precargaInicial(precarga: PrecargaPedido, activos: Componente[]): { lineas: LineaCompra[]; omitidas: number } {
  switch (precarga.modo) {
    case 'vacio':
      return { lineas: [], omitidas: 0 }
    case 'componentes':
      return { lineas: precargarComponentes(precarga.idsCom, activos), omitidas: 0 }
    case 'solicitudes':
      return precargarSolicitudes(precarga.urgentes, precarga.preventivas, activos)
  }
}

/** Línea de información del formulario en modo solicitudes (spec §6, D10). */
export function avisoOmitidas(n: number): string | null {
  return n > 0 ? `${n} solicitud(es) de componentes desactivados no se han añadido y siguen pendientes.` : null
}

/** Piezas del pedido automático (spec 0.9.6 §4.4): marcadas y que son master o sueltas. Los slaves traen la marca y
 *  la previsión de su master (el listado las copia), así que contarlos duplicaría el grupo; el pedido va al master. */
function marcadas(activos: Componente[]): Componente[] {
  return activos.filter((c) => c.autoPedido === true && c.idComMaster == null)
}

/** N del botón «Añadir previsión (N)»: marcadas con algo que pedir. */
export function cuantasPrevision(activos: Componente[]): number {
  return marcadas(activos).filter((c) => (c.pedir60 ?? 0) > 0).length
}

/** «Añadir previsión» (spec 0.9.6 §4.4). Marcada sin línea: línea nueva con «Pedir 60 d» y el proveedor general, o
 *  nada si no hay que pedir (cuenta en `sinPedido`). Marcada con línea: cantidad = máx(la de la línea, la previsión, 1)
 *  y el proveedor general solo si la línea no tenía. Las líneas de piezas no marcadas no se tocan. Idempotente. */
export function aplicarPrevision(lineas: LineaCompra[], activos: Componente[], idProv: number): { lineas: LineaCompra[]; sinPedido: number } {
  let resultado = lineas
  let sinPedido = 0
  for (const c of marcadas(activos)) {
    const pedir = c.pedir60 ?? 0
    const existente = resultado.find((l) => l.idCom === c.idCom)
    if (existente === undefined) {
      if (pedir > 0) resultado = [...resultado, { ...lineaCompraVacia(siguienteId(resultado), c.idCom), idProv, cantidad: String(pedir) }]
      else sinPedido += 1
      continue
    }
    const cantidad = Math.max(parsearEntero(existente.cantidad) ?? 0, pedir, 1)
    resultado = cambiarLinea(resultado, existente.id, { cantidad: String(cantidad), idProv: existente.idProv ?? idProv })
  }
  return { lineas: resultado, sinPedido }
}

/** «Aplicar a todas»: el proveedor general en todas las líneas, también en las que ya tenían uno. */
export function aplicarProveedorATodas<T extends { idProv: number | null }>(lineas: T[], idProv: number): T[] {
  return lineas.map((l) => ({ ...l, idProv }))
}

export function avisoSinPedido(n: number): string | null {
  if (n <= 0) return null
  return n === 1 ? '1 pieza marcada no necesita pedido.' : `${n} piezas marcadas no necesitan pedido.`
}

/** Proveedor → cantidad → precio (FC :528-538, FO :452-466). */
function errorComun(l: LineaBase, n: number): string | null {
  if (l.idProv === null) return `Línea ${n}: selecciona un proveedor.`
  const cantidad = parsearEntero(l.cantidad)
  if (cantidad === null || cantidad <= 0) return `Línea ${n}: la cantidad debe ser mayor que 0.`
  const precio = parsearDecimal(l.precio)
  if (precio === null || precio < 0) return `Línea ${n}: el precio no puede ser negativo.`
  return null
}

/** Calco de confirmar (FC :517-540): primer error o null. */
export function validarLineasCompra(lineas: LineaCompra[]): string | null {
  if (lineas.length === 0) return MSG_SIN_LINEAS
  for (const [i, l] of lineas.entries()) {
    const n = i + 1
    if (l.idCom === null) return `Línea ${n}: selecciona un componente.`
    const error = errorComun(l, n)
    if (error !== null) return error
  }
  return null
}

/** Calco de confirmar de otros (FO :444-468): el concepto, recortado, va antes que lo común. */
export function validarLineasOtro(lineas: LineaOtro[]): string | null {
  if (lineas.length === 0) return MSG_SIN_LINEAS
  for (const [i, l] of lineas.entries()) {
    const n = i + 1
    if (l.concepto.trim() === '') return `Línea ${n}: el concepto no puede estar vacío.`
    const error = errorComun(l, n)
    if (error !== null) return error
  }
  return null
}

/** Cuerpo de POST /api/compras/lote. Solo se llama con `validarLineasCompra(lineas) === null` (por eso los `as number`).
 *  Las solicitudes que viajan son las de componentes (o de su master, si son slaves) que siguen teniendo línea al confirmar (spec §6): si el usuario quitó
 *  la línea o le cambió el componente, esas solicitudes siguen PENDIENTE. */
export function cuerpoLoteCompras(lineas: LineaCompra[], origen: { urgentes: SolicitudResumen[]; preventivas: SolicitudStock[] } | null, activos: Componente[]): CuerpoLoteCompras {
  const conLinea = new Set(lineas.map((l) => l.idCom))
  // Las líneas llevan el id del master: la solicitud de un slave se resuelve a él antes de comprobar si su grupo tiene línea
  // (el servidor marca GESTIONADA exactamente las solicitudes que recibe).
  const tieneLinea = (idCom: number) => conLinea.has(idPedible(idCom, activos) ?? idCom)
  return {
    lineas: lineas.map((l) => ({
      idCom: l.idCom as number,
      idProv: l.idProv as number,
      cantidad: parsearEntero(l.cantidad) as number,
      esUrgente: l.urgente,
      precioUnidad: parsearDecimal(l.precio) as number,
    })),
    solicitudes: origen === null
      ? { urgentes: [], preventivas: [] }
      : {
          urgentes: origen.urgentes.filter((s) => tieneLinea(s.idCom)).map((s) => s.idRc),
          preventivas: origen.preventivas.filter((s) => tieneLinea(s.idCom)).map((s) => s.idSol),
        },
  }
}

/** Cuerpo de POST /api/compras-otros/lote; concepto recortado (FO :470-478). Solo con `validarLineasOtro(lineas) === null`. */
export function cuerpoLoteOtros(lineas: LineaOtro[]): CuerpoLoteOtros {
  return {
    lineas: lineas.map((l) => ({
      idProv: l.idProv as number,
      concepto: l.concepto.trim(),
      cantidad: parsearEntero(l.cantidad) as number,
      esUrgente: l.urgente,
      precioUnidad: parsearDecimal(l.precio) as number,
    })),
  }
}

export function cambiarLinea<T extends { id: number }>(lineas: T[], id: number, cambio: Partial<T>): T[] {
  return lineas.map((l) => (l.id === id ? { ...l, ...cambio } : l))
}

export function quitarLinea<T extends { id: number }>(lineas: T[], id: number): T[] {
  return lineas.filter((l) => l.id !== id)
}

export function siguienteId(lineas: { id: number }[]): number {
  return lineas.reduce((max, l) => Math.max(max, l.id), 0) + 1
}
