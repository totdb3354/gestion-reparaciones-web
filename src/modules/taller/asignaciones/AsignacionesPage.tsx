import { useMemo, useState } from 'react'
import { hoyMadrid } from '@/shared/lib/fechas'
import { BotonPrimario } from '@/shared/ui/Botones'
import { DataTable } from '@/shared/ui/DataTable'
import { EtiquetaActualizado } from '@/shared/ui/EtiquetaActualizado'
import { PildoraContador } from '@/shared/ui/PildoraContador'
import { useTecnicos } from '../api'
import { opcionesCliente } from '../imeis/agrupacion'
import { etiquetaContador } from '../lib/filtros'
import { useAsignacionesTodas } from './api'
import { BarraFiltros } from './BarraFiltros'
import { claseFilaAsignacion, crearColumnas } from './columnas'
import { useEditores } from './editores/useEditores'
import { aplicarFiltros, FILTROS_VACIOS, type EstadoFiltros } from './filtros'
import { MenuAsignacion } from './MenuAsignacion'
import { useAccionConDeshacer } from './useAccionConDeshacer'

/** Tope del contador, calco de actualizarContador() del JavaFX ("999+ asignaciones"). */
const TOPE_CONTADOR = 999
/** El modal "Asignar trabajos" es el sub-proyecto 3b; hasta entonces el botón existe en su sitio pero no abre nada. */
const TOOLTIP_ASIGNAR = 'Disponible en el siguiente sub-proyecto'
/** El modo solo lectura del ADMIN es la Task 17; hasta entonces la vista es siempre la del supertécnico. */
const SOLO_LECTURA = false
/** El aviso de interacción (D4) lo consume la Task 16, que congelará el sondeo; aquí solo se emite. Constante de
 *  módulo, no una función nueva en cada render: MenuAsignacion la usa como dependencia de su efecto. */
const SIN_CONSUMIDOR = () => {}

/**
 * Vista de asignaciones pendientes del supertécnico (spec 3a): las tres categorías en una sola tabla, sin ordenación
 * por columna (D5). La lista llega ya ordenada por `useAsignacionesTodas`, así que aquí solo se filtra.
 */
export function AsignacionesPage() {
  const { data = [], dataUpdatedAt, refetch } = useAsignacionesTodas()
  // Urgente y chasis se escriben al instante, como en el JavaFX, pero con unos segundos para deshacerlo (D2). El hook
  // vive aquí y no en el menú: el menú se desmonta al cerrarse y se llevaría el aviso por delante.
  const { ejecutar, aviso } = useAccionConDeshacer()
  // Los tres editores del menú contextual, con sus diálogos: viven aquí por el mismo motivo que el aviso de
  // deshacer, porque el menú se desmonta al elegir el ítem y se llevaría el diálogo por delante.
  const { editarComentario, editarModelo, editarCliente, dialogos } = useEditores({ onInteraccion: SIN_CONSUMIDOR })
  // Los técnicos del desplegable de la celda son los activos, como el `getAllActivos()` del combo del JavaFX.
  const { data: tecnicos = [] } = useTecnicos(true)
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<EstadoFiltros>(FILTROS_VACIOS)
  // Se recalcula en cada render (como en PendientesPage): si se congelase en un useMemo sin depender de nada, los
  // badges de entrega de glass se quedarían diciendo "Llegó HH:mm" pasada la medianoche con la pestaña abierta.
  const hoy = hoyMadrid()

  // El contador de la cabecera cuenta las filas ya filtradas (spec §9); el badge del lateral sigue siendo el total.
  const visibles = useMemo(() => aplicarFiltros(data, filtros), [data, filtros])
  // Los clientes del desplegable son los presentes en lo cargado, no un catálogo: se repueblan en cada carga
  // (calco de cargarClientes() del JavaFX). Reutiliza el helper del maestro de IMEIs, que ya hace eso mismo.
  const clientes = useMemo(() => opcionesCliente(data), [data])

  // `ejecutar` es el mismo que recibe el menú contextual: un único aviso para toda la vista, venga la escritura de
  // la celda de técnico o del menú.
  const columnas = useMemo(
    () => crearColumnas({ soloLectura: SOLO_LECTURA, tecnicos, ejecutar, onInteraccion: SIN_CONSUMIDOR, onBorrar: () => {}, hoy }),
    [tecnicos, ejecutar, hoy],
  )

  return (
    <div className="p-10">
      <div className="mb-3 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Asignaciones pendientes</h1>
        <PildoraContador texto={etiquetaContador(visibles.length, 'asignación', 'asignaciones', TOPE_CONTADOR)} />
      </div>
      {/* Filtrado en memoria sobre lo ya cargado (spec 3a, D7): ningún control vuelve al servidor.
          `onInteraccion` es el aviso de desplegable abierto que congelará el sondeo; lo conecta la Task 16. */}
      <BarraFiltros valor={filtros} onCambio={setFiltros} tecnicos={tecnicos} clientes={clientes} onInteraccion={SIN_CONSUMIDOR} />
      {/* El "Asignar" del FlowPane del JavaFX va en su propia fila: con los cinco filtros delante, en una sola
          quedaría cortado en cuanto la ventana se estrecha. */}
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
        menuFila={(fila, celda) => (
          <MenuAsignacion
            fila={fila}
            celda={celda}
            soloLectura={SOLO_LECTURA}
            ejecutar={ejecutar}
            onEditarComentario={editarComentario}
            onEditarModelo={editarModelo}
            onEditarCliente={editarCliente}
            onInteraccion={SIN_CONSUMIDOR}
          />
        )}
      />
      <EtiquetaActualizado actualizadoEn={dataUpdatedAt} onRecargar={() => refetch({ throwOnError: true })} />
      {aviso}
      {dialogos}
    </div>
  )
}
