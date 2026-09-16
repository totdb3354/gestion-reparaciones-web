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
import { OPCIONES_INCIDENCIAS, TOGGLES_HISTORIAL } from './constantes'
import { cabecerasHistorial, filaHistorial } from './csvTrabajos'

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
        // "Asignado por" no es copiable en el Historial (docs/paridad/historial.md, "Común a los tres toggles" no
        // la lista entre las columnas copiables: ReparacionControllerSuperTecnico.textoDeCelda no tiene ese case).
        // Sí lo es en el Agrupado de IMEIs (Task 18), que reutiliza este mismo textoCeldaTrabajo: se suprime aquí,
        // en la llamada, en vez de en la función compartida.
        menuFila={(r, celda) => <MenuHistorial rep={r} celda={celda} texto={celda.columnaId === 'asignadoPor' ? null : textoCeldaTrabajo(r, celda.columnaId, 'yyyy/MM/dd')} puedeEditar={puedeEditar} acciones={acciones} />}
      />
      <EtiquetaActualizado actualizadoEn={dataUpdatedAt} onRecargar={() => refetch({ throwOnError: true })} />
      {dialogos}
    </div>
  )
}
