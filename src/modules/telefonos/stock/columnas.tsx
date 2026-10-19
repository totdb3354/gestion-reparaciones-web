import type { ColumnDef } from '@tanstack/react-table'
import { clasesUbicacion, textoEstadoMovil } from '@/shared/lib/telefonoNsys'
import { cn } from '@/shared/lib/utils'
import { CLASES_PILDORA } from '@/shared/ui/pildora'
import { CeldaQuien } from './CeldaQuien'
import { capacidadDe, muestraColor, partesSku, textoCapacidad, type FiltroSku, type Movil } from './modelo'
import { PildoraGrado } from './PildoraGrado'

const MARCA = 'ml-1 inline-block rounded border px-1 align-[1px] text-[10px] font-bold'

/** `conCapacidad`: con la pestaña «Todas», la columna «Cap.» detrás del IMEI (spec §4.3). `sku`: el filtro de SKU, cuya
 *  parte buscada se resalta en la columna SKU (§4.2). */
export type OpcionesColumnas = { conCapacidad?: boolean; sku?: FiltroSku | null }

/** Columnas de la tabla de móviles (0.9.18, spec §4.6): IMEI · (Cap.) · Color · Grado (con «100» si la batería es nueva y
 *  «eSIM») · SKU · Ubicación (con «NO CUENTA · …» si no cuenta como stock) · Quién lo tiene · Días. El IMEI es un botón
 *  que abre el detalle. */
export function columnasMoviles(abrir: (imeiSn: string) => void, { conCapacidad = false, sku = null }: OpcionesColumnas = {}): ColumnDef<Movil>[] {
  const imei: ColumnDef<Movil> = {
    id: 'imei', header: 'IMEI', size: 125, maxSize: 160,
    cell: ({ row }) => (
      <button type="button" aria-label={`Abrir ${row.original.imeiSn}`} onClick={(e) => { e.stopPropagation(); abrir(row.original.imeiSn) }}
        className="cursor-pointer font-mono text-[11.5px] text-azul-noche hover:underline">{row.original.imeiSn}</button>
    ),
  }
  const capacidad: ColumnDef<Movil> = { id: 'capacidad', header: 'Cap.', size: 55, maxSize: 80, accessorFn: (m) => textoCapacidad(capacidadDe(m)) }
  return [
    imei,
    ...(conCapacidad ? [capacidad] : []),
    {
      id: 'color', header: 'Color', size: 90,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-pill-borde" style={{ background: muestraColor(row.original.color) }} />
          {row.original.color ?? '—'}
        </span>
      ),
    },
    {
      id: 'grado', header: 'Grado', size: 95, maxSize: 120,
      cell: ({ row }) => (
        <>
          <PildoraGrado grado={row.original.grado} />
          {row.original.bateriaNueva && <span title="Batería nueva" className={cn(MARCA, 'border-fila-recibido-brd text-fila-recibido-brd')}>100</span>}
          {row.original.esEsim && <span className={cn(MARCA, 'border-pill-borde text-azul-gris')}>eSIM</span>}
        </>
      ),
    },
    {
      id: 'sku', header: 'SKU', size: 135,
      cell: ({ row }) => {
        const valor = row.original.sku
        const partes = valor ? partesSku(valor, sku) : null
        return (
          <span className="font-mono text-[11.5px]" title={valor ?? undefined}>
            {partes ? <><mark className="bg-amarillo/60 text-azul-noche">{partes[0]}</mark>{partes[1]}</> : (valor ?? '—')}
          </span>
        )
      },
    },
    {
      id: 'ubicacion', header: 'Ubicación', size: 145,
      cell: ({ row }) => (
        <span className="whitespace-normal">
          <span className={cn(CLASES_PILDORA, clasesUbicacion(row.original.ubicacion))}>{row.original.ubicacion ?? '—'}</span>
          {(row.original.estado === 'NO_CUENTA' || row.original.estado === 'DE_PEDIDO') && (
            <span className={cn(MARCA, 'border-pill-borde text-azul-gris')}>{`NO CUENTA · ${textoEstadoMovil(row.original.estado)}`}</span>
          )}
        </span>
      ),
    },
    { id: 'quien', header: 'Quién lo tiene', size: 160, cell: ({ row }) => <CeldaQuien quien={row.original.quien} /> },
    { id: 'dias', header: 'Días', size: 45, maxSize: 60, accessorFn: (m) => m.dias ?? '' },
  ]
}
