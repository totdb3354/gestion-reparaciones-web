import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { esErrorGestionadoGlobalmente, mensajeDeError, StaleDataError } from '@/shared/api/errors'
import { descargarCsv } from '@/shared/lib/csv'
import { formatear } from '@/shared/lib/fechas'
import { useStore } from '@/shared/lib/store'
import { cn } from '@/shared/lib/utils'
import { useSession } from '@/shared/session/SessionProvider'
import { esSuperTecnico } from '@/shared/session/storage'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { CeldaFechas } from '@/shared/ui/CeldaFechas'
import { ContextMenuItem, ContextMenuSeparator } from '@/shared/ui/context-menu'
import { DataTable } from '@/shared/ui/DataTable'
import { useRegistrarExportable } from '@/shared/ui/exportable'
import { MenuCopiarCelda } from '@/shared/ui/MenuCopiarCelda'
import { PildoraContador } from '@/shared/ui/PildoraContador'
import { SelectorLista } from '@/shared/ui/SelectorLista'
import { TextoExpandible } from '@/shared/ui/TextoExpandible'
import { useClientesActivos, useEditarClienteTelefono, useEditarObservacionTelefono } from '../api'
import { CeldaEstadoTrabajo } from '../componentes/CeldaEstadoTrabajo'
import { DialogoObservacion } from '../componentes/DialogoObservacion'
import { filtrosImeis, ultimoImeiVisto } from '../estado'
import { etiquetaContador } from '../lib/filtros'
import { resumenTipos, type GrupoImei } from '../lib/grupoImei'
import { traducirModelo } from '../lib/modelos'
import { agruparVisibles, opcionesCliente } from './agrupacion'
import { CABECERAS_RESUMEN, filaResumen } from './csvImeis'
import { BarraFiltrosImeis } from './BarraFiltrosImeis'
import { useTrabajos } from './useTrabajos'

export const MSG_TELEFONO_MODIFICADO = 'El teléfono fue modificado por otro usuario. Se recargan los datos.'
const FMT = 'yyyy/MM/dd HH:mm' as const
const SIN_CLIENTE_CLAVE = ''

function textoCeldaGrupo(g: GrupoImei, columna: string): string | null {
  switch (columna) {
    case 'imei': return g.imei
    case 'modelo': return traducirModelo(g.modelo)
    case 'fechas': return `${formatear(g.fechaMasAntigua, FMT) || '—'} → ${formatear(g.fechaMasReciente, FMT) || '—'}`
    case 'trabajos': return resumenTipos(g)
    case 'observacion': return g.observacion ?? ''
    case 'cliente': return g.cliente ?? ''
    default: return null
  }
}

