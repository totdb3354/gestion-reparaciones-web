import type { Componente } from '@/shared/api/client'

/** Alerta de stock: componente master (sin `idComMaster`), activo y con stock <= mínimo (0 con mínimo 0 también). Se calcula
 *  en la web sobre GET /api/componentes/gestionados, como en el cliente de referencia (no se usa /stock-bajo). */
export function esAlerta(c: Componente): boolean {
  return c.idComMaster == null && c.activo && c.stock <= c.stockMinimo
}

export type AlertaStock = { componente: Componente; nivel: 'sinStock' | 'stockBajo' }

/** Primero stock === 0, después stock > 0, cada grupo en el orden recibido (el del servidor, por SKU). Los de stock
 *  negativo cuentan en hayAlertas pero no salen: los grupos son `== 0` y `> 0`, como en la referencia. */
export function alertasOrdenadas(componentes: Componente[]): AlertaStock[] {
  const alertas = componentes.filter(esAlerta)
  return [
    ...alertas.filter((c) => c.stock === 0).map((c): AlertaStock => ({ componente: c, nivel: 'sinStock' })),
    ...alertas.filter((c) => c.stock > 0).map((c): AlertaStock => ({ componente: c, nivel: 'stockBajo' })),
  ]
}

export function hayAlertas(componentes: Componente[]): boolean {
  return componentes.some(esAlerta)
}
