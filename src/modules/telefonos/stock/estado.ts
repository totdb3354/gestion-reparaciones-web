import { crearStore } from '@/shared/lib/store'
import { FILTROS_VACIOS, type Filtros } from './modelo'

/** Lo que el usuario ha elegido en «Stock de teléfonos»: el modelo, los filtros de ese modelo, el interruptor de lo que no
 *  cuenta y la búsqueda de modelo. Vive en un store de módulo (no en `useState`) para que al volver desde el detalle de un
 *  móvil siga todo donde estaba; `reiniciarStores` lo limpia al cerrar sesión. Los filtros llevan la clave del modelo al que
 *  pertenecen: si el modelo efectivo cambia, valen como vacíos. */
export type EstadoStock = {
  verNoCuenta: boolean
  textoModelo: string
  elegido: string | null
  filtrosDe: { clave: string | null; filtros: Filtros }
}

export const estadoStockTelefonos = crearStore<EstadoStock>({
  verNoCuenta: false, textoModelo: '', elegido: null, filtrosDe: { clave: null, filtros: FILTROS_VACIOS },
})
