import type { ColumnDef } from '@tanstack/react-table'
import type { ReparacionResumen } from '@/shared/api/client'
import { formatear, type Patron } from '@/shared/lib/fechas'
import { BadgeTipo } from '@/shared/ui/BadgeTipo'
import { CeldaFechas } from '@/shared/ui/CeldaFechas'
import { TextoExpandible } from '@/shared/ui/TextoExpandible'
import { tipoDe } from '@/shared/lib/tipoTrabajo'
import { CeldaEstadoTrabajo } from '../componentes/CeldaEstadoTrabajo'
import { CeldaIncidencia } from '../componentes/CeldaIncidencia'
import { CeldaReparador } from '../componentes/CeldaReparador'
import { traducirModelo } from '../lib/modelos'

type Opciones = {
  /** Columna "Tipo" delante (detalle de IMEIs) */
  conTipo?: boolean
  /** Patrón de la columna Fechas: 'yyyy/MM/dd' en el Historial, 'yyyy/MM/dd HH:mm' en el detalle de IMEIs */
  patronFechas: Patron
  /** Título de la columna del ID: "Id Reparación" en el Historial, "Id" en el detalle */
  tituloId: string
  /** Enlace "Id Rep. Anterior": selecciona esa fila */
  onIrA: (idRep: string) => void
}

/** Columnas de una tabla de trabajos (Historial rep/glass y detalle de IMEIs), con los mínimos del FXML como pesos. */
export function columnasTrabajo({ conTipo = false, patronFechas, tituloId, onIrA }: Opciones): ColumnDef<ReparacionResumen>[] {
  const base: ColumnDef<ReparacionResumen>[] = [
    { id: 'id', accessorKey: 'idRep', header: tituloId, size: 110 },
    { id: 'imei', accessorKey: 'imei', header: 'IMEI teléfono', size: 130 },
    { id: 'modelo', header: 'Modelo', size: 100, accessorFn: (r) => traducirModelo(r.modelo) },
    { id: 'reparador', header: 'Reparador', size: 100, cell: ({ row }) => <CeldaReparador rep={row.original} /> },
    { id: 'asignadoPor', header: 'Asignado por', size: 100, accessorFn: (r) => r.nombreTecnicoAsigna ?? '—' },
    { id: 'fechas', header: 'Fechas', size: 110, cell: ({ row }) => <CeldaFechas inicio={row.original.fechaAsig} fin={row.original.fechaFin} patron={patronFechas} /> },
    {
      id: 'componente', header: 'Componente', size: 150,
      cell: ({ row }) => (
        <div className="flex flex-col leading-tight">
          <span>{row.original.tipoComponente ?? ''}</span>
          {row.original.esReutilizado && <span className="text-[10px] italic text-texto-fecha-inicio">Reutilizado</span>}
        </div>
      ),
    },
    { id: 'observaciones', header: 'Observaciones', size: 200, cell: ({ row }) => <TextoExpandible titulo="Observaciones" texto={row.original.observaciones} /> },
    { id: 'estado', header: 'Estado', size: 120, cell: ({ row }) => <CeldaEstadoTrabajo esIncidencia={row.original.esIncidencia} esResuelto={row.original.esResuelto} /> },
    { id: 'incidencia', header: 'Incidencia', size: 200, cell: ({ row }) => <CeldaIncidencia rep={row.original} /> },
    {
      id: 'anterior', header: 'Id Rep. Anterior', size: 150,
      cell: ({ row }) => {
        const r = row.original
        // el pulido guarda en ID_REP_ANTERIOR el enlace interno a su asignación, no una reincidencia
        if (!r.idRepAnterior || tipoDe(r.idRep) === 'PULIDO') return null
        // stopPropagation: el <tr> tiene su propio onClick de selección (clic en cualquier punto de la fila la
        // selecciona); sin cortar la burbuja, ese handler se dispara después del botón y sobrescribe la
        // selección con el id de ESTA fila en vez de dejar la del id referenciado.
        return <button type="button" onClick={(e) => { e.stopPropagation(); onIrA(r.idRepAnterior!) }} className="cursor-pointer truncate text-texto-accion hover:underline">{r.idRepAnterior}</button>
      },
    },
  ]
  if (conTipo) base.unshift({ id: 'tipo', header: 'Tipo', size: 100, cell: ({ row }) => <BadgeTipo idRep={row.original.idRep} /> })
  return base
}

/** Texto de "Copiar celda" (calco de textoDeCelda del Historial y del Agrupado en detalle). */
export function textoCeldaTrabajo(rep: ReparacionResumen, columna: string, patronFechas: Patron): string | null {
  switch (columna) {
    case 'tipo': return tipoDe(rep.idRep) === 'GLASS' ? 'Glass' : tipoDe(rep.idRep) === 'PULIDO' ? 'Pulido' : 'Reparación'
    case 'id': return rep.idRep
    case 'imei': return rep.imei
    case 'modelo': return traducirModelo(rep.modelo)
    case 'reparador': return rep.nombreTecnico ?? ''
    case 'asignadoPor': return rep.nombreTecnicoAsigna ?? ''
    case 'fechas': return formatear(rep.fechaFin, patronFechas)
    case 'componente': return rep.tipoComponente ?? ''
    case 'observaciones': return rep.observaciones ?? ''
    case 'incidencia': return rep.incidencia ?? ''
    case 'anterior': return rep.idRepAnterior ?? ''
    default: return null
  }
}
