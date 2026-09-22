import type { ColumnDef } from '@tanstack/react-table'
import type { ReparacionResumen, Tecnico } from '@/shared/api/client'
import { formatear, hoyMadrid, type Patron } from '@/shared/lib/fechas'
import { cn } from '@/shared/lib/utils'
import { BadgeTipo } from '@/shared/ui/BadgeTipo'
import { ComboNavy } from '@/shared/ui/ComboNavy'
import { TextoExpandible } from '@/shared/ui/TextoExpandible'
import { BadgesEstadoPendiente } from '../componentes/BadgesEstadoPendiente'
import { BotonPapelera } from '../componentes/BotonPapelera'
import { CeldaImeiPendiente } from '../componentes/CeldaImeiPendiente'
import { CeldaReparador } from '../componentes/CeldaReparador'
import { traducirModelo } from '../lib/modelos'

/** Patrón de la columna "Fecha asignación" (calco de la celda del cliente y de "Copiar celda", contrato §6). */
const FMT_FECHA: Patron = 'yyyy/MM/dd HH:mm'
/** Ancho del desplegable dentro de la celda Técnico (prefWidth 110 del FXML menos el padding de la celda). */
const ANCHO_COMBO = 96
/** visibleRowCount del ComboBox de la celda Técnico. */
const FILAS_COMBO = 8

export type OpcionesColumnas = {
  /** ADMIN (spec §12): el desplegable de técnico se muestra como texto plano y la papelera desaparece. */
  soloLectura: boolean
  tecnicos: Tecnico[]
  onReasignar: (idRep: string, idTec: number) => void
  onBorrar: (fila: ReparacionResumen) => void
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
 * Celda Técnico: el desplegable dentro de la celda del cTecnico del JavaFX (combo de 8 filas, 11 px, que reasigna al
 * elegir y no hace nada si se elige el que ya estaba). Aquí solo se avisa por `onReasignar`: quién escribe, el aviso
 * con "Deshacer" (D2) y la congelación del sondeo mientras está abierto (D4) los cablea la página.
 */
function CeldaTecnico({ fila, tecnicos, onReasignar }: { fila: ReparacionResumen; tecnicos: Tecnico[]; onReasignar: (idRep: string, idTec: number) => void }) {
  return (
    <ComboNavy
      valor={String(fila.idTec)}
      opciones={tecnicos.map((t) => ({ valor: String(t.idTec), etiqueta: t.nombre }))}
      onChange={(valor) => onReasignar(fila.idRep, Number(valor))}
      textoVacio={fila.nombreTecnico ?? ''}
      ancho={ANCHO_COMBO}
      tamanoTexto={11}
      visibles={FILAS_COMBO}
      aria-label={`Técnico de ${fila.idRep}`}
    />
  )
}

/**
 * Las once columnas de la tabla unificada de asignaciones (spec §7), en su orden fijo. `size` es el prefWidth de cada
 * TableColumn de PendientesSuperTecnicoView.fxml. Todas llevan `enableSorting: false` (D5): el orden urgente → con
 * cliente → resto es funcional, y ordenar por otra columna entierra lo urgente sin avisar (el JavaFX apaga el
 * `sortable` de todas por lo mismo).
 */
export function crearColumnas({ soloLectura, tecnicos, onReasignar, onBorrar }: OpcionesColumnas): ColumnDef<ReparacionResumen>[] {
  // Un único "hoy" para todos los badges de entrega de la tabla, como hace la página de Pendientes.
  const hoy = hoyMadrid()
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
    { id: 'fecha', header: 'Fecha asignación', size: 130, accessorFn: (r) => formatear(r.fechaAsig, FMT_FECHA) },
    { id: 'comentario', header: 'Comentario', size: 160, cell: ({ row }) => <TextoExpandible titulo="Comentario" texto={row.original.comentarioAsignacion} /> },
    { id: 'cliente', header: 'Cliente', size: 110, accessorFn: (r) => r.cliente ?? '' },
    { id: 'asignadoPor', header: 'Asignado por', size: 120, accessorFn: (r) => r.nombreTecnicoAsigna ?? '' },
    { id: 'estado', header: 'Estado', size: 100, cell: ({ row }) => <BadgesEstadoPendiente rep={row.original} hoy={hoy} /> },
  ]
  // La papelera no existe para el ADMIN (spec §12): la columna entera desaparece, no queda una celda vacía.
  if (!soloLectura) {
    columnas.push({ id: 'borrar', header: '', size: 45, cell: ({ row }) => <BotonPapelera onClick={() => onBorrar(row.original)} /> })
  }
  return columnas.map((c) => ({ ...c, enableSorting: false }))
}
