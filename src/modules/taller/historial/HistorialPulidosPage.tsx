import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { ReparacionResumen } from '@/shared/api/client'
import { descargarCsv, textoForzado } from '@/shared/lib/csv'
import { formatear } from '@/shared/lib/fechas'
import { imeisValidos } from '@/shared/lib/filtroImei'
import { useStore } from '@/shared/lib/store'
import { useSession } from '@/shared/session/SessionProvider'
import { esAdminOSuperTecnico, esSuperTecnico } from '@/shared/session/storage'
import { BotonSecundario } from '@/shared/ui/Botones'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { ContextMenuItem, ContextMenuSeparator } from '@/shared/ui/context-menu'
import { DataTable } from '@/shared/ui/DataTable'
import { EtiquetaActualizado } from '@/shared/ui/EtiquetaActualizado'
import { useRegistrarExportable } from '@/shared/ui/exportable'
import { FiltroImei } from '@/shared/ui/FiltroImei'
import { MenuCopiarCelda } from '@/shared/ui/MenuCopiarCelda'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { PildoraContador } from '@/shared/ui/PildoraContador'
import { RangoFechas } from '@/shared/ui/RangoFechas'
import { SelectorLista } from '@/shared/ui/SelectorLista'
import { TogglePill } from '@/shared/ui/TogglePill'
import { useBorrarPulido, useEditarModeloTelefono, useHistorial, useTecnicos } from '../api'
import { filtroImeiHistorial, filtrosHistorial } from '../estado'
import { etiquetaContador, pasaFechas, pasaImeis, pasaTecnico } from '../lib/filtros'
import { MODELOS_ORDENADOS, traducirModelo } from '../lib/modelos'
import { TOGGLES_HISTORIAL } from './constantes'

const FMT = 'yyyy/MM/dd HH:mm' as const
const OPCIONES_MODELO = MODELOS_ORDENADOS.map((m) => ({ clave: m, etiqueta: traducirModelo(m) }))

function textoCelda(rep: ReparacionResumen, columna: string): string | null {
  switch (columna) {
    case 'id': return rep.idRep
    case 'imei': return rep.imei
    case 'modelo': return traducirModelo(rep.modelo)
    case 'tecnico': return rep.nombreTecnico ?? ''
    case 'fechaIni': return formatear(rep.fechaAsig, FMT)
    case 'fechaFin': return formatear(rep.fechaFin, FMT)
    case 'comentario': return rep.comentarioAsignacion ?? ''
    case 'cliente': return rep.cliente ?? ''
    case 'asignadoPor': return rep.nombreTecnicoAsigna ?? ''
    default: return null
  }
}

const COLUMNAS: ColumnDef<ReparacionResumen>[] = [
  { id: 'id', accessorKey: 'idRep', header: 'Id Pulido', size: 110 },
  { id: 'imei', accessorKey: 'imei', header: 'IMEI', size: 130 },
  { id: 'modelo', header: 'Modelo', size: 120, accessorFn: (r) => traducirModelo(r.modelo) },
  { id: 'tecnico', header: 'Técnico', size: 110, accessorFn: (r) => r.nombreTecnico ?? '' },
  { id: 'fechaIni', header: 'Fecha asignación', size: 130, accessorFn: (r) => formatear(r.fechaAsig, FMT) },
  { id: 'fechaFin', header: 'Fecha fin', size: 130, accessorFn: (r) => formatear(r.fechaFin, FMT) },
  { id: 'comentario', header: 'Comentario', size: 160, accessorFn: (r) => r.comentarioAsignacion ?? '' },
  { id: 'cliente', header: 'Cliente', size: 110, accessorFn: (r) => r.cliente ?? '' },
  { id: 'asignadoPor', header: 'Asignado por', size: 120, accessorFn: (r) => r.nombreTecnicoAsigna ?? '—' },
]

