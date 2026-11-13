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
  /** Las tiendas marcadas en el filtro de Plataforma (el `canal` del ERP, u `OTROS`); vacío = todas. */
  plataformas: Set<string>
  skus: Set<string>
  soloSinImei: boolean
  /** Solo las filas con el IMEI en naranja (nivel MAL). */
  noCuadran: boolean
  /** Los estados marcados en el filtro de «Enviado» (`PENDIENTE`, `GENERADA`, `ENVIADO`, `NO_PENDIENTE`, `HISTORICO`); vacío = todos. */
  enviado: Set<string>
  /** «La fila en la que estás»: la última que se tocó, abriendo su celda de IMEI (se guarde o no) o su detalle. Lleva el fondo azul suave y la raya azul. Solo en memoria. */
  filaAqui: number | null
  /** La fila cuyo detalle enseña el panel de la derecha (por `idFila`: sobrevive a filtrar). Solo en memoria. */
  filaElegida: number | null
  /** Los guardados de IMEI que han fallado, por `idFila`: la celda sigue en rojo hasta que se guarde bien (o se recargue la página). Guarda lo que se
   *  intentó y la clave de idempotencia, para que reabrir la celda y reintentar mande la MISMA petición. Solo en memoria. */
  fallosImei: Record<number, FalloImei>
  /** El aviso no modal de arriba de la tabla («No se guardó el IMEI del pedido X…»), hasta que se cierre. */
  avisoImei: string | null
}

export type FalloImei = { imei: string | null; clave: string; mensaje: string }

export const estadoPedidos = crearStore<EstadoPedidos>({
  periodo: 'mes', rango: { desde: '', hasta: '' }, buscar: '', plataformas: new Set(), skus: new Set(), soloSinImei: false, noCuadran: false, enviado: new Set(), filaAqui: null, filaElegida: null, fallosImei: {}, avisoImei: null,
})
