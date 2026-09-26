import type { ColumnDef } from '@tanstack/react-table'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- listas mixtas de columnas, como en DataTable
type Columna = ColumnDef<any, any>

const idDe = (c: Columna) => c.id ?? ('accessorKey' in c ? String(c.accessorKey) : '')

/** Reparto de las columnas en el ajuste 'fluido' de DataTable: fijas las que declaran `maxSize === size`, y las que
 *  absorben el ancho sobrante las que no declaran `maxSize`. `otras` recoge cualquier columna con un tope distinto de su
 *  `size` (ninguna tabla lo usa hoy). Los ids salen de `id` o, si no lo hay, de `accessorKey`. */
export function repartoFluido(columnas: Columna[]) {
  return {
    fijas: columnas.filter((c) => c.maxSize !== undefined && c.maxSize === c.size).map(idDe),
    absorben: columnas.filter((c) => c.maxSize === undefined).map(idDe),
    otras: columnas.filter((c) => c.maxSize !== undefined && c.maxSize !== c.size).map(idDe),
  }
}
