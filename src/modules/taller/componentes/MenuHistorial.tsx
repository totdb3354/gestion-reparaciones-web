import type { ReparacionResumen } from '@/shared/api/client'
import { tipoDe } from '@/shared/lib/tipoTrabajo'
import { ContextMenuItem, ContextMenuSeparator } from '@/shared/ui/context-menu'
import type { CeldaPulsada } from '@/shared/ui/DataTable'
import { MenuCopiarCelda } from '@/shared/ui/MenuCopiarCelda'

export type AccionesHistorial = {
  editar: (rep: ReparacionResumen) => void
  borrar: (rep: ReparacionResumen) => void
  anadirIncidencia: (rep: ReparacionResumen) => void
  cancelarIncidencia: (rep: ReparacionResumen) => void
  corregirCliente: (rep: ReparacionResumen) => void
}

/** Menú contextual del Historial y del detalle de IMEIs: Editar (solo filas R y G; abre el formulario en modo edición,
 *  sin confirmación previa), Borrar, Copiar celda, Añadir incidencia (si no tiene), Cancelar incidencia (si está abierta).
 *  Corregir cliente (filas cerradas, supertécnico y administrador). Sin permisos de edición: Copiar celda y, si puede, Corregir cliente. */
export function MenuHistorial({ rep, celda, texto, puedeEditar, puedeCorregirCliente, acciones }: { rep: ReparacionResumen; celda: CeldaPulsada; texto: string | null; puedeEditar: boolean; puedeCorregirCliente: boolean; acciones: AccionesHistorial }) {
  const corregir = puedeCorregirCliente && !!rep.fechaFin
  if (!puedeEditar) {
    if (!corregir) return <MenuCopiarCelda texto={texto} celda={celda} />
    return (
      <>
        <MenuCopiarCelda texto={texto} celda={celda} />
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => acciones.corregirCliente(rep)}>Corregir cliente</ContextMenuItem>
      </>
    )
  }
  const tipo = tipoDe(rep.idRep)
  const editable = tipo === 'REPARACION' || tipo === 'GLASS'
  const abierta = rep.esIncidencia && !rep.esResuelto
  return (
    <>
      {editable && <ContextMenuItem onSelect={() => acciones.editar(rep)}>Editar</ContextMenuItem>}
      <ContextMenuItem onSelect={() => acciones.borrar(rep)}>Borrar</ContextMenuItem>
      {corregir && <ContextMenuItem onSelect={() => acciones.corregirCliente(rep)}>Corregir cliente</ContextMenuItem>}
      <ContextMenuSeparator />
      <MenuCopiarCelda texto={texto} celda={celda} />
      {(!rep.esIncidencia || abierta) && <ContextMenuSeparator />}
      {!rep.esIncidencia && <ContextMenuItem onSelect={() => acciones.anadirIncidencia(rep)}>Añadir incidencia</ContextMenuItem>}
      {abierta && <ContextMenuItem onSelect={() => acciones.cancelarIncidencia(rep)}>Cancelar incidencia</ContextMenuItem>}
    </>
  )
}
