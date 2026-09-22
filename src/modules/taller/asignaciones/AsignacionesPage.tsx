import { useEffect, useMemo, useState } from 'react'
import type { ReparacionResumen } from '@/shared/api/client'
import { hoyMadrid } from '@/shared/lib/fechas'
import { BotonPrimario, BotonSecundario } from '@/shared/ui/Botones'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/DataTable'
import { EtiquetaActualizado } from '@/shared/ui/EtiquetaActualizado'
import { PildoraContador } from '@/shared/ui/PildoraContador'
import { useTecnicos } from '../api'
import { opcionesCliente } from '../imeis/agrupacion'
import { etiquetaContador } from '../lib/filtros'
import { useAsignacionesTodas, useBorrarAsignacion } from './api'
import { BarraFiltros } from './BarraFiltros'
import { CargaTecnicosDialog } from './CargaTecnicosDialog'
import { claseFilaAsignacion, crearColumnas } from './columnas'
import { useEditores } from './editores/useEditores'
import { aplicarFiltros, FILTROS_VACIOS, type EstadoFiltros } from './filtros'
import { MenuAsignacion } from './MenuAsignacion'
import { TecnicosGlassDialog } from './TecnicosGlassDialog'
import { useAccionConDeshacer } from './useAccionConDeshacer'

/** Tope del contador, calco de actualizarContador() del JavaFX ("999+ asignaciones"). */
const TOPE_CONTADOR = 999
/** El modal "Asignar trabajos" es el sub-proyecto 3b; hasta entonces el botón existe en su sitio pero no abre nada. */
const TOOLTIP_ASIGNAR = 'Disponible en el siguiente sub-proyecto'
/** El modo solo lectura del ADMIN es la Task 17; hasta entonces la vista es siempre la del supertécnico. */
const SOLO_LECTURA = false
/** El aviso de interacción (D4) lo consume la Task 16, que congelará el sondeo; aquí solo se emite. Constante de
 *  módulo, no una función nueva en cada render: MenuAsignacion la usa como dependencia de su efecto. La anotación de
 *  tipo (en vez de un parámetro `abierto` sin usar) es lo que permite invocarla con un booleano desde el efecto del
 *  borrado sin que el linter la marque como argumento sin usar. */
const SIN_CONSUMIDOR: (abierto: boolean) => void = () => {}

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
  // La papelera de la última columna (calco de PendientesPage): la rama de tres endpoints según el tipo vive en
  // `useBorrarAsignacion` (./api), aquí solo se le pasa la fila. El diálogo también cuenta para D4: mientras esté
  // abierto el sondeo debe congelarse, o la recarga movería la fila bajo el cursor y confirmaría sobre otra.
  const [aBorrar, setABorrar] = useState<ReparacionResumen | null>(null)
  // La ventana de carga del JavaFX: su consulta es independiente de la de la tabla, así que si falla una la otra
  // sigue en pie (spec §14). Solo se pide con la ventana abierta.
  const [cargaAbierta, setCargaAbierta] = useState(false)
  // El diálogo de técnicos de glass: se lleva la consulta de técnicos dentro, que es la misma que ya usa la vista.
  const [glassAbierto, setGlassAbierto] = useState(false)
  const borrarAsignacion = useBorrarAsignacion()
  useEffect(() => {
    if (!aBorrar) return
    SIN_CONSUMIDOR(true)
    return () => SIN_CONSUMIDOR(false)
  }, [aBorrar])
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
    () => crearColumnas({ soloLectura: SOLO_LECTURA, tecnicos, ejecutar, onInteraccion: SIN_CONSUMIDOR, onBorrar: setABorrar, hoy }),
    [tecnicos, ejecutar, hoy],
  )

  return (
    <div className="p-10">
      <div className="mb-3 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Asignaciones pendientes</h1>
        <PildoraContador texto={etiquetaContador(visibles.length, 'asignación', 'asignaciones', TOPE_CONTADOR)} />
      </div>
      {/* Los dos botones de ventana van arriba a la derecha, en su propia fila POR ENCIMA de la barra de filtros
          (captura asig-lista: los dos a la misma altura, sobre los filtros), no en la fila de "Asignar". El orden
          entre ellos es el del FXML: "Técnicos de glass" antes que "Carga técnicos". */}
      <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
        <BotonSecundario onClick={() => setGlassAbierto(true)}>Técnicos de glass</BotonSecundario>
        <BotonSecundario onClick={() => setCargaAbierta(true)}>Carga técnicos</BotonSecundario>
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
      {/* Calco literal de ConfirmDialog.mostrar (PendientesSuperTecnicoController:596-600): sin motivo, a diferencia
          del borrado con justificación de useAccionesTrabajo. La rama de qué endpoint usar vive en
          `useBorrarAsignacion`, no aquí. */}
      <ConfirmDialog
        abierto={aBorrar !== null}
        titulo={`Borrar asignación ${aBorrar?.idRep ?? ''}`}
        descripcion={
          aBorrar?.esIncidencia
            ? 'El técnico dejará de verla en su lista de pendientes y la incidencia se marcará como no activa en la tabla principal.'
            : 'El técnico dejará de verla en su lista de pendientes.'
        }
        textoAccion="Borrar asignación"
        onCancelar={() => setABorrar(null)}
        onConfirmar={() => {
          const fila = aBorrar
          if (!fila) return
          setABorrar(null)
          borrarAsignacion.mutate({ fila })
        }}
      />
      {/* Pulsar una fila cierra la ventana y deja el filtro de técnico puesto en ese técnico EN SOLITARIO (calco
          del JavaFX: `idsTecFiltro.clear()` antes de añadirlo); el resto de filtros se queda como estaba. */}
      <CargaTecnicosDialog
        abierto={cargaAbierta}
        onCerrar={() => setCargaAbierta(false)}
        onFiltrarPorTecnico={(idTec) => setFiltros((f) => ({ ...f, tecnicos: [idTec] }))}
        onInteraccion={SIN_CONSUMIDOR}
      />
      {/* Quién entra en la glass automática: al aceptar solo se mandan los cambios, y si alguno falla el diálogo
          se queda abierto con el aviso. Para el ADMIN los checks van deshabilitados (Task 17 enciende SOLO_LECTURA). */}
      <TecnicosGlassDialog
        abierto={glassAbierto}
        soloLectura={SOLO_LECTURA}
        onCerrar={() => setGlassAbierto(false)}
        onInteraccion={SIN_CONSUMIDOR}
      />
      {aviso}
      {dialogos}
    </div>
  )
}
