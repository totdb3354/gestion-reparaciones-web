import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { ReparacionResumen } from '@/shared/api/client'
import { descargarCsv, textoForzado } from '@/shared/lib/csv'
import { formatear, hoyMadrid } from '@/shared/lib/fechas'
import { imeisValidos } from '@/shared/lib/filtroImei'
import { useStore } from '@/shared/lib/store'
import { cn } from '@/shared/lib/utils'
import { useSession } from '@/shared/session/SessionProvider'
import { esSuperTecnico } from '@/shared/session/storage'
import { BadgeTipo } from '@/shared/ui/BadgeTipo'
import { BotonPrimario, BotonSecundario } from '@/shared/ui/Botones'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/DataTable'
import { EtiquetaActualizado } from '@/shared/ui/EtiquetaActualizado'
import { useRegistrarExportable } from '@/shared/ui/exportable'
import { FiltroImei } from '@/shared/ui/FiltroImei'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { PildoraContador } from '@/shared/ui/PildoraContador'
import { useAsignaciones, useBorrarAsignacion, useBorrarIncidenciaActiva, useDeshacerLlegada, useEntregaGlass, useMarcarLlegada, usePorCerrar } from '../api'
import { BadgesEstadoPendiente } from '../componentes/BadgesEstadoPendiente'
import { BotonPapelera } from '../componentes/BotonPapelera'
import { CeldaImeiPendiente } from '../componentes/CeldaImeiPendiente'
import { TogglesPendientes } from '../componentes/TogglesPendientes'
import { filtroImeiPendientes, tipoPendientes } from '../estado'
import { ocultarAnadirGlass } from '../lib/entregaGlass'
import { etiquetaContador, ordenarPendientes, pasaImeis, pasaTipo, type TipoPendiente } from '../lib/filtros'
import { traducirModelo } from '../lib/modelos'
import { TOOLTIP_FORMULARIO } from '../lib/textos'
import { MenuPendiente } from './MenuPendiente'
import { FMT_PENDIENTES } from './textoCelda'

const FMT_CSV = 'dd/MM/yyyy HH:mm'
const OPCIONES_TIPO: { clave: TipoPendiente; etiqueta: string }[] = [
  { clave: 'solicitud', etiqueta: 'Solicitudes pieza' },
  { clave: 'incidencia', etiqueta: 'Incidencias' },
  { clave: 'asignacion', etiqueta: 'Asignaciones' },
]

/** "Añadir reparación" / "Añadir glass" deshabilitado hasta el sub-proyecto 2; en glass bloqueada no se pinta. */
function BotonAnadir({ rep, glass }: { rep: ReparacionResumen; glass: boolean }) {
  if (glass && ocultarAnadirGlass(rep)) return null
  return (
    <span title={TOOLTIP_FORMULARIO} className="inline-block">
      <BotonPrimario disabled className="pointer-events-none">{glass ? 'Añadir glass' : 'Añadir reparación'}</BotonPrimario>
    </span>
  )
}

