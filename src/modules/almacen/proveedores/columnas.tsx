import type { ColumnDef } from '@tanstack/react-table'
import type { Proveedor } from '@/shared/api/client'
import { StatusBadge } from '@/shared/ui/StatusBadge'

/** prefWidth de StockView.fxml :185-188. El badge es exactamente StatusBadge (mismos colores que cpvActivo, §11). */
export function crearColumnasProveedores(): ColumnDef<Proveedor>[] {
  return [
    { accessorKey: 'nombre', header: 'Nombre', size: 200 },
    { accessorKey: 'divisa', header: 'Divisa', size: 60 },
    { id: 'estado', header: 'Estado', size: 90, cell: ({ row }) => <StatusBadge activo={row.original.activo} /> },
    // whitespace-pre-line: el comentario con saltos de línea los respeta y la fila crece, como la celda del JavaFX.
    {
      id: 'comentario', header: 'Comentario', size: 300, accessorFn: (p) => p.comentario ?? '',
      cell: ({ row }) => <span className="whitespace-pre-line">{row.original.comentario ?? ''}</span>,
    },
  ]
}

/** Calco del rowFactory (:1675-1684): activo con barra verde suave; inactivo sin barra y SIN opacidad. */
export function claseFilaProveedor(p: Proveedor): string {
  return p.activo ? 'border-l-8 border-l-fila-reparado-brd' : 'border-l-8 border-l-transparent'
}

/** Calco de exportarProveedores (:2008-2019): ID (no visible), Nombre y Activo Sí/No; sin Divisa ni Comentario. */
export const CABECERAS_CSV_PROVEEDORES = ['ID', 'Nombre', 'Activo']
export function filaCsvProveedor(p: Proveedor): string[] {
  return [String(p.idProv), p.nombre, p.activo ? 'Sí' : 'No']
}
