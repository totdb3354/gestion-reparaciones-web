import { useMemo, useState } from 'react'
import { descargarCsv } from '@/shared/lib/csv'
import { imeisValidos } from '@/shared/lib/filtroImei'
import { useStore } from '@/shared/lib/store'
import { cn } from '@/shared/lib/utils'
import { useSession } from '@/shared/session/SessionProvider'
import { esAdminOSuperTecnico, esSuperTecnico } from '@/shared/session/storage'
import { BotonSecundario } from '@/shared/ui/Botones'
import { DataTable } from '@/shared/ui/DataTable'
import { EtiquetaActualizado } from '@/shared/ui/EtiquetaActualizado'
import { useRegistrarExportable } from '@/shared/ui/exportable'
import { FiltroImei } from '@/shared/ui/FiltroImei'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { PildoraContador } from '@/shared/ui/PildoraContador'
import { RangoFechas } from '@/shared/ui/RangoFechas'
import { TogglePill } from '@/shared/ui/TogglePill'
import { useHistorial, useTecnicos } from '../api'
import { MenuHistorial } from '../componentes/MenuHistorial'
import { TITULOS_BORRAR, useAccionesTrabajo } from '../componentes/useAccionesTrabajo'
import { filtroImeiHistorial, filtrosHistorial } from '../estado'
import { estadoIncidencia, etiquetaContador, pasaFechas, pasaImeis, pasaIncidencias, pasaPieza, pasaTecnico, type EstadoIncidencia } from '../lib/filtros'
import { categoriaPieza } from '../lib/piezas'
import { columnasTrabajo, textoCeldaTrabajo } from './columnasTrabajo'
import { cabecerasHistorial, filaHistorial } from './csvTrabajos'

// eslint-disable-next-line react-refresh/only-export-components -- reutilizada por PulidosHistorialPage (Task 17), patrón del proyecto
export const TOGGLES_HISTORIAL = [
  { to: '/reparaciones/historial', etiqueta: 'Reparaciones' },
  { to: '/reparaciones/historial/glass', etiqueta: 'Glass' },
  { to: '/reparaciones/historial/pulidos', etiqueta: 'Pulidos' },
]
/** Las tres casillas del Historial y del detalle de IMEIs (el maestro de IMEIs usa otras dos, Task 18). */
// eslint-disable-next-line react-refresh/only-export-components -- reutilizada por el detalle de IMEIs (Task 18), patrón del proyecto
export const OPCIONES_INCIDENCIAS: { clave: EstadoIncidencia; etiqueta: string }[] = [
  { clave: 'abiertas', etiqueta: 'Abiertas' },
  { clave: 'cerradas', etiqueta: 'Cerradas' },
  { clave: 'sin', etiqueta: 'Sin incidencia' },
]

export function HistorialPage({ tipo }: { tipo: 'REPARACION' | 'GLASS' }) {
  const { sesion } = useSession()
  const puedeEditar = esSuperTecnico(sesion)
  const global = esAdminOSuperTecnico(sesion)
  const { data = [], dataUpdatedAt, refetch } = useHistorial(tipo)
  const { data: tecnicos = [] } = useTecnicos()
  const [filtroImei, setFiltroImei] = useStore(filtroImeiHistorial)
  const [filtros, setFiltros] = useStore(filtrosHistorial[tipo])
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  const { acciones, dialogos } = useAccionesTrabajo({ tituloBorrar: TITULOS_BORRAR.historial, avisoReferencia: 'Esta reparación está siendo referenciada' })

  const piezas = useMemo(() => [...new Set(data.map((r) => categoriaPieza(r.tipoComponente)).filter((c) => c !== ''))].sort((a, b) => a.localeCompare(b, 'es')), [data])
  const visibles = useMemo(() => {
    const imeis = imeisValidos(filtroImei)
    return data.filter((r) => pasaImeis(r.imei, imeis) && pasaTecnico(r.idTec, filtros.tecnicos) && pasaPieza(r.tipoComponente, filtros.piezas) && pasaFechas(r, filtros.desde, filtros.hasta) && pasaIncidencias(r, filtros.incidencias))
  }, [data, filtroImei, filtros])
  const columnas = useMemo(() => columnasTrabajo({ patronFechas: 'yyyy/MM/dd', tituloId: 'Id Reparación', onIrA: setSeleccionada }), [])

  useRegistrarExportable(() => {
    const base = global ? (tipo === 'GLASS' ? 'historial_glass' : 'historial_reparaciones') : tipo === 'GLASS' ? 'mis_glass' : 'mis_reparaciones'
    descargarCsv(base, cabecerasHistorial(global), visibles.map((r) => filaHistorial(r, global)))
  })

  const limpiar = () => { setFiltroImei(''); setFiltros({ tecnicos: new Set(), piezas: new Set(), desde: '', hasta: '', incidencias: new Set() }) }

  return (
    <div className="p-10">
      <TogglePill className="mb-2" opciones={TOGGLES_HISTORIAL} />
      <div className="mb-2 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">{global ? 'Historial de reparaciones' : 'Mis reparaciones'}</h1>
        <PildoraContador texto={etiquetaContador(visibles.length, 'reparación', 'reparaciones')} />
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <FiltroImei valor={filtroImei} onChange={setFiltroImei} />
        {global && (
          <MultiSelect opciones={tecnicos} clave={(t) => String(t.idTec)} etiqueta={(t) => t.nombre} seleccion={new Set([...filtros.tecnicos].map(String))}
            onChange={(s) => setFiltros({ ...filtros, tecnicos: new Set([...s].map(Number)) })} textoVacio="Técnico" textoPlural={(n) => `${n} técnicos`} className="min-w-[130px]" />
        )}
        <MultiSelect opciones={piezas} clave={(p) => p} etiqueta={(p) => p} seleccion={filtros.piezas} onChange={(s) => setFiltros({ ...filtros, piezas: s })} textoVacio="Pieza" textoPlural={(n) => `${n} piezas`} className="min-w-[140px]" />
        <RangoFechas desde={filtros.desde} hasta={filtros.hasta} onChange={(desde, hasta) => setFiltros({ ...filtros, desde, hasta })} />
        <MultiSelect opciones={OPCIONES_INCIDENCIAS} clave={(o) => o.clave} etiqueta={(o) => o.etiqueta} seleccion={filtros.incidencias as Set<string>}
          onChange={(s) => setFiltros({ ...filtros, incidencias: s as Set<EstadoIncidencia> })} textoVacio="Incidencias" textoPlural={(n) => `${n} filtros`} textoTodas="Todas" className="min-w-[130px]" />
        <BotonSecundario onClick={limpiar}>Limpiar filtros</BotonSecundario>
      </div>
      <DataTable
        columns={columnas}
        data={visibles}
        vacio=""
        ajuste="estirar"
        getRowId={(r) => r.idRep}
        seleccionada={seleccionada}
        onSeleccionar={setSeleccionada}
        filaClase={(r) => cn('border-l-8', estadoIncidencia(r) === 'abiertas' ? 'border-l-fila-incidencia-brd' : estadoIncidencia(r) === 'cerradas' ? 'border-l-fila-reparado-brd' : 'border-l-transparent')}
        menuFila={(r, celda) => <MenuHistorial rep={r} celda={celda} texto={textoCeldaTrabajo(r, celda.columnaId, 'yyyy/MM/dd')} puedeEditar={puedeEditar} acciones={acciones} />}
      />
      <EtiquetaActualizado actualizadoEn={dataUpdatedAt} onRecargar={() => refetch({ throwOnError: true })} />
      {dialogos}
    </div>
  )
}
