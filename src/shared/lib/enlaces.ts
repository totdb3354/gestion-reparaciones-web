import type { LucideIcon } from 'lucide-react'

/** Entrada de la columna lateral (SubNav). Vive en shared desde el sub-proyecto 4a porque la usan taller y almacén, y un
 *  módulo no importa de otro. `end`: NavLink solo activo en la ruta exacta. `icono` (0.9.10): va delante del nombre y es
 *  lo único que se ve con la columna plegada. */
export type Enlace = { to: string; label: string; icono: LucideIcon; badge?: 'pendientes' | 'asignaciones'; end?: boolean }
