import type { Componente } from '@/shared/api/client'

/** Una fila de Stock: el componente (master o suelto) y, en `miembros`, él mismo seguido de sus slaves en el orden de la
 *  lista. Sin grupo, `miembros = [c]`. */
export type FilaStock = Componente & { miembros: Componente[] }

/** Una fila por grupo de stock compartido: los slaves cuyo master está en la lista pasan a `miembros` de su master; un
 *  slave sin su master en la lista queda como fila suelta. Conserva el orden de `lista`. */
export function agruparCompartidos(lista: Componente[]): FilaStock[] {
  const ids = new Set(lista.map((c) => c.idCom))
  const esSlaveAgrupado = (c: Componente) => c.idComMaster != null && ids.has(c.idComMaster)
  const filas = new Map<number, FilaStock>()
  for (const c of lista) if (!esSlaveAgrupado(c)) filas.set(c.idCom, { ...c, miembros: [c] })
  for (const c of lista) if (esSlaveAgrupado(c)) filas.get(c.idComMaster as number)?.miembros.push(c)
  return lista.filter((c) => !esSlaveAgrupado(c)).map((c) => filas.get(c.idCom) as FilaStock)
}

/** Nombre de la fila: el de todos los miembros, master primero (`cami13 / cami13pro`). */
export function nombreGrupo(f: Pick<FilaStock, 'miembros'>): string {
  return f.miembros.map((m) => m.tipo).join(' / ')
}

export function esGrupo(f: Pick<FilaStock, 'miembros'>): boolean {
  return f.miembros.length > 1
}
