import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { ReparacionResumen } from '@/shared/api/client'
import { descargarCsv, textoForzado } from '@/shared/lib/csv'
import { formatear } from '@/shared/lib/fechas'
import { imeisValidos } from '@/shared/lib/filtroImei'
import { useStore } from '@/shared/lib/store'
import { useSession } from '@/shared/session/SessionProvider'
import { esSuperTecnico } from '@/shared/session/storage'
import { BotonPrimario, BotonSecundario } from '@/shared/ui/Botones'
import { Checkbox } from '@/shared/ui/checkbox'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/DataTable'
import { EtiquetaActualizado } from '@/shared/ui/EtiquetaActualizado'
import { useRegistrarExportable } from '@/shared/ui/exportable'
import { FiltroImei } from '@/shared/ui/FiltroImei'
import { MenuCopiarCelda } from '@/shared/ui/MenuCopiarCelda'
import { PildoraContador } from '@/shared/ui/PildoraContador'
import { useAsignaciones, useBorrarAsignacionPulido, useCompletarPulidos } from '../api'
import { BotonPapelera } from '../componentes/BotonPapelera'
import { TogglesPendientes } from '../componentes/TogglesPendientes'
import { filtroImeiPendientes } from '../estado'
import { etiquetaContador, pasaImeis } from '../lib/filtros'
import { traducirModelo } from '../lib/modelos'
import { FMT_PENDIENTES, textoCeldaPendiente } from './textoCelda'

// Solo 'cliente' y 'asignadoPor' son propios de Pulidos (docs/paridad/pendientes.md: "y en Pulidos también Cliente
// y Asignado por"); textoCeldaPendiente no los copia en Reparaciones/Glass, así que aquí no se puede delegar. El
// resto de columnas son un calco exacto de textoCeldaPendiente: delegar en vez de duplicar la lógica de copia.
function textoCelda(rep: ReparacionResumen, columna: string): string | null {
  switch (columna) {
    case 'cliente': return rep.cliente ?? ''
    case 'asignadoPor': return rep.nombreTecnicoAsigna ?? ''
    default: return textoCeldaPendiente(rep, columna)
  }
}

/** Cuántos y cuáles va a completar: una línea por IMEI (con el modelo si lo tiene), las cinco primeras y cuántas más. */
const MAX_LINEAS_CONFIRMAR = 5
function textoConfirmarCompletar(reps: ReparacionResumen[]): string {
  const lineas = reps.slice(0, MAX_LINEAS_CONFIRMAR).map((r) => { const modelo = traducirModelo(r.modelo); return modelo ? `${r.imei} · ${modelo}` : r.imei })
  if (reps.length > MAX_LINEAS_CONFIRMAR) lineas.push(`… y ${reps.length - MAX_LINEAS_CONFIRMAR} más`)
  return [`Has seleccionado ${etiquetaContador(reps.length, 'pulido', 'pulidos')}:`, ...lineas].join('\n')
}

