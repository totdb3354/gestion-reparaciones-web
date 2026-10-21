import type { ColumnDef } from '@tanstack/react-table'
import { clasesUbicacion, SIN_SKU_MAESTRO, textoEstadoMovil } from '@/shared/lib/telefonoNsys'
import { cn } from '@/shared/lib/utils'
import { MarcaTaller } from '@/shared/ui/MarcaTaller'
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
 *  que abre el detalle. Desde la 0.9.21 (spec «SKU del taller» §2.4), color, grado y SKU son los que valen: si el taller los
 *  cambia, llevan la marca «taller» y, debajo, lo de NSYS. */
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
      // En línea (no flex), para que la celda corte con «…» un color largo a 1366; el nombre entero, al pasar el ratón.
      id: 'color', header: 'Color', size: 90,
      cell: ({ row }) => (
        <MarcaTaller nsys={row.original.colorNsys}>
          <span title={row.original.color ?? undefined}>
            <span aria-hidden className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full border border-pill-borde align-[-1px]" style={{ background: muestraColor(row.original.color) }} />
            {row.original.color ?? '—'}
          </span>
        </MarcaTaller>
      ),
    },
    {
      // Si no caben las marcas, la celda las corta con «…»: al pasar el ratón se leen todas.
      id: 'grado', header: 'Grado', size: 95, maxSize: 120,
      cell: ({ row }) => (
        <MarcaTaller nsys={row.original.gradoNsys}>
          <span title={[row.original.grado ?? '—', row.original.bateriaNueva && 'batería nueva', row.original.esEsim && 'eSIM'].filter(Boolean).join(' · ')}>
            <PildoraGrado grado={row.original.grado} />
            {row.original.bateriaNueva && <span title="Batería nueva" className={cn(MARCA, 'border-fila-recibido-brd text-fila-recibido-brd')}>100</span>}
            {row.original.esEsim && <span className={cn(MARCA, 'border-pill-borde text-azul-gris')}>eSIM</span>}
          </span>
        </MarcaTaller>
      ),
    },
    {
      id: 'sku', header: 'SKU', size: 135,
      cell: ({ row }) => {
        const valor = row.original.sku
        const partes = valor ? partesSku(valor, sku) : null
        // Sin SKU por un cambio del taller (el maestro no lo da): «sin SKU en el maestro»; sin SKU de NSYS, la raya de siempre.
        const vacio = row.original.skuNsys != null ? <i className="font-sans text-fila-solicitud-brd">{SIN_SKU_MAESTRO}</i> : '—'
        return (
          <MarcaTaller nsys={row.original.skuNsys}>
            <span className="font-mono text-[11.5px]" title={valor ?? undefined}>
              {partes ? <><mark className="bg-amarillo/60 text-azul-noche">{partes[0]}</mark>{partes[1]}</> : (valor ?? vacio)}
            </span>
          </MarcaTaller>
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
