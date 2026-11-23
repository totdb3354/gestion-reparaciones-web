import type { ReactNode } from 'react'
import { ArrowDownAZ, ArrowDownZA, ArrowUpDown } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export type DireccionOrden = 'asc' | 'desc' | null

/** El `aria-sort` del `<th>` de una columna ordenable: solo lo lleva la columna por la que se ordena. */
export const ariaOrden = (direccion: DireccionOrden): 'ascending' | 'descending' | undefined =>
  direccion === 'asc' ? 'ascending' : direccion === 'desc' ? 'descending' : undefined

/** Cómo se dice cada sentido cuando no es el alfabético (Pedidos ordena el SKU por modelo). */
export type TextosOrden = { asc: string; desc: string }

/** Lo que hará el próximo clic, en palabras (el `title` del botón). */
export function textoSiguiente(siguiente: DireccionOrden, nombre?: string, textos?: TextosOrden): string {
  const por = nombre ? ` por ${nombre}` : ''
  if (siguiente === 'asc') return `Ordenar${por}: ${textos?.asc ?? 'de la A a la Z (de menor a mayor)'}`
  if (siguiente === 'desc') return `Ordenar${por}: ${textos?.desc ?? 'de la Z a la A (de mayor a menor)'}`
  return 'Quitar el orden (vuelve al de siempre)'
}

/** El botón de la cabecera de una columna ordenable (0.9.28; 0.9.39, spec «ordenar por cabecera»): el nombre y un icono que se ve
 *  SIEMPRE, para que no haya que adivinar que se puede ordenar: ↑↓ gris sin ordenar; «A-Z» (ascendente) o «Z-A» (descendente) en azul
 *  si se ordena por ella. Al pasar el ratón se resalta y el `title` dice qué hará el clic (`siguiente`). El icono no entra en el
 *  nombre accesible: el sentido lo dice el `aria-sort` del `<th>`. No sabe de datos: lo usan `DataTable`, las tablas de «Qué revisar»
 *  y la de Pedidos. */
export function CabeceraOrden({ children, direccion, siguiente, nombre, textos, onClick }: {
  children: ReactNode; direccion: DireccionOrden
  /** El sentido que pondrá el próximo clic (null = quita el orden). */
  siguiente: DireccionOrden
  /** El nombre de la columna para el `title` («Ordenar por SKU…»); sin él, «Ordenar: …». */
  nombre?: string
  /** Los sentidos en palabras si no son «de la A a la Z» / «de la Z a la A». */
  textos?: TextosOrden
  onClick: (e: unknown) => void
}) {
  const Icono = direccion === 'asc' ? ArrowDownAZ : direccion === 'desc' ? ArrowDownZA : ArrowUpDown
  return (
    <button type="button" onClick={onClick} title={textoSiguiente(siguiente, nombre, textos)}
      className={cn('group -mx-1 inline-flex cursor-pointer items-center gap-1 rounded px-1 font-bold whitespace-nowrap hover:bg-[#dbe6fb] focus-visible:outline-2 focus-visible:outline-[#2f6fe0]',
        direccion !== null && 'text-[#1d3a78]')}>
      {children}
      <Icono aria-hidden data-icono-orden={direccion ?? 'ninguno'}
        className={cn('size-3.5 shrink-0', direccion !== null ? 'text-[#2f6fe0]' : 'text-[#8f99a8] group-hover:text-azul-medio')} />
    </button>
  )
}