export function PulidosPendientesPage() {
  const { sesion } = useSession()
  const esSuper = esSuperTecnico(sesion)
  const { data = [], dataUpdatedAt, errorUpdatedAt, refetch } = useAsignaciones('PULIDO')
  const [filtroImei, setFiltroImei] = useStore(filtroImeiPendientes)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  // Calco de cargar(), que hace `seleccionados.clear()` antes de pedir la lista: la selección no sobrevive a una recarga,
  // tampoco a una que falla (sondeo o "Actualizado"). Un guardado fallido no recarga, así que la conserva.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- la recarga no es un evento de esta vista: llega de TanStack Query (sondeo, foco, "Actualizado") y solo se ve en dataUpdatedAt/errorUpdatedAt, así que no hay un manejador en el que vaciar la selección
  useEffect(() => setSeleccionados((prev) => (prev.size ? new Set() : prev)), [dataUpdatedAt, errorUpdatedAt])
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  const [aBorrar, setABorrar] = useState<ReparacionResumen | null>(null)
  const completar = useCompletarPulidos()
  const borrar = useBorrarAsignacionPulido()

  const visibles = useMemo(() => { const imeis = imeisValidos(filtroImei); return data.filter((r) => pasaImeis(r.imei, imeis)) }, [data, filtroImei])
  // Solo cuenta lo que se ve. El JavaFX marcaba con «Seleccionar todo» también lo que el filtro ocultaba y lo completaba:
  // con el filtro por IMEI en un pulido se completaban todos (incidencia del taller, 2026-10-20). Una casilla marcada que
  // el filtro oculta se conserva, pero ni se cuenta ni se completa.
  const marcados = useMemo(() => visibles.filter((r) => seleccionados.has(r.idRep)), [visibles, seleccionados])
  // Lo que enseña el diálogo de confirmación y lo que se manda al confirmar: una recarga con el diálogo abierto vacía la
  // selección, pero no cambia lo que el técnico está confirmando.
  const [aCompletar, setACompletar] = useState<ReparacionResumen[] | null>(null)

  function marcar(id: string, marcado: boolean) {
    setSeleccionados((prev) => { const s = new Set(prev); if (marcado) s.add(id); else s.delete(id); return s })
  }
  function seleccionarTodo() {
    setSeleccionados((prev) => (visibles.length > 0 && visibles.every((r) => prev.has(r.idRep)) ? new Set() : new Set(visibles.map((r) => r.idRep))))
  }
  // Calco de completarSeleccionados, con confirmación: la selección se vacía (y la lista se recarga, useCompletarPulidos)
  // solo si el guardado va bien; si falla, el diálogo de error y la selección se quedan.
  function completarSeleccionados() {
    if (marcados.length > 0) setACompletar(marcados)
  }
  function confirmarCompletar() {
    if (aCompletar) completar.mutate(aCompletar.map((r) => r.idRep), { onSuccess: () => setSeleccionados(new Set()) })
    setACompletar(null)
  }

  const columnas = useMemo<ColumnDef<ReparacionResumen>[]>(() => {
    const base: ColumnDef<ReparacionResumen>[] = [
      { id: 'check', header: '', size: 40, maxSize: 40, cell: ({ row }) => <Checkbox aria-label={`Seleccionar ${row.original.idRep}`} checked={seleccionados.has(row.original.idRep)} onCheckedChange={(v) => marcar(row.original.idRep, v === true)} /> },
      { id: 'id', accessorKey: 'idRep', header: 'Id Asignación', size: 90, maxSize: 90 },
      { id: 'imei', accessorKey: 'imei', header: 'IMEI', size: 130, maxSize: 130 },
      { id: 'modelo', header: 'Modelo', size: 120, accessorFn: (r) => traducirModelo(r.modelo) },
      { id: 'fecha', header: 'Fecha asignación', size: 130, maxSize: 130, accessorFn: (r) => formatear(r.fechaAsig, FMT_PENDIENTES) },
      { id: 'comentario', header: 'Comentario', size: 160, accessorFn: (r) => r.comentarioAsignacion ?? '' },
      { id: 'cliente', header: 'Cliente', size: 110, accessorFn: (r) => r.cliente ?? '' },
      { id: 'asignadoPor', header: 'Asignado por', size: 120, accessorFn: (r) => r.nombreTecnicoAsigna ?? '—' },
    ]
    if (esSuper) base.push({ id: 'borrar', header: '', size: 50, maxSize: 50, cell: ({ row }) => <BotonPapelera onClick={() => setABorrar(row.original)} /> })
    return base
  }, [esSuper, seleccionados])

  useRegistrarExportable(() => {
    descargarCsv('pulidos_pendientes', ['ID', 'IMEI', 'Modelo', 'Fecha asig.', 'Comentario'],
      visibles.map((r) => [r.idRep, textoForzado(r.imei), traducirModelo(r.modelo), formatear(r.fechaAsig, 'dd/MM/yyyy HH:mm'), r.comentarioAsignacion ?? '']))
  })

  return (
    <div className="p-10">
      <TogglesPendientes />
      <div className="mb-3 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Mis pulidos pendientes</h1>
        <PildoraContador texto={etiquetaContador(visibles.length, 'pendiente', 'pendientes', 999)} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <FiltroImei valor={filtroImei} onChange={setFiltroImei} />
        <BotonSecundario onClick={() => setFiltroImei('')}>Limpiar filtros</BotonSecundario>
        <BotonSecundario className="ml-6" onClick={seleccionarTodo}>Seleccionar todo</BotonSecundario>
        {/* Deshabilitado también mientras se guarda: la selección ya no se vacía al pulsar y un segundo clic repetiría el
            lote (en el JavaFX la llamada bloquea la ventana). */}
        <BotonPrimario disabled={marcados.length === 0 || completar.isPending} onClick={completarSeleccionados}>Completar seleccionados</BotonPrimario>
      </div>
      <DataTable
        columns={columnas}
        data={visibles}
        vacio="No tienes pulidos pendientes"
        ajuste="fluido"
        getRowId={(r) => r.idRep}
        seleccionada={seleccionada}
        onSeleccionar={setSeleccionada}
        menuFila={(r, celda) => <MenuCopiarCelda texto={textoCelda(r, celda.columnaId)} celda={celda} />}
      />
      <EtiquetaActualizado actualizadoEn={dataUpdatedAt} onRecargar={() => refetch({ throwOnError: true })} />
      <ConfirmDialog
        abierto={aCompletar !== null}
        titulo={`Completar ${etiquetaContador(aCompletar?.length ?? 0, 'pulido', 'pulidos')}`}
        descripcion={textoConfirmarCompletar(aCompletar ?? [])}
        textoAccion={`Completar ${etiquetaContador(aCompletar?.length ?? 0, 'pulido', 'pulidos')}`}
        onCancelar={() => setACompletar(null)}
        onConfirmar={confirmarCompletar}
      />
      <ConfirmDialog
        abierto={aBorrar !== null}
        titulo={`Borrar asignación ${aBorrar?.idRep ?? ''}`}
        descripcion="El pulido dejará de estar asignado y desaparecerá de tus pendientes."
        textoAccion="Borrar asignación"
        onCancelar={() => setABorrar(null)}
        onConfirmar={() => { if (aBorrar) borrar.mutate(aBorrar.idRep); setABorrar(null) }}
      />
    </div>
  )
}
