import type { ColumnDef } from '@tanstack/react-table'
import type { MovilStock } from '@/shared/api/client'
import { clasesUbicacion, textoEstadoMovil } from '@/shared/lib/telefonoNsys'
import { cn } from '@/shared/lib/utils'
import { CLASES_PILDORA } from '@/shared/ui/pildora'
import { muestraColor } from './modelo'

/** Columnas de la tabla de móviles: el SKU partido (color, grado, batería, eSIM) y completo, ubicación, estado y días. El
 *  IMEI es un botón que abre el detalle. */
export function columnasMoviles(abrir: (imeiSn: string) => void): ColumnDef<MovilStock>[] {
  return [
    {
      id: 'imei', header: 'IMEI', size: 150, maxSize: 160,
      cell: ({ row }) => (
        <button type="button" aria-label={`Abrir ${row.original.imeiSn}`} onClick={(e) => { e.stopPropagation(); abrir(row.original.imeiSn) }}
          className="cursor-pointer font-mono text-[11.5px] text-azul-noche hover:underline">{row.original.imeiSn}</button>
      ),
    },
    {
      id: 'color', header: 'Color', size: 100,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-pill-borde" style={{ background: muestraColor(row.original.color) }} />
          {row.original.color ?? '—'}
        </span>
      ),
    },
    {
      id: 'grado', header: 'Grado', size: 70, maxSize: 80,
      cell: ({ row }) => (
        <span className={cn(CLASES_PILDORA, row.original.grado === 'n/a' ? 'bg-fila-solicitud-bg text-fila-solicitud-brd' : 'bg-badge-neutro-bg text-azul-medio')}>
          {row.original.grado}
        </span>
      ),
    },
    { id: 'bateria', header: 'Batería', size: 80, accessorFn: (m) => (m.bateriaNueva ? 'Nueva' : 'Original') },
    { id: 'esim', header: 'eSIM', size: 55, maxSize: 60, accessorFn: (m) => (m.esEsim ? 'Sí' : '') },
    { id: 'sku', header: 'SKU', size: 140, cell: ({ row }) => <span className="font-mono text-[11.5px]">{row.original.sku ?? '—'}</span> },
    {
      id: 'ubicacion', header: 'Ubicación', size: 160,
      cell: ({ row }) => (
        <>
          <span className={cn(CLASES_PILDORA, clasesUbicacion(row.original.ubicacion))}>{row.original.ubicacion ?? '—'}</span>
          {row.original.estado === 'NO_CUENTA' && <span className="ml-1 text-[10px] font-extrabold text-azul-gris">NO CUENTA</span>}
        </>
      ),
    },
    {
      id: 'estado', header: 'Estado', size: 110,
      cell: ({ row }) => row.original.estado === 'DE_PEDIDO'
        ? <span className="font-bold text-fila-urgente-brd">De pedido</span>
        : <span className="text-azul-gris">{textoEstadoMovil(row.original.estado)}</span>,
    },
    { id: 'dias', header: 'Días', size: 55, maxSize: 60, accessorFn: (m) => m.dias ?? '' },
  ]
}
