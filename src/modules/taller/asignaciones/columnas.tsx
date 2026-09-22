import type { ColumnDef } from '@tanstack/react-table'
import type { ReparacionResumen, Tecnico } from '@/shared/api/client'
import { FMT_FECHA_ASIGNACION, formatear } from '@/shared/lib/fechas'
import { cn } from '@/shared/lib/utils'
import { BadgeTipo } from '@/shared/ui/BadgeTipo'
import { TextoExpandible } from '@/shared/ui/TextoExpandible'
import { BadgesEstadoPendiente } from '../componentes/BadgesEstadoPendiente'
import { BotonPapelera } from '../componentes/BotonPapelera'
import { CeldaImeiPendiente } from '../componentes/CeldaImeiPendiente'
import { CeldaReparador } from '../componentes/CeldaReparador'
import { CeldaTecnico } from '../componentes/CeldaTecnico'
import { traducirModelo } from '../lib/modelos'

export type OpcionesColumnas = {
  /** ADMIN (spec §12): el desplegable de técnico se muestra como texto plano y la papelera desaparece. */
  soloLectura: boolean
  tecnicos: Tecnico[]
  onReasignar: (idRep: string, idTec: number) => void
  onBorrar: (fila: ReparacionResumen) => void
  /** "Hoy" en Madrid, del render de la página (no de la construcción de las columnas): si se recalculase aquí dentro
   *  se quedaría congelado al abrir la pestaña, y los badges "Llegó HH:mm"/"Llegó dd/MM" no cambiarían a medianoche. */
  hoy: string
}

/**
 * La franja de 8 px del borde izquierdo de la fila (spec §7): ámbar con solicitud de pieza, roja en incidencia,
 * transparente si no. Es la misma pareja de tokens y el mismo mecanismo que en Pendientes del técnico: va por
 * `filaClase` de DataTable, no por una columna, porque el `<tr>` seleccionado la apaga
 * (`data-[state=selected]:border-l-transparent`, calco de aplicarEstilo del JavaFX).
 */
export function claseFilaAsignacion(fila: ReparacionResumen): string {
  return cn('border-l-8', fila.esSolicitud > 0 ? 'border-l-fila-solicitud-brd' : fila.esIncidencia ? 'border-l-fila-incidencia-brd' : 'border-l-transparent')
}

/**
 * Las once columnas de la tabla unificada de asignaciones (spec §7), en su orden fijo. `size` es el prefWidth de cada
 * TableColumn de PendientesSuperTecnicoView.fxml. Todas llevan `enableSorting: false` (D5): el orden urgente → con
 * cliente → resto es funcional, y ordenar por otra columna entierra lo urgente sin avisar (el JavaFX apaga el
 * `sortable` de todas por lo mismo).
 */
export function crearColumnas({ soloLectura, tecnicos, onReasignar, onBorrar, hoy }: OpcionesColumnas): ColumnDef<ReparacionResumen>[] {
  const columnas: ColumnDef<ReparacionResumen>[] = [
    { id: 'id', header: 'Id Asignación', size: 90, accessorKey: 'idRep' },
    { id: 'tipo', header: 'Tipo', size: 90, cell: ({ row }) => <BadgeTipo idRep={row.original.idRep} esChasis={row.original.esChasis} /> },
    {
      id: 'tecnico', header: 'Técnico', size: 110,
      cell: ({ row }) =>
        soloLectura ? <CeldaReparador rep={row.original} /> : <CeldaTecnico fila={row.original} tecnicos={tecnicos} onReasignar={onReasignar} />,
    },
    { id: 'imei', header: 'IMEI', size: 130, cell: ({ row }) => <CeldaImeiPendiente rep={row.original} /> },
    { id: 'modelo', header: 'Modelo', size: 120, accessorFn: (r) => traducirModelo(r.modelo) },
    // Texto plano, sin color propio: el cFecha del JavaFX solo tiene cellValueFactory, así que hereda el color de la
    // fila (y con ella el crema de la seleccionada) y no necesita CREMA_EN_FILA_SELECCIONADA.
    { id: 'fecha', header: 'Fecha asignación', size: 130, accessorFn: (r) => formatear(r.fechaAsig, FMT_FECHA_ASIGNACION) },
    { id: 'comentario', header: 'Comentario', size: 160, cell: ({ row }) => <TextoExpandible titulo="Comentario" texto={row.original.comentarioAsignacion} /> },
    { id: 'cliente', header: 'Cliente', size: 110, accessorFn: (r) => r.cliente ?? '' },
    // '—' sin asignador, calco del cAsignadoPor del JavaFX y de lo que ya pintan el Historial y Pendientes del técnico.
    { id: 'asignadoPor', header: 'Asignado por', size: 120, accessorFn: (r) => r.nombreTecnicoAsigna ?? '—' },
    { id: 'estado', header: 'Estado', size: 100, cell: ({ row }) => <BadgesEstadoPendiente rep={row.original} hoy={hoy} /> },
  ]
  // La papelera no existe para el ADMIN (spec §12): la columna entera desaparece, no queda una celda vacía.
  if (!soloLectura) {
    columnas.push({ id: 'borrar', header: '', size: 45, cell: ({ row }) => <BotonPapelera onClick={() => onBorrar(row.original)} /> })
  }
  return columnas.map((c) => ({ ...c, enableSorting: false }))
}
