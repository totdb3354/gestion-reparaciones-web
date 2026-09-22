import { useMemo, useState } from 'react'
import { hoyMadrid } from '@/shared/lib/fechas'
import { BotonPrimario } from '@/shared/ui/Botones'
import { DataTable } from '@/shared/ui/DataTable'
import { EtiquetaActualizado } from '@/shared/ui/EtiquetaActualizado'
import { PildoraContador } from '@/shared/ui/PildoraContador'
import { useTecnicos } from '../api'
import { etiquetaContador } from '../lib/filtros'
import { useAsignacionesTodas } from './api'
import { claseFilaAsignacion, crearColumnas } from './columnas'
import { aplicarFiltros, FILTROS_VACIOS } from './filtros'

/** Tope del contador, calco de actualizarContador() del JavaFX ("999+ asignaciones"). */
const TOPE_CONTADOR = 999
/** El modal "Asignar trabajos" es el sub-proyecto 3b; hasta entonces el botón existe en su sitio pero no abre nada. */
const TOOLTIP_ASIGNAR = 'Disponible en el siguiente sub-proyecto'

/**
 * Vista de asignaciones pendientes del supertécnico (spec 3a): las tres categorías en una sola tabla, sin ordenación
 * por columna (D5). La lista llega ya ordenada por `useAsignacionesTodas`, así que aquí solo se filtra.
 */
export function AsignacionesPage() {
  const { data = [], dataUpdatedAt, refetch } = useAsignacionesTodas()
  // Los técnicos del desplegable de la celda son los activos, como el `getAllActivos()` del combo del JavaFX.
  const { data: tecnicos = [] } = useTecnicos(true)
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  // Se recalcula en cada render (como en PendientesPage): si se congelase en un useMemo sin depender de nada, los
  // badges de entrega de glass se quedarían diciendo "Llegó HH:mm" pasada la medianoche con la pestaña abierta.
  const hoy = hoyMadrid()

  // El contador de la cabecera cuenta las filas ya filtradas (spec §9); el badge del lateral sigue siendo el total.
  const visibles = useMemo(() => aplicarFiltros(data, FILTROS_VACIOS), [data])

  const columnas = useMemo(
    () => crearColumnas({ soloLectura: false, tecnicos, onReasignar: () => {}, onBorrar: () => {}, hoy }),
    [tecnicos, hoy],
  )

  return (
    <div className="p-10">
      <div className="mb-3 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Asignaciones pendientes</h1>
        <PildoraContador texto={etiquetaContador(visibles.length, 'asignación', 'asignaciones', TOPE_CONTADOR)} />
      </div>
      {/* Fila del "Asignar" del FlowPane del JavaFX; los cinco filtros que lo preceden llegan en la Task 9. */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {/* El tooltip va en el envoltorio: un botón deshabilitado no recibe el hover (mismo patrón que los botones
            reservados para Almacén del panel de notificaciones). */}
        <span title={TOOLTIP_ASIGNAR} className="inline-block">
          <BotonPrimario disabled className="pointer-events-none">Asignar</BotonPrimario>
        </span>
      </div>
      <DataTable
        columns={columnas}
        data={visibles}
        vacio="No hay asignaciones pendientes"
        getRowId={(r) => r.idRep}
        seleccionada={seleccionada}
        onSeleccionar={setSeleccionada}
        filaClase={claseFilaAsignacion}
      />
      <EtiquetaActualizado actualizadoEn={dataUpdatedAt} onRecargar={() => refetch({ throwOnError: true })} />
    </div>
  )
}
