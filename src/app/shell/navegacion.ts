import { ChartColumn, ScrollText, UserCog, Users } from 'lucide-react'
import { enlacesStock } from '@/modules/almacen/rutas'
import { enlacesReparaciones } from '@/modules/taller/rutas'
import { enlacesTelefonos } from '@/modules/telefonos/rutas'
import type { GrupoNav } from '@/shared/lib/enlaces'
import { esAdmin, type Sesion } from '@/shared/session/storage'

/**
 * Grupos de la columna lateral (0.9.14, spec «Navegación por grupos» §2), en este orden: Reparaciones (sus pestañas
 * dependen del rol), Stock (desde la 0.9.16 también: el técnico solo tiene «Stock actual»), Teléfonos (0.9.17: solo SUPERTECNICO y ADMIN), Estadísticas, Clientes y, solo
 * para el admin, Gestión. Las pestañas no repiten el nombre del grupo (Estadísticas › Rendimiento, Clientes › Listado).
 */
export function gruposNav(sesion: Sesion | null): GrupoNav[] {
  const grupos: GrupoNav[] = [
    { id: 'reparaciones', titulo: 'Reparaciones', enlaces: enlacesReparaciones(sesion) },
    { id: 'stock', titulo: 'Stock', enlaces: enlacesStock(sesion) },
    { id: 'estadisticas', titulo: 'Estadísticas', enlaces: [{ to: '/estadisticas', label: 'Rendimiento', icono: ChartColumn }] },
    { id: 'clientes', titulo: 'Clientes', enlaces: [{ to: '/clientes', label: 'Listado', icono: Users }] },
  ]
  const telefonos = enlacesTelefonos(sesion)
  if (telefonos.length > 0) grupos.splice(2, 0, { id: 'telefonos', titulo: 'Teléfonos', enlaces: telefonos })
  if (esAdmin(sesion)) {
    grupos.push({
      id: 'gestion',
      titulo: 'Gestión',
      enlaces: [
        { to: '/gestion/tecnicos', label: 'Técnicos', icono: UserCog },
        { to: '/gestion/logs', label: 'Logs', icono: ScrollText },
      ],
    })
  }
  return grupos
}
