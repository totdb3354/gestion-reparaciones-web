import type { Componente } from '@/shared/api/client'
import { estadoStock, type EstadoStock } from '@/shared/lib/semaforoStock'

export type FiltrosStock = { estados: Set<EstadoStock>; buscador: string }
export const FILTROS_STOCK_VACIOS: FiltrosStock = { estados: new Set(), buscador: '' }

/** Calco de cargarStock (:477): `sort(comparingInt(activo ? 0 : 1))`, estable, así que dentro de cada grupo queda el
 *  orden del servidor (ORDER BY TIPO). */
export function ordenarStock(lista: Componente[]): Componente[] {
  return [...lista].sort((a, b) => Number(!a.activo) - Number(!b.activo))
}

/** Calco del predicado del FilteredList (:399-417): ninguno marcado = todos; varios = O; el buscador es "contiene" sin
 *  mayúsculas sobre `tipo` (sin el sufijo "(compartido)", que es de presentación). */
export function aplicarFiltrosStock(lista: Componente[], f: FiltrosStock): Componente[] {
  const texto = f.buscador.trim().toLowerCase()
  return lista.filter((c) => (f.estados.size === 0 || f.estados.has(estadoStock(c))) && (texto === '' || c.tipo.toLowerCase().includes(texto)))
}

/** Calco de la etiqueta lblDesactivados (:480-484): oculta a cero. */
export function textoDesactivados(n: number): string | null {
  if (n <= 0) return null
  return n === 1 ? '1 desactivado' : `${n} desactivados`
}

/** Calco de la columna Componente (:298-302): dos espacios antes del paréntesis. */
export function nombreComponente(c: Pick<Componente, 'tipo' | 'idComMaster'>): string {
  return c.idComMaster != null ? `${c.tipo}  (compartido)` : c.tipo
}

/** Llegada a Stock actual desde el enlace Componente de Pedidos (calco de navegarAComponente, StockController :233-246):
 *  desmarca OK, Bajo y Sin stock, conserva "Desactivado" tal como estuviera y vacía el buscador. Devuelve filtros nuevos
 *  (el store no se muta en sitio). */
export function filtrosDesdePedidos(f: FiltrosStock): FiltrosStock {
  return { estados: new Set([...f.estados].filter((e) => e === 'Desactivado')), buscador: '' }
}