/** Maestro "Agrupado por IMEI": calco de AgrupadoController en modo MAESTRO (sin columna Revisión ni etiqueta "Actualizado"). */
export function ImeisPage() {
  const { sesion } = useSession()
  const puedeEditar = esSuperTecnico(sesion)
  const navigate = useNavigate()
  const { mostrarError } = useAlerta()
  const trabajos = useTrabajos()
  const [filtros] = useStore(filtrosImeis)
  const grupos = useMemo(() => agruparVisibles(trabajos, filtros), [trabajos, filtros])
  const clientes = useMemo(() => opcionesCliente(trabajos), [trabajos])
  // Al volver del detalle, el maestro reselecciona ese IMEI (y DataTable desplaza hasta él); el aviso se consume una vez.
  const [seleccionada, setSeleccionada] = useState<string | null>(() => ultimoImeiVisto.get())
  useEffect(() => { ultimoImeiVisto.reset() }, [])
  const [conObservacion, setConObservacion] = useState<GrupoImei | null>(null)
  const [conCliente, setConCliente] = useState<GrupoImei | null>(null)
  const { data: clientesActivos = [] } = useClientesActivos()
  const editarObservacion = useEditarObservacionTelefono()
  const editarCliente = useEditarClienteTelefono()

  const abrir = (imei: string) => navigate(`/reparaciones/imeis/${imei}`)
  const alFallar = (e: unknown) => {
    if (esErrorGestionadoGlobalmente(e)) return
    mostrarError(e instanceof StaleDataError ? MSG_TELEFONO_MODIFICADO : `No se pudo guardar: ${mensajeDeError(e)}`)
  }

  const columnas = useMemo<ColumnDef<GrupoImei>[]>(() => [
    {
      id: 'imei', header: 'IMEI teléfono', size: 180,
      cell: ({ row }) => (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold text-azul-medio">{row.original.imei}</span>
          <button type="button" aria-label={`Ver trabajos de ${row.original.imei}`} onClick={(e) => { e.stopPropagation(); navigate(`/reparaciones/imeis/${row.original.imei}`) }} className="shrink-0 cursor-pointer">
            <img src="/Historial.png" alt="" className="h-[25px] w-[25px]" />
          </button>
        </div>
      ),
    },
    { id: 'modelo', header: 'Modelo', size: 150, accessorFn: (g) => traducirModelo(g.modelo) },
    { id: 'fechas', header: 'Fechas', size: 130, cell: ({ row }) => <CeldaFechas inicio={row.original.fechaMasAntigua} fin={row.original.fechaMasReciente} patron={FMT} /> },
    { id: 'trabajos', header: 'Trabajos', size: 160, accessorFn: resumenTipos },
    { id: 'estado', header: 'Estado', size: 130, cell: ({ row }) => <CeldaEstadoTrabajo esIncidencia={row.original.incAbiertas > 0} esResuelto={false} /> },
    { id: 'observacion', header: 'Observación', size: 200, cell: ({ row }) => <TextoExpandible titulo="Observación" texto={row.original.observacion} /> },
    { id: 'cliente', header: 'Cliente', size: 200, cell: ({ row }) => <TextoExpandible titulo="Cliente" texto={row.original.cliente} /> },
  ], [navigate])

  useRegistrarExportable(() => descargarCsv('agrupado_resumen', CABECERAS_RESUMEN, grupos.map(filaResumen)))

  const opcionesClienteActivo = [{ clave: SIN_CLIENTE_CLAVE, etiqueta: '— Sin cliente —' }, ...clientesActivos.map((c) => ({ clave: String(c.idCli), etiqueta: c.nombre }))]
  const claveClienteActual = conCliente?.cliente ? (clientesActivos.find((c) => c.nombre === conCliente.cliente)?.idCli.toString() ?? null) : null

  return (
    <div className="p-10">
      <div className="mb-2 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Agrupado por IMEI</h1>
        <PildoraContador texto={etiquetaContador(grupos.length, 'IMEI', 'IMEIs')} />
      </div>
      <BarraFiltrosImeis modo="maestro" opcionesCliente={clientes} />
      <DataTable
        columns={columnas}
        data={grupos}
        vacio=""
        ajuste="estirar"
        getRowId={(g) => g.imei}
        seleccionada={seleccionada}
        onSeleccionar={setSeleccionada}
        onAbrir={(g) => abrir(g.imei)}
        filaClase={(g) => cn('cursor-pointer border-l-4 bg-fila-maestro-bg', g.incAbiertas > 0 ? 'border-l-fila-incidencia-brd' : 'border-l-azul-medio')}
        menuFila={(g, celda) => (
          <>
            <MenuCopiarCelda texto={textoCeldaGrupo(g, celda.columnaId)} celda={celda} />
            {puedeEditar && g.telefonoUpdatedAt !== null && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => setConObservacion(g)}>Editar observación</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => setConCliente(g)}>Editar cliente</ContextMenuItem>
              </>
            )}
          </>
        )}
      />
      <DialogoObservacion grupo={conObservacion} onCerrar={() => setConObservacion(null)}
        onGuardar={(observacion) => {
          // g (no conObservacion) es a quien se le comprueba y estrecha telefonoUpdatedAt: TypeScript no propaga
          // el estrechamiento de un opcional encadenado a una variable distinta asignada antes de comprobarlo.
          const g = conObservacion
          if (!g?.telefonoUpdatedAt) return
          setConObservacion(null)
          editarObservacion.mutate({ imei: g.imei, observacion, updatedAt: g.telefonoUpdatedAt }, { onError: alFallar })
        }} />
      <SelectorLista abierto={conCliente !== null} titulo="Seleccionar cliente" placeholderBuscar="Buscar cliente..." opciones={opcionesClienteActivo} claveActual={claveClienteActual}
        textoNada="Nada seleccionado" textoSeleccionar="Seleccionar" onCancelar={() => setConCliente(null)}
        onSeleccionar={(clave) => {
          const g = conCliente
          if (!g?.telefonoUpdatedAt) return
          setConCliente(null)
          editarCliente.mutate({ imei: g.imei, idCli: clave === SIN_CLIENTE_CLAVE ? null : Number(clave), updatedAt: g.telefonoUpdatedAt }, { onError: alFallar })
        }} />
    </div>
  )
}
