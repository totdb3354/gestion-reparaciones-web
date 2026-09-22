import type { ColumnDef } from '@tanstack/react-table'
import type { ReparacionResumen, Tecnico } from '@/shared/api/client'
import { FMT_FECHA_ASIGNACION, formatear } from '@/shared/lib/fechas'
import { cn } from '@/shared/lib/utils'
import { BadgeTipo } from '@/shared/ui/BadgeTipo'
import { TextoExpandible } from '@/shared/ui/TextoExpandible'
import { BadgesEstadoPendiente } from '../componentes/BadgesEstadoPendiente'
import { BotonPapelera } from '../componentes/BotonPapelera'
import { CeldaImeiPendiente } from '../componentes/CeldaImeiPendiente'
import { traducirModelo } from '../lib/modelos'
import { CeldaTecnicoConectada } from './CeldaTecnicoConectada'
import type { AccionReversible } from './useAccionConDeshacer'

export type OpcionesColumnas = {
  /** ADMIN (spec §12): el desplegable de técnico se muestra como texto plano y la papelera desaparece. */
  soloLectura: boolean
  tecnicos: Tecnico[]
  /** El aviso con "Deshacer" (D2). Es el de la página: uno solo para toda la vista, o habría dos avisos
   *  independientes peleándose por el mismo rincón de la pantalla. */
  ejecutar: (accion: AccionReversible) => void
  /** Aviso de desplegable abierto/cerrado (D4): con uno abierto el sondeo se congela, o la recarga mueve la fila
   *  bajo el cursor. Lo consume la Task 16; debe ser estable entre renders. */
  onInteraccion: (abierto: boolean) => void
  onBorrar: (fila: ReparacionResumen) => void
  /** "Hoy" en Madrid, del render de la página (no de la construcción de las columnas): si se recalculase aquí dentro
   *  se quedaría congelado al abrir la pestaña, y los badges "Llegó HH:mm"/"Llegó dd/MM" no cambiarían a medianoche. */
  hoy: string
  /** IMEI → técnicos distintos con asignación pendiente (`contarTecnicosPorImei`), para la tercera línea "N
   *  asignados" de la celda IMEI. Se calcula en la página sobre la lista completa, no sobre la filtrada. */
  asignadosPorImei: Map<string, number>
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
 * Las once columnas de la tabla unificada de asignaciones (spec §7), en su orden fijo. La página las pinta en el ajuste
 * 'estirar' de DataTable (el CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN del JavaFX reparte el ancho en proporción a
 * los prefWidth), así que `size` es a la vez el mínimo y el peso de cada columna. Parte del prefWidth de cada
 * TableColumn de PendientesSuperTecnicoView.fxml (sin minWidth/maxWidth declarados), con tres ajustes: el Id sube
 * a 120 para que el identificador más largo (AG/AP + fecha + número) se lea entero incluso sin estirar; Comentario y
 * Cliente, el texto libre, pesan más para llevarse el grueso del sobrante; y la papelera lleva `maxSize` igual a su
 * ancho, para no crecer (lo que cede queda en blanco a la derecha, como el hueco del JavaFX en asig-lista).
 * Todas llevan `enableSorting: false` (D5): el orden urgente → con
 * cliente → resto es funcional, y ordenar por otra columna entierra lo urgente sin avisar (el JavaFX apaga el
 * `sortable` de todas por lo mismo).
 */
export function crearColumnas({ soloLectura, tecnicos, ejecutar, onInteraccion, onBorrar, hoy, asignadosPorImei }: OpcionesColumnas): ColumnDef<ReparacionResumen>[] {
  const columnas: ColumnDef<ReparacionResumen>[] = [
    { id: 'id', header: 'Id Asignación', size: 120, accessorKey: 'idRep' },
    { id: 'tipo', header: 'Tipo', size: 90, cell: ({ row }) => <BadgeTipo idRep={row.original.idRep} esChasis={row.original.esChasis} /> },
    {
      id: 'tecnico', header: 'Técnico', size: 110,
      // En solo lectura, el nombre y nada más: el `setText(getNombreTecnico())` del cellFactory del JavaFX cuando
      // `soloLectura`. Nada de la celda de reparador del Historial, que en una glass entregada cuelga además un
      // "Llegó dd/MM HH:mm" que esta columna no tiene (la llegada ya la cuenta el badge de la columna Estado).
      cell: ({ row }) =>
        soloLectura ? (
          <span>{row.original.nombreTecnico}</span>
        ) : (
          <CeldaTecnicoConectada fila={row.original} tecnicos={tecnicos} ejecutar={ejecutar} onInteraccion={onInteraccion} />
        ),
    },
    // `?? 1` es el getOrDefault(imei, 1) del JavaFX: sin entrada en el mapa (IMEI nulo, o fila recién llegada) se
    // cuenta un solo técnico y no hay tercera línea.
    { id: 'imei', header: 'IMEI', size: 130, cell: ({ row }) => <CeldaImeiPendiente rep={row.original} asignados={asignadosPorImei.get(row.original.imei) ?? 1} /> },
    { id: 'modelo', header: 'Modelo', size: 120, accessorFn: (r) => traducirModelo(r.modelo) },
    // Texto plano, sin color propio: el cFecha del JavaFX solo tiene cellValueFactory, así que hereda el color de la
    // fila (y con ella el crema de la seleccionada) y no necesita CREMA_EN_FILA_SELECCIONADA.
    { id: 'fecha', header: 'Fecha asignación', size: 130, accessorFn: (r) => formatear(r.fechaAsig, FMT_FECHA_ASIGNACION) },
    { id: 'comentario', header: 'Comentario', size: 200, cell: ({ row }) => <TextoExpandible titulo="Comentario" texto={row.original.comentarioAsignacion} /> },
    { id: 'cliente', header: 'Cliente', size: 140, accessorFn: (r) => r.cliente ?? '' },
    // '—' sin asignador, calco del cAsignadoPor del JavaFX y de lo que ya pintan el Historial y Pendientes del técnico.
    { id: 'asignadoPor', header: 'Asignado por', size: 120, accessorFn: (r) => r.nombreTecnicoAsigna ?? '—' },
    { id: 'estado', header: 'Estado', size: 100, cell: ({ row }) => <BadgesEstadoPendiente rep={row.original} hoy={hoy} /> },
  ]
  // La papelera no existe para el ADMIN (spec §12): la columna entera desaparece, no queda una celda vacía.
  if (!soloLectura) {
    columnas.push({ id: 'borrar', header: '', size: 45, maxSize: 45, cell: ({ row }) => <BotonPapelera onClick={() => onBorrar(row.original)} /> })
  }
  return columnas.map((c) => ({ ...c, enableSorting: false }))
}