export function HistorialPulidosPage() {
  const { sesion } = useSession()
  const puedeEditar = esSuperTecnico(sesion)
  const global = esAdminOSuperTecnico(sesion)
  const { data = [], dataUpdatedAt, refetch } = useHistorial('PULIDO')
  const { data: tecnicos = [] } = useTecnicos(true)
  const [filtroImei, setFiltroImei] = useStore(filtroImeiHistorial)
  const [filtros, setFiltros] = useStore(filtrosHistorial.PULIDO)
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  const [aBorrar, setABorrar] = useState<ReparacionResumen | null>(null)
  const [aEditar, setAEditar] = useState<ReparacionResumen | null>(null)
  const borrar = useBorrarPulido()
  const editarModelo = useEditarModeloTelefono()

  const visibles = useMemo(() => {
    const imeis = imeisValidos(filtroImei)
    return data.filter((r) => pasaImeis(r.imei, imeis) && pasaTecnico(r.idTec, filtros.tecnicos) && pasaFechas(r, filtros.desde, filtros.hasta))
  }, [data, filtroImei, filtros])

  useRegistrarExportable(() => {
    const cabeceras = ['ID', 'IMEI', 'Modelo', ...(global ? ['Técnico'] : []), 'Fecha inicio', 'Fecha fin', 'Comentario']
    descargarCsv('historial_pulidos', cabeceras, visibles.map((r) => [
      r.idRep, textoForzado(r.imei), traducirModelo(r.modelo), ...(global ? [r.nombreTecnico ?? ''] : []),
      formatear(r.fechaAsig, 'dd/MM/yyyy HH:mm'), formatear(r.fechaFin, 'dd/MM/yyyy HH:mm'), r.comentarioAsignacion ?? '',
    ]))
  })

  return (
    <div className="p-10">
      <TogglePill className="mb-2" opciones={TOGGLES_HISTORIAL} />
      <div className="mb-3 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Historial de pulidos</h1>
        <PildoraContador texto={etiquetaContador(visibles.length, 'pulido', 'pulidos')} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <FiltroImei valor={filtroImei} onChange={setFiltroImei} />
        <MultiSelect opciones={tecnicos} clave={(t) => String(t.idTec)} etiqueta={(t) => t.nombre} seleccion={new Set([...filtros.tecnicos].map(String))}
          onChange={(s) => setFiltros({ ...filtros, tecnicos: new Set([...s].map(Number)) })} textoVacio="Técnico" textoPlural={(n) => `${n} técnicos`} className="min-w-[130px]" />
        <RangoFechas desde={filtros.desde} hasta={filtros.hasta} onChange={(desde, hasta) => setFiltros({ ...filtros, desde, hasta })} />
        <BotonSecundario onClick={() => { setFiltroImei(''); setFiltros({ ...filtros, tecnicos: new Set(), desde: '', hasta: '' }) }}>Limpiar filtros</BotonSecundario>
      </div>
      <DataTable
        columns={COLUMNAS}
        data={visibles}
        vacio="No hay pulidos completados"
        getRowId={(r) => r.idRep}
        seleccionada={seleccionada}
        onSeleccionar={setSeleccionada}
        menuFila={(r, celda) =>
          puedeEditar ? (
            <>
              <ContextMenuItem onSelect={() => setAEditar(r)}><img src="/editar.png" alt="" className="mr-2 h-3.5 w-3.5" />Editar modelo</ContextMenuItem>
              <ContextMenuItem onSelect={() => setABorrar(r)}>Borrar</ContextMenuItem>
              <ContextMenuSeparator />
              <MenuCopiarCelda texto={textoCelda(r, celda.columnaId)} celda={celda} />
            </>
          ) : (
            <MenuCopiarCelda texto={textoCelda(r, celda.columnaId)} celda={celda} />
          )
        }
      />
      <EtiquetaActualizado actualizadoEn={dataUpdatedAt} onRecargar={() => refetch({ throwOnError: true })} />
      <ConfirmDialog abierto={aBorrar !== null} conMotivo titulo={`Borrar pulido ${aBorrar?.idRep ?? ''}`} descripcion={aBorrar ? `Se borrará ${aBorrar.idRep} del historial de pulido. Escribe el motivo.` : ''} textoAccion="Borrar"
        onCancelar={() => setABorrar(null)} onConfirmar={(motivo) => { if (aBorrar && motivo) borrar.mutate({ idP: aBorrar.idRep, motivo }); setABorrar(null) }} />
      <SelectorLista abierto={aEditar !== null} titulo="Editar modelo" etiquetaLista="Selecciona el modelo:" placeholderBuscar="Filtrar modelo…" opciones={OPCIONES_MODELO}
        claveActual={aEditar?.modelo ?? null} preseleccionarActual textoSeleccionar="Guardar" onCancelar={() => setAEditar(null)}
        onSeleccionar={(modelo) => { if (aEditar) editarModelo.mutate({ imei: aEditar.imei, modelo }); setAEditar(null) }} />
    </div>
  )
}
