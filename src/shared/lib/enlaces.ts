/** Entrada de la columna lateral (SubNav). Vive en shared desde el sub-proyecto 4a porque la usan taller y almacén, y un
 *  módulo no importa de otro. `end`: NavLink solo activo en la ruta exacta. */
export type Enlace = { to: string; label: string; badge?: 'pendientes' | 'asignaciones'; end?: boolean }
