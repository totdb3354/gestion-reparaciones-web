import type { SortingState } from '@tanstack/react-table'
import { crearStore } from '@/shared/lib/store'
import { FILTROS_VACIOS, type FiltroSku, type Filtros } from './modelo'
import { elegidoPorImei, palabrasClave, TARJETAS_QR, type GrupoBase, type OrdenQR, type TarjetaQR } from './queRevisar'

/** 0.9.25, «Qué revisar»: la tarjeta elegida, el modelo-color elegido en cada tarjeta (su clave; null sin elegir), que sale en el
 *  panel de la derecha (spec §10.14), y lo escrito en la caja de arriba (spec §3.6). */
export type EstadoQueRevisar = {
  tarjeta: TarjetaQR; elegido: Record<TarjetaQR, string | null>; buscar: string
  /** 0.9.29: la columna por la que se ordena la tabla de cada tarjeta; null, el orden de siempre. */
  orden: Record<TarjetaQR, OrdenQR | null>
}

/** Lo que el usuario ha elegido en «Stock de teléfonos»: el modelo y su pestaña de capacidad, los filtros y el SKU de esa pestaña,
 *  el interruptor de lo que no cuenta y el texto del buscador de la columna. Vive en un store de módulo (no en `useState`)
 *  para que «← Volver» desde el detalle de un móvil lo deje todo donde estaba (spec 0.9.18 §4.10); `reiniciarStores` lo
 *  limpia al cerrar sesión. Los filtros llevan la clave de su modelo y su pestaña: si cambian, valen como vacíos. */
export type EstadoStock = {
  verNoCuenta: boolean
  textoModelo: string
  elegido: string | null
  /** La pestaña de capacidad del modelo elegido; null es «Todas». */
  capacidad: string | null
  filtrosDe: { clave: string | null; filtros: Filtros; sku: FiltroSku | null }
  /** 0.9.21: la pestaña de la pantalla, la de los móviles o «Por pasar a NSYS»; desde la 0.9.25, también «Qué revisar». */
  vista: 'moviles' | 'por-pasar' | 'que-revisar'
  /** 0.9.29: la columna por la que se ordena la tabla de móviles (una para la tabla, no por modelo); vacío, el orden de siempre. */
  ordenMoviles: SortingState
  queRevisar: EstadoQueRevisar
}

export const estadoStockTelefonos = crearStore<EstadoStock>({
  verNoCuenta: false, textoModelo: '', elegido: null, capacidad: null, filtrosDe: { clave: null, filtros: FILTROS_VACIOS, sku: null },
  vista: 'moviles', ordenMoviles: [],
  queRevisar: { tarjeta: 'revisar', elegido: { revisar: null, subir: null }, buscar: '', orden: { revisar: null, subir: null } },
})

/** La clave de los filtros: el modelo y su pestaña («Todas» = cadena vacía). */
export const claveFiltros = (modelo: string, capacidad: string | null): string => `${modelo}|${capacidad ?? ''}`

/** Escribir en la caja de «Qué revisar» (spec §3.6 y §10.14). Si las palabras cambian y buscan el IMEI de un móvil de una
 *  tarjeta, se elige su modelo-color en esa tarjeta (el primero de la lista si hay varios); si no, lo elegido sigue como estaba.
 *  Solo al cambiar: así no pisa lo elegido a mano después con la misma búsqueda, ni al volver del detalle del IMEI, y al
 *  borrar la búsqueda el modelo-color del IMEI sigue elegido. */
export function buscarQueRevisar(qr: EstadoQueRevisar, texto: string, listas: Record<TarjetaQR, readonly GrupoBase[]>): EstadoQueRevisar {
  const palabras = palabrasClave(texto)
  if (palabras.join(' ') === palabrasClave(qr.buscar).join(' ')) return { ...qr, buscar: texto }
  const elegido = { ...qr.elegido }
  for (const t of TARJETAS_QR) elegido[t] = elegidoPorImei(listas[t], palabras) ?? elegido[t]
  return { ...qr, elegido, buscar: texto }
}
