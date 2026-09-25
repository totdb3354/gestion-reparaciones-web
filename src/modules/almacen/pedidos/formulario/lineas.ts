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

/** Cantidad 1, precio 0 (mostrado "0,00"), sin proveedor, sin urgente (LineaCompra del JavaFX). */
export function lineaCompraVacia(id: number, idCom: number | null = null): LineaCompra {
  return { id, idCom, idProv: null, cantidad: '1', precio: '0,00', urgente: false }
}

export function lineaOtroVacia(id: number): LineaOtro {
  return { id, concepto: '', idProv: null, cantidad: '1', precio: '0,00', urgente: false }
}

function idsActivos(activos: Componente[]): Set<number> {
  return new Set(activos.filter((c) => c.activo).map((c) => c.idCom))
}

/** "Pedir" (1 id) y "Pedir todas las piezas" (N ids, orden de la campana): una línea por id con cantidad 1. Un id que no
 *  está entre los activos deja la línea vacía, como el JavaFX (buscaba en `componentesDisponibles` y no rellenaba). */
export function precargarComponentes(idsCom: number[], activos: Componente[]): LineaCompra[] {
  const validos = idsActivos(activos)
  return idsCom.map((idCom, i) => lineaCompraVacia(i + 1, validos.has(idCom) ? idCom : null))
}

/** "Pedir piezas" (initConSolicitudes, FC :606-621): agrupa por componente con el orden de un LinkedHashMap (urgentes en su
 *  orden, luego preventivas) y la cantidad es el número de solicitudes. Diferencia D10: las de un componente no activo no
 *  generan línea y se cuentan en `omitidas` para avisar (el JavaFX las omitía en silencio y aun así las marcaba). */
export function precargarSolicitudes(urgentes: SolicitudResumen[], preventivas: SolicitudStock[], activos: Componente[]): { lineas: LineaCompra[]; omitidas: number } {
  const validos = idsActivos(activos)
  const porComponente = new Map<number, number>()
  let omitidas = 0
  for (const idCom of [...urgentes.map((s) => s.idCom), ...preventivas.map((s) => s.idCom)]) {
    if (!validos.has(idCom)) {
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

/** Componente con el que "+ Añadir línea" rellena la línea nueva (añadirFila :496-513, `preselect`): solo cuando se abrió
 *  con un único componente ("Pedir") y ese componente está activo. */
export function preseleccionDe(precarga: PrecargaPedido, activos: Componente[]): number | null {
  if (precarga.modo !== 'componentes' || precarga.idsCom.length !== 1) return null
  const id = precarga.idsCom[0]
  return idsActivos(activos).has(id) ? id : null
}

/** Línea de información del formulario en modo solicitudes (spec §6, D10). */
export function avisoOmitidas(n: number): string | null {
  return n > 0 ? `${n} solicitud(es) de componentes desactivados no se han añadido y siguen pendientes.` : null
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
 *  Las solicitudes que viajan son las de componentes que siguen teniendo línea al confirmar (spec §6): si el usuario quitó
 *  la línea o le cambió el componente, esas solicitudes siguen PENDIENTE. */
export function cuerpoLoteCompras(lineas: LineaCompra[], origen: { urgentes: SolicitudResumen[]; preventivas: SolicitudStock[] } | null): CuerpoLoteCompras {
  const conLinea = new Set(lineas.map((l) => l.idCom))
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
          urgentes: origen.urgentes.filter((s) => conLinea.has(s.idCom)).map((s) => s.idRc),
          preventivas: origen.preventivas.filter((s) => conLinea.has(s.idCom)).map((s) => s.idSol),
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
