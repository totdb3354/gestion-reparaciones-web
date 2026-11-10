import type { ReactNode } from 'react'

export type DireccionOrden = 'asc' | 'desc' | null

/** El `aria-sort` del `<th>` de una columna ordenable: solo lo lleva la columna por la que se ordena. */
export const ariaOrden = (direccion: DireccionOrden): 'ascending' | 'descending' | undefined =>
  direccion === 'asc' ? 'ascending' : direccion === 'desc' ? 'descending' : undefined

/** El botón de la cabecera de una columna ordenable (0.9.29): el nombre y, si se ordena por ella, ▲ (ascendente) o ▼
 *  (descendente). La flecha no entra en el nombre accesible: el sentido lo dice el `aria-sort` del `<th>`. No sabe de datos:
 *  lo usan `DataTable` y las tablas hechas a mano de «Qué revisar». */
export function CabeceraOrden({ children, direccion, onClick }: { children: ReactNode; direccion: DireccionOrden; onClick: (e: unknown) => void }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer font-bold whitespace-nowrap hover:underline">
      {children}
      {direccion !== null && <span aria-hidden className="ml-1 text-[9px]">{direccion === 'asc' ? '▲' : '▼'}</span>}
    </button>
  )
}