export function PendientesPage({ tipo }: { tipo: 'REPARACION' | 'GLASS' }) {
  const glass = tipo === 'GLASS'
  const { sesion } = useSession()
  const esSuper = esSuperTecnico(sesion)
  const idTec = sesion?.idTec ?? null
  const { data = [], dataUpdatedAt, refetch } = useAsignaciones(tipo)
  const [filtroImei, setFiltroImei] = useStore(filtroImeiPendientes)
  const [tipos, setTipos] = useStore(tipoPendientes[tipo])
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  const [aBorrar, setABorrar] = useState<ReparacionResumen | null>(null)
  const hoy = hoyMadrid()
  const porCerrar = usePorCerrar()
  const entrega = useEntregaGlass()
  const llegada = useMarcarLlegada()
  const deshacerLlegada = useDeshacerLlegada()
  const borrarAsignacion = useBorrarAsignacion()
  const borrarIncidencia = useBorrarIncidenciaActiva()

  const visibles = useMemo(() => {
    const imeis = imeisValidos(filtroImei)
    return ordenarPendientes(data.filter((r) => pasaImeis(r.imei, imeis) && pasaTipo(r, tipos)))
  }, [data, filtroImei, tipos])

  const columnas = useMemo<ColumnDef<ReparacionResumen>[]>(() => {
    const base: ColumnDef<ReparacionResumen>[] = [
      { id: 'id', accessorKey: 'idRep', header: 'Id Asignación', size: 90 },
      { id: 'tipo', header: 'Tipo', size: 90, cell: ({ row }) => <BadgeTipo idRep={row.original.idRep} esChasis={row.original.esChasis} /> },
      { id: 'imei', header: 'IMEI', size: 130, cell: ({ row }) => <CeldaImeiPendiente rep={row.original} /> },
      { id: 'modelo', header: 'Modelo', size: 120, accessorFn: (r) => traducirModelo(r.modelo) },
      { id: 'fecha', header: 'Fecha asignación', size: 130, accessorFn: (r) => formatear(r.fechaAsig, FMT_PENDIENTES) },
      { id: 'comentario', header: 'Comentario', size: 160, accessorFn: (r) => r.comentarioAsignacion ?? '' },
      { id: 'cliente', header: 'Cliente', size: 110, accessorFn: (r) => r.cliente ?? '' },
      { id: 'asignadoPor', header: 'Asignado por', size: 120, accessorFn: (r) => r.nombreTecnicoAsigna ?? '—' },
      { id: 'estado', header: 'Estado', size: 100, cell: ({ row }) => <BadgesEstadoPendiente rep={row.original} hoy={hoy} /> },
      { id: 'accion', header: '', size: 150, cell: ({ row }) => <BotonAnadir rep={row.original} glass={glass} /> },
    ]
    if (esSuper) base.push({ id: 'borrar', header: '', size: 45, cell: ({ row }) => <BotonPapelera onClick={() => setABorrar(row.original)} /> })
    return base
  }, [esSuper, glass, hoy])

  useRegistrarExportable(() => {
    const cabeceras = ['ID Reparación', 'IMEI', ...(esSuper ? ['Técnico'] : []), 'Fecha asig.', 'Fecha fin', 'Componente', 'Observaciones', 'Incidencia', 'Resuelto', 'ID Rep. anterior']
    const filas = visibles.map((r) => [
      r.idRep, textoForzado(r.imei), ...(esSuper ? [r.nombreTecnico ?? ''] : []),
      formatear(r.fechaAsig, FMT_CSV), formatear(r.fechaFin, FMT_CSV), r.tipoComponente ?? '', r.observaciones ?? '',
      r.esIncidencia ? (r.incidencia ?? 'Sí') : 'No', r.esResuelto ? 'Sí' : 'No', r.idRepAnterior ?? '',
    ])
    descargarCsv('mis_pendientes', cabeceras, filas)
  })

  const acciones = {
    porCerrar: (r: ReparacionResumen) => porCerrar.mutate({ idRep: r.idRep, porCerrar: !r.porCerrar }),
    // Sin entrega → entregar; con entrega → deshacer. `!` y no `=== null`: una clave ausente (undefined) también es "sin entrega".
    entrega: (r: ReparacionResumen) => entrega.mutate({ idRep: r.idRep, entregado: !r.glassEntregadoAt }),
    llegada: (r: ReparacionResumen) => llegada.mutate(r.idRep),
    deshacerLlegada: (r: ReparacionResumen) => deshacerLlegada.mutate(r.idRep),
  }

  function confirmarBorrado() {
    if (!aBorrar) return
    const rep = aBorrar
    setABorrar(null)
    if (rep.esIncidencia) borrarIncidencia.mutate({ imei: rep.imei, tipo: glass ? 'G' : 'R' })
    else borrarAsignacion.mutate(rep.idRep)
  }

  return (
    <div className="p-10">
      <TogglesPendientes />
      <div className="mb-3 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Mis asignaciones pendientes</h1>
        <PildoraContador texto={etiquetaContador(visibles.length, 'pendiente', 'pendientes', 999)} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <FiltroImei valor={filtroImei} onChange={setFiltroImei} />
        <MultiSelect
          opciones={OPCIONES_TIPO}
          clave={(o) => o.clave}
          etiqueta={(o) => o.etiqueta}
          seleccion={tipos as Set<string>}
          onChange={(s) => setTipos(s as Set<TipoPendiente>)}
          textoVacio="Tipo"
          textoPlural={(n) => `${n} filtros`}
          textoTodas="Todas"
          className="min-w-[130px]"
        />
        <BotonSecundario onClick={() => { setFiltroImei(''); setTipos(new Set()) }}>Limpiar filtros</BotonSecundario>
      </div>
      <DataTable
        columns={columnas}
        data={visibles}
        vacio="No tienes asignaciones pendientes"
        getRowId={(r) => r.idRep}
        seleccionada={seleccionada}
        onSeleccionar={setSeleccionada}
        filaClase={(r) => cn('border-l-8', r.esSolicitud > 0 ? 'border-l-fila-solicitud-brd' : r.esIncidencia ? 'border-l-fila-incidencia-brd' : 'border-l-transparent')}
        menuFila={(r, celda) => <MenuPendiente rep={r} celda={celda} glass={glass} idTec={idTec} acciones={acciones} />}
      />
      <EtiquetaActualizado actualizadoEn={dataUpdatedAt} onRecargar={() => refetch({ throwOnError: true })} />
      <ConfirmDialog
        abierto={aBorrar !== null}
        titulo={`Borrar asignación ${aBorrar?.idRep ?? ''}`}
        descripcion={aBorrar?.esIncidencia ? 'El técnico dejará de verla en su lista de pendientes y la incidencia se marcará como no activa en la tabla principal.' : 'El técnico dejará de verla en su lista de pendientes.'}
        textoAccion="Borrar asignación"
        onCancelar={() => setABorrar(null)}
        onConfirmar={confirmarBorrado}
      />
    </div>
  )
}
