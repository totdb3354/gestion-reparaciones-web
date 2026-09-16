import type { ReparacionResumen } from '@/shared/api/client'
import { tipoDe } from '@/shared/lib/tipoTrabajo'
import { ContextMenuItem, ContextMenuSeparator } from '@/shared/ui/context-menu'
import type { CeldaPulsada } from '@/shared/ui/DataTable'
import { MenuCopiarCelda } from '@/shared/ui/MenuCopiarCelda'
import { TOOLTIP_FORMULARIO } from '../lib/textos'

export type AccionesHistorial = {
  borrar: (rep: ReparacionResumen) => void
  anadirIncidencia: (rep: ReparacionResumen) => void
  cancelarIncidencia: (rep: ReparacionResumen) => void
}

/** Menú contextual del Historial y del detalle de IMEIs: Editar (R/G, deshabilitado hasta el SP2), Borrar, Copiar celda,
 *  Añadir incidencia (si no tiene), Cancelar incidencia (si está abierta). Sin permisos de edición: solo Copiar celda. */
export function MenuHistorial({ rep, celda, texto, puedeEditar, acciones }: { rep: ReparacionResumen; celda: CeldaPulsada; texto: string | null; puedeEditar: boolean; acciones: AccionesHistorial }) {
  if (!puedeEditar) return <MenuCopiarCelda texto={texto} celda={celda} />
  const tipo = tipoDe(rep.idRep)
  const editable = tipo === 'REPARACION' || tipo === 'GLASS'
  const abierta = rep.esIncidencia && !rep.esResuelto
  return (
    <>
      {editable && (
        // El title va en un envoltorio de bloque: el ítem deshabilitado lleva data-[disabled]:pointer-events-none y nunca
        // recibiría el hover que muestra el tooltip (mismo patrón que "Añadir reparación" en PendientesPage). Es un <div>
        // porque el ítem también lo es: un <span> no puede contener un bloque.
        <div title={TOOLTIP_FORMULARIO}>
          <ContextMenuItem disabled>Editar</ContextMenuItem>
        </div>
      )}
      <ContextMenuItem onSelect={() => acciones.borrar(rep)}>Borrar</ContextMenuItem>
      <ContextMenuSeparator />
      <MenuCopiarCelda texto={texto} celda={celda} />
      {(!rep.esIncidencia || abierta) && <ContextMenuSeparator />}
      {!rep.esIncidencia && <ContextMenuItem onSelect={() => acciones.anadirIncidencia(rep)}>Añadir incidencia</ContextMenuItem>}
      {abierta && <ContextMenuItem onSelect={() => acciones.cancelarIncidencia(rep)}>Cancelar incidencia</ContextMenuItem>}
    </>
  )
}
