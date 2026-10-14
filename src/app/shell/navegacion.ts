import { ChartColumn, ScrollText, UserCog, Users } from 'lucide-react'
import { enlacesStock } from '@/modules/almacen/rutas'
import { enlacesReparaciones } from '@/modules/taller/rutas'
import type { GrupoNav } from '@/shared/lib/enlaces'
import { esAdmin, type Sesion } from '@/shared/session/storage'

/**
 * Grupos de la columna lateral (0.9.12, spec «Navegación por grupos» §2), en este orden: Reparaciones (sus pestañas
 * dependen del rol), Stock, Estadísticas, Clientes y, solo para el admin, Gestión. Las pestañas no repiten el nombre del
 * grupo (Estadísticas › Rendimiento, Clientes › Listado). Los enlaces de Gestión llevan `volverA` = la ruta actual para el
 * «Cerrar» de Técnicos y de Logs, como hacía el menú de usuario.
 */
export function gruposNav(sesion: Sesion | null, pathname: string): GrupoNav[] {
  const grupos: GrupoNav[] = [
    { id: 'reparaciones', titulo: 'Reparaciones', enlaces: enlacesReparaciones(sesion) },
    { id: 'stock', titulo: 'Stock', enlaces: enlacesStock() },
    { id: 'estadisticas', titulo: 'Estadísticas', enlaces: [{ to: '/estadisticas', label: 'Rendimiento', icono: ChartColumn }] },
    { id: 'clientes', titulo: 'Clientes', enlaces: [{ to: '/clientes', label: 'Listado', icono: Users }] },
  ]
  if (esAdmin(sesion)) {
    const state = { volverA: pathname }
    grupos.push({
      id: 'gestion',
      titulo: 'Gestión',
      enlaces: [
        { to: '/gestion/tecnicos', label: 'Técnicos', icono: UserCog, state },
        { to: '/gestion/logs', label: 'Logs', icono: ScrollText, state },
      ],
    })
  }
  return grupos
}
