import type { ColumnDef } from '@tanstack/react-table'
import type { LogActividad } from '@/shared/api/client'
import { FMT_FECHA_LOG, formatear } from '@/shared/lib/fechas'

/** Columnas de `tablaLogs` (LogView.fxml :48-59) con sus prefWidth (150/80/180/400). La página las pinta con el ajuste
 *  'estirar' de DataTable, como las otras tablas con CONSTRAINED_RESIZE_POLICY (Asignaciones, Historial): `size` es el
 *  mínimo y el peso, y Detalle, la más ancha, se lleva el grueso del sobrante. Sin ordenación por cabecera (G10): la
 *  página no la activa y el orden es el del servidor (fecha desc, id desc). */
export const COLUMNAS_LOGS: ColumnDef<LogActividad>[] = [
  { id: 'fecha', header: 'Fecha', size: 150, accessorFn: (l) => formatear(l.fecha, FMT_FECHA_LOG) },
  { id: 'usuario', header: 'Usuario', size: 80, accessorFn: (l) => l.nombreUsuario },
  { id: 'accion', header: 'Acción', size: 180, accessorFn: (l) => l.accion },
  {
    id: 'detalle', header: 'Detalle', size: 400, accessorFn: (l) => l.detalle ?? '',
    // Una línea con elipsis, como la celda de texto del TableView; el texto entero sale con doble clic.
    cell: ({ row }) => <span className="block truncate">{row.original.detalle ?? ''}</span>,
  },
]

/** Texto del popup "Detalle del log" (LogController :96-100): detalle (o "") y, si el motivo no está en blanco,
 *  "\n\nMOTIVO: " + motivo. */
export function textoDetalle(log: LogActividad): string {
  const texto = log.detalle ?? ''
  return log.motivo != null && log.motivo.trim() !== '' ? `${texto}\n\nMOTIVO: ${log.motivo}` : texto
}
