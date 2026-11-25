import { crearStore } from '@/shared/lib/store'
import type { OrdenSku, Periodo } from './filas'
import type { NoValido } from './noValidos'

/** Lo que el usuario ha elegido en «Pedidos»: el periodo (y su rango, si es «Rango…»), lo escrito en el buscador y los filtros por
 *  columna. Vive en un store de módulo, como el de «Stock de teléfonos», para que salir y volver lo deje donde estaba;
 *  `reiniciarStores` lo limpia al cerrar sesión. */
export type EstadoPedidos = {
  periodo: Periodo
  /** Las fechas de «Rango…» (`YYYY-MM-DD`); solo valen con `periodo === 'rango'`. */
  rango: { desde: string; hasta: string }
  /** 0.9.38: la tabla enseña los pendientes de fuera del periodo (el «Ver» del aviso) en vez de las filas del periodo. Se quita al
   *  cambiar el periodo o el rango, con su etiqueta o con «Quitar filtros». */
  verFuera: boolean
  /** 0.9.39: el orden de la columna SKU (clic en su cabecera); null = el de siempre (por fecha). No lo quita «Quitar filtros». */
  ordenSku: OrdenSku
  buscar: string
  /** Las tiendas marcadas en el filtro de Plataforma (el `canal` del ERP, u `OTROS`); vacío = todas. */
  plataformas: Set<string>
  skus: Set<string>
  soloSinImei: boolean
  /** Solo las filas con el IMEI en naranja (nivel MAL). */
  noCuadran: boolean
  /** Solo las filas sin IMEI con un teléfono reservado. */
  soloReservadas: boolean
  /** Solo las filas sin IMEI, sin reserva y sin marca (ningún teléfono cumplió los criterios). */
  soloSinStock: boolean
  /** Los estados marcados en el filtro de «Enviado» (`PENDIENTE`, `GENERADA`, `ENVIADO`, `NO_PENDIENTE`, `HISTORICO`); vacío = todos. */
  enviado: Set<string>
  /** Las marcas elegidas en «Con marca» (del filtro de IMEI); vacío = todas las filas. */
  marcas: Set<string>
  /** Solo las filas de Amazon sin asociar (el «Sin asociar» del filtro de IMEI). */
  sinAsociar: boolean
  /** «La fila en la que estás»: la última que se tocó, abriendo su celda de IMEI (se guarde o no) o su detalle. Lleva el fondo azul suave y la raya azul. Solo en memoria. */
  filaAqui: number | null
  /** La fila cuyo detalle enseña el panel de la derecha (por `idFila`: sobrevive a filtrar). Solo en memoria. */
  filaElegida: number | null
  /** Los guardados de IMEI que han fallado, por `idFila`: la celda sigue en rojo hasta que se guarde bien (o se recargue la página). Guarda lo que se
   *  intentó y la clave de idempotencia, para que reabrir la celda y reintentar mande la MISMA petición. Solo en memoria. */
  fallosImei: Record<number, FalloImei>
  /** Lecturas que no eran un IMEI válido (cifra de control mala o más de 15 cifras), por `idFila`: no se guardaron y la celda sigue en
   *  rojo hasta poner un IMEI en esa fila. Copia en localStorage por usuario (24 h): ver `noValidos.ts`. */
  noValidos: Record<number, NoValido>
  /** El aviso no modal de la barra del buscador («No se guardó el IMEI del pedido X…»), hasta que se cierre. */
  avisoImei: string | null
}

/** `duplicado`: el servidor rechazó el IMEI porque ya está en otro pedido (409 «Este IMEI ya está…»); `mensaje` es su texto tal cual
 *  y la celda no ofrece reintentar (el mismo IMEI volvería a fallar). */
export type FalloImei = { imei: string | null; clave: string; mensaje: string; duplicado?: boolean }

export const estadoPedidos = crearStore<EstadoPedidos>({
  periodo: 'mes', rango: { desde: '', hasta: '' }, verFuera: false, ordenSku: null, buscar: '', plataformas: new Set(), skus: new Set(), soloSinImei: false, noCuadran: false, soloReservadas: false, soloSinStock: false, enviado: new Set(), marcas: new Set(), sinAsociar: false, filaAqui: null, filaElegida: null, fallosImei: {}, noValidos: {}, avisoImei: null,
})
