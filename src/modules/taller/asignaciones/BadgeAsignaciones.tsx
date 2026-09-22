import { BadgeLateral } from '../componentes/BadgeLateral'
import { useTotalAsignaciones } from './api'

/**
 * Badge de "Asignaciones" del supertécnico: calco de lblBadgeAsignaciones = PendientesSuperTecnicoController
 * .getTotalItems(), el tamaño de la tabla unificada SIN filtros (rep + glass + pulido). Los filtros solo cambian el
 * contador de la cabecera (spec 3a §9). El enlace solo lo lleva el supertécnico: el ADMIN no lo ve (§12).
 *
 * `activo` (el enlace es la ruta actual) apaga además su sondeo propio: con la vista abierta el ritmo lo lleva ella,
 * que es quien sabe congelarlo (D4); ver useTotalAsignaciones.
 */
export function BadgeAsignaciones({ activo }: { activo: boolean }) {
  const { data } = useTotalAsignaciones({ sondea: !activo })
  return <BadgeLateral total={data} activo={activo} />
}
