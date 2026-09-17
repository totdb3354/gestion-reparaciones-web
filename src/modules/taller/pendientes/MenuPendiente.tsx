import type { ReparacionResumen } from '@/shared/api/client'
import { tipoDe } from '@/shared/lib/tipoTrabajo'
import { ContextMenuItem } from '@/shared/ui/context-menu'
import type { CeldaPulsada } from '@/shared/ui/DataTable'
import { MenuCopiarCelda } from '@/shared/ui/MenuCopiarCelda'
import { mostrarMarcarLlegada, opcionDeshacerLlegada, opcionMenuEntrega } from '../lib/entregaGlass'
import { textoCeldaPendiente } from './textoCelda'

export type AccionesPendiente = {
  porCerrar: (rep: ReparacionResumen) => void
  entrega: (rep: ReparacionResumen) => void
  llegada: (rep: ReparacionResumen) => void
  deshacerLlegada: (rep: ReparacionResumen) => void
}

/** Menú contextual de Mis pendientes (calco del setRowFactory de PendientesTecnicoController). */
export function MenuPendiente({ rep, celda, glass, idTec, acciones }: { rep: ReparacionResumen; celda: CeldaPulsada; glass: boolean; idTec: number | null; acciones: AccionesPendiente }) {
  const esRepNormal = !glass && tipoDe(rep.idRep) === 'REPARACION'
  const opEntrega = opcionMenuEntrega(rep, glass, idTec)
  const opDeshacer = opcionDeshacerLlegada(rep, glass, idTec)
  return (
    <>
      <MenuCopiarCelda texto={textoCeldaPendiente(rep, celda.columnaId)} celda={celda} />
      {esRepNormal && <ContextMenuItem onSelect={() => acciones.porCerrar(rep)}>{rep.porCerrar ? 'Quitar por cerrar' : 'Marcar por cerrar'}</ContextMenuItem>}
      {opEntrega && <ContextMenuItem onSelect={() => acciones.entrega(rep)}>{opEntrega}</ContextMenuItem>}
      {mostrarMarcarLlegada(rep, glass) && <ContextMenuItem onSelect={() => acciones.llegada(rep)}>Marcar que llegó</ContextMenuItem>}
      {opDeshacer && <ContextMenuItem onSelect={() => acciones.deshacerLlegada(rep)}>{opDeshacer}</ContextMenuItem>}
    </>
  )
}
