import { crearStore } from '@/shared/lib/store'
import { FILTROS_VACIOS, type FiltroSku, type Filtros } from './modelo'

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
}

export const estadoStockTelefonos = crearStore<EstadoStock>({
  verNoCuenta: false, textoModelo: '', elegido: null, capacidad: null, filtrosDe: { clave: null, filtros: FILTROS_VACIOS, sku: null },
})

/** La clave de los filtros: el modelo y su pestaña («Todas» = cadena vacía). */
export const claveFiltros = (modelo: string, capacidad: string | null): string => `${modelo}|${capacidad ?? ''}`
