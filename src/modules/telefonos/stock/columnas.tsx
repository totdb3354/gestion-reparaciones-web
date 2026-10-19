import type { ColumnDef } from '@tanstack/react-table'
import { clasesUbicacion, textoEstadoMovil } from '@/shared/lib/telefonoNsys'
import { cn } from '@/shared/lib/utils'
import { CLASES_PILDORA } from '@/shared/ui/pildora'
import { CeldaQuien } from './CeldaQuien'
import { capacidadDe, muestraColor, textoCapacidad, type Movil } from './modelo'
import { PildoraGrado } from './PildoraGrado'

const MARCA = 'ml-1 inline-block rounded border px-1 align-[1px] text-[10px] font-bold'

/** `conCapacidad`: con la pestaña «Todas», la columna «Cap.» detrás del IMEI (spec §4.3). */
export type OpcionesColumnas = { conCapacidad?: boolean }

/** Columnas de la tabla de móviles (0.9.18, spec §4.6): IMEI · (Cap.) · Color · Grado (con «100» si la batería es nueva y
 *  «eSIM») · SKU · Ubicación (con «NO CUENTA · …» si no cuenta como stock) · Quién lo tiene · Días. El IMEI es un botón
 *  que abre el detalle. */
export function columnasMoviles(abrir: (imeiSn: string) => void, { conCapacidad = false }: OpcionesColumnas = {}): ColumnDef<Movil>[] {
  const imei: ColumnDef<Movil> = {
    id: 'imei', header: 'IMEI', size: 150, maxSize: 160,
    cell: ({ row }) => (
      <button type="button" aria-label={`Abrir ${row.original.imeiSn}`} onClick={(e) => { e.stopPropagation(); abrir(row.original.imeiSn) }}
        className="cursor-pointer font-mono text-[11.5px] text-azul-noche hover:underline">{row.original.imeiSn}</button>
    ),
  }
  const capacidad: ColumnDef<Movil> = { id: 'capacidad', header: 'Cap.', size: 70, maxSize: 80, accessorFn: (m) => textoCapacidad(capacidadDe(m)) }
  return [
    imei,
    ...(conCapacidad ? [capacidad] : []),
    {
      id: 'color', header: 'Color', size: 110,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-pill-borde" style={{ background: muestraColor(row.original.color) }} />
          {row.original.color ?? '—'}
        </span>
      ),
    },
    {
      id: 'grado', header: 'Grado', size: 110, maxSize: 120,
      cell: ({ row }) => (
        <>
          <PildoraGrado grado={row.original.grado} />
          {row.original.bateriaNueva && <span title="Batería nueva" className={cn(MARCA, 'border-fila-recibido-brd text-fila-recibido-brd')}>100</span>}
          {row.original.esEsim && <span className={cn(MARCA, 'border-pill-borde text-azul-gris')}>eSIM</span>}
        </>
      ),
    },
    { id: 'sku', header: 'SKU', size: 150, cell: ({ row }) => <span className="font-mono text-[11.5px]">{row.original.sku ?? '—'}</span> },
    {
      id: 'ubicacion', header: 'Ubicación', size: 190,
      cell: ({ row }) => (
        <>
          <span className={cn(CLASES_PILDORA, clasesUbicacion(row.original.ubicacion))}>{row.original.ubicacion ?? '—'}</span>
          {(row.original.estado === 'NO_CUENTA' || row.original.estado === 'DE_PEDIDO') && (
            <span className={cn(MARCA, 'border-pill-borde text-azul-gris')}>{`NO CUENTA · ${textoEstadoMovil(row.original.estado)}`}</span>
          )}
        </>
      ),
    },
    { id: 'quien', header: 'Quién lo tiene', size: 210, cell: ({ row }) => <CeldaQuien quien={row.original.quien} /> },
    { id: 'dias', header: 'Días', size: 55, maxSize: 60, accessorFn: (m) => m.dias ?? '' },
  ]
}
