import { crearStore } from '@/shared/lib/store'
import type { Periodo } from './filas'

/** Lo que el usuario ha elegido en «Pedidos»: el periodo (y su rango, si es «Rango…»), lo escrito en el buscador y los filtros por
 *  columna. Vive en un store de módulo, como el de «Stock de teléfonos», para que salir y volver lo deje donde estaba;
 *  `reiniciarStores` lo limpia al cerrar sesión. */
export type EstadoPedidos = {
  periodo: Periodo
  /** Las fechas de «Rango…» (`YYYY-MM-DD`); solo valen con `periodo === 'rango'`. */
  rango: { desde: string; hasta: string }
  buscar: string
  plataformas: Set<string>
  skus: Set<string>
  soloSinImei: boolean
  /** Los estados marcados en el filtro de «Enviado» (`PENDIENTE`, `ENVIADA`, `NO_PENDIENTE`); vacío = todos. */
  enviado: Set<string>
}

export const estadoPedidos = crearStore<EstadoPedidos>({
  periodo: 'mes', rango: { desde: '', hasta: '' }, buscar: '', plataformas: new Set(), skus: new Set(), soloSinImei: false, enviado: new Set(),
})
