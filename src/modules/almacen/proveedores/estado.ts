import { crearStore } from '@/shared/lib/store'

/** Calco de `seleccionadosProv` (LinkedHashSet de nombres, campo del controller: sobrevive a las recargas) y de la
 *  caché de vista (spec 4a, S2). */
export const filtroProveedores = crearStore<Set<string>>(new Set())
export const seleccionProveedores = crearStore<string | null>(null)
