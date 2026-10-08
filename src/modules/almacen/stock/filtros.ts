import type { Componente } from '@/shared/api/client'
import { estadoStock, type EstadoStock } from '@/shared/lib/semaforoStock'
import type { FilaStock } from './grupos'

/** Modo de pedido de una pieza (spec 0.9.6): Auto si está marcada para el pedido automático. */
export type ModoPedido = 'Auto' | 'Manual'
export const MODOS_PEDIDO: ModoPedido[] = ['Auto', 'Manual']

export type FiltrosStock = { estados: Set<EstadoStock>; modos: Set<ModoPedido>; buscador: string }
export const FILTROS_STOCK_VACIOS: FiltrosStock = { estados: new Set(), modos: new Set(), buscador: '' }

/** Null sin marca (TECNICO: el servidor no la envía). */
export function modoPedido(c: Pick<Componente, 'autoPedido'>): ModoPedido | null {
  return c.autoPedido == null ? null : c.autoPedido ? 'Auto' : 'Manual'
}

/** Calco de cargarStock (:477): `sort(comparingInt(activo ? 0 : 1))`, estable, así que dentro de cada grupo queda el
 *  orden del servidor (ORDER BY TIPO). */
export function ordenarStock(lista: Componente[]): Componente[] {
  return [...lista].sort((a, b) => Number(!a.activo) - Number(!b.activo))
}

/** Calco del predicado del FilteredList (:399-417): ninguno marcado = todos; varios = O; el buscador es "contiene" sin
 *  mayúsculas sobre el `tipo` de CUALQUIER miembro del grupo; el estado es el de la fila (el master). El modo (0.9.6)
 *  es otra condición, con Y: Bajo + Auto = las bajas en Auto; sin marca (TECNICO) no filtra. */
export function aplicarFiltrosStock(lista: FilaStock[], f: FiltrosStock): FilaStock[] {
  const texto = f.buscador.trim().toLowerCase()
  return lista.filter((c) => {
    const modo = modoPedido(c)
    return (f.estados.size === 0 || f.estados.has(estadoStock(c)))
      && (f.modos.size === 0 || modo === null || f.modos.has(modo))
      && (texto === '' || c.miembros.some((m) => m.tipo.toLowerCase().includes(texto)))
  })
}

/** Calco de la etiqueta lblDesactivados (:480-484): oculta a cero. */
export function textoDesactivados(n: number): string | null {
  if (n <= 0) return null
  return n === 1 ? '1 desactivado' : `${n} desactivados`
}

/** Llegada a Stock actual desde el enlace Componente de Pedidos (calco de navegarAComponente, StockController :233-246):
 *  desmarca OK, Bajo y Sin stock, conserva "Desactivado" tal como estuviera y vacía el buscador. Devuelve filtros nuevos
 *  (el store no se muta en sitio). */
export function filtrosDesdePedidos(f: FiltrosStock): FiltrosStock {
  return { estados: new Set([...f.estados].filter((e) => e === 'Desactivado')), modos: new Set(), buscador: '' }
}
