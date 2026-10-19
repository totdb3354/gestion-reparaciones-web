import { NavLink } from 'react-router'
import { useSession } from '@/shared/session/SessionProvider'
import { esAdminOSuperTecnico } from '@/shared/session/storage'
import { useEstadoNsys } from './api'

/** Indicador rojo «NSYS sin datos» en la barra superior (0.9.18, spec §4.12): para ADMIN y SUPERTECNICO, en cualquier
 *  página, cuando no llegan datos de NSYS (SIN_DATOS; con RETRASO no sale, para no hacer ruido). Lleva a «Stock de
 *  teléfonos», con la banda roja y la lista de importaciones. En producción no hay correo de avisos: sin esto, si nadie
 *  abre esa página, nadie se entera de que el volcado se ha parado. El TECNICO no pregunta (el servidor le daría 403). */
export function IndicadorNsys() {
  const { sesion } = useSession()
  const permitido = esAdminOSuperTecnico(sesion)
  const { data } = useEstadoNsys(permitido)
  if (!permitido || data?.nivel !== 'SIN_DATOS') return null
  return (
    <NavLink to="/telefonos/stock" className="inline-flex items-center gap-1.5 rounded-full bg-fila-urgente-brd px-3 py-1 text-[12px] font-bold text-superficie hover:opacity-90">
      <span aria-hidden className="h-2 w-2 rounded-full bg-superficie" />
      NSYS sin datos
    </NavLink>
  )
}
