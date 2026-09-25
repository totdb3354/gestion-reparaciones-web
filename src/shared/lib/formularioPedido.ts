import type { SolicitudResumen, SolicitudStock } from '@/shared/api/client'
import { crearStore } from './store'

/** Con qué se abre "Nuevo pedido" (spec 4b §6, modos de precarga):
 *  - 'vacio': el botón "Nuevo pedido" de la pestaña, sin líneas.
 *  - 'componentes': "Pedir" de Stock actual o de una alerta (un id) y "Pedir todas las piezas" (un id por alerta, en el
 *    orden de la campana); cantidad 1 por línea.
 *  - 'solicitudes': "Pedir piezas", con las listas PENDIENTE recién leídas; el formulario agrupa por componente. */
export type PrecargaPedido =
  | { modo: 'vacio' }
  | { modo: 'componentes'; idsCom: number[] }
  | { modo: 'solicitudes'; urgentes: SolicitudResumen[]; preventivas: SolicitudStock[] }

export type FormularioPedidoAbierto = { tipo: 'compra'; precarga: PrecargaPedido } | { tipo: 'otro' }

/** Qué formulario de alta está abierto (spec 4b, P1): calco del `Stage` modal del JavaFX, que no saca al usuario de su vista.
 *  Vive en shared porque la campana (taller) y Stock y Pedidos (almacén) lo abren y un módulo no importa de otro. Con
 *  valor, las vistas que sondean congelan el refresco; se cierra al cerrar sesión (reiniciarStores). */
export const formularioPedido = crearStore<FormularioPedidoAbierto | null>(null)

export function abrirNuevoPedido(precarga: PrecargaPedido): void {
  formularioPedido.set({ tipo: 'compra', precarga })
}

export function abrirNuevoOtroPedido(): void {
  formularioPedido.set({ tipo: 'otro' })
}

export function cerrarFormularioPedido(): void {
  formularioPedido.set(null)
}
