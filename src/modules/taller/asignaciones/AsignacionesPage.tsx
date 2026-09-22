import { useEffect, useMemo, useState } from 'react'
import type { ReparacionResumen } from '@/shared/api/client'
import { hoyMadrid } from '@/shared/lib/fechas'
import { useSession } from '@/shared/session/SessionProvider'
import { esAdmin } from '@/shared/session/storage'
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
import { useInteraccionesAbiertas } from './useInteraccionesAbiertas'

/** Tope del contador, calco de actualizarContador() del JavaFX ("999+ asignaciones"). */
const TOPE_CONTADOR = 999
/** El modal "Asignar trabajos" es el sub-proyecto 3b; hasta entonces el botón existe en su sitio pero no abre nada. */
const TOOLTIP_ASIGNAR = 'Disponible en el siguiente sub-proyecto'

/**
 * Vista de asignaciones pendientes del supertécnico (spec 3a): las tres categorías en una sola tabla, sin ordenación
 * por columna (D5). La lista llega ya ordenada por `useAsignacionesTodas`, así que aquí solo se filtra.
 */
export function AsignacionesPage() {
  // La ruta la abren SUPERTECNICO y ADMIN (D6), y el ADMIN entra en solo lectura: sin "Asignar", sin papelera, sin
  // reasignar y sin tocar los técnicos de glass (spec §12). Es la capa visible, nada más: las escrituras que la
  // vista usa ya exigen el rol en el servidor, así que ocultar los controles es comodidad, no la protección.
  const { sesion } = useSession()
  const soloLectura = esAdmin(sesion)
  // D4: mientras haya un menú, un desplegable, un editor o una de las dos ventanas abiertos, el sondeo se
  // congela. `marcar` es estable entre renders (useInteraccionesAbiertas lo memoiza sin dependencias), y eso es lo
  // que exigen BarraFiltros, MenuAsignacion, useEditores y el efecto del borrado: lo llevan en las dependencias de
  // su efecto, y con una identidad nueva por render el aviso parpadearía false→true y descongelaría el sondeo a
  // ratos, justo mientras el usuario interactúa.
  const { hayAlguna, marcar } = useInteraccionesAbiertas()
  const { data = [], dataUpdatedAt, refetch } = useAsignacionesTodas({ activo: !hayAlguna })
  // Urgente y chasis se escriben al instante, como en el JavaFX, pero con unos segundos para deshacerlo (D2). El hook
  // vive aquí y no en el menú: el menú se desmonta al cerrarse y se llevaría el aviso por delante.
  const { ejecutar, aviso } = useAccionConDeshacer()
  // Los tres editores del menú contextual, con sus diálogos: viven aquí por el mismo motivo que el aviso de
  // deshacer, porque el menú se desmonta al elegir el ítem y se llevaría el diálogo por delante.
  const { editarComentario, editarModelo, editarCliente, dialogos } = useEditores({ onInteraccion: marcar })
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
    marcar(true)
    return () => marcar(false)
  }, [aBorrar, marcar])
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
    () => crearColumnas({ soloLectura, tecnicos, ejecutar, onInteraccion: marcar, onBorrar: setABorrar, hoy }),
    [soloLectura, tecnicos, ejecutar, marcar, hoy],
  )

  return (
    <div className="p-10">
      {/* Calco del único HBox del FXML, que lleva la fila entera: título · pastilla del contador · hueco elástico
          (el `Region HBox.hgrow="ALWAYS"`, aquí el `ml-auto` del primer botón) · "Técnicos de glass" · "Carga
          técnicos". El `spacing="12"` del HBox es el `gap-3`. `flex-wrap` para que en pantallas estrechas los
          botones bajen en vez de comerse el título. */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Asignaciones pendientes</h1>
        <PildoraContador texto={etiquetaContador(visibles.length, 'asignación', 'asignaciones', TOPE_CONTADOR)} />
        <BotonSecundario className="ml-auto" onClick={() => setGlassAbierto(true)}>Técnicos de glass</BotonSecundario>
        <BotonSecundario onClick={() => setCargaAbierta(true)}>Carga técnicos</BotonSecundario>
      </div>
      {/* Filtrado en memoria sobre lo ya cargado (spec 3a, D7): ningún control vuelve al servidor.
          `onInteraccion` es el aviso de desplegable abierto, que congela el sondeo mientras esté desplegado. */}
      <BarraFiltros valor={filtros} onCambio={setFiltros} tecnicos={tecnicos} clientes={clientes} onInteraccion={marcar} />
      {/* El "Asignar" del FlowPane del JavaFX va en su propia fila: con los cinco filtros delante, en una sola
          quedaría cortado en cuanto la ventana se estrecha. Para el ADMIN no existe (spec §12): la fila entera
          desaparece, no se queda un botón muerto. */}
      {!soloLectura && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {/* El tooltip va en el envoltorio: un botón deshabilitado no recibe el hover (mismo patrón que los botones
              reservados para Almacén del panel de notificaciones). */}
          <span title={TOOLTIP_ASIGNAR} className="inline-block">
            <BotonPrimario disabled className="pointer-events-none">Asignar</BotonPrimario>
          </span>
        </div>
      )}
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
            soloLectura={soloLectura}
            ejecutar={ejecutar}
            onEditarComentario={editarComentario}
            onEditarModelo={editarModelo}
            onEditarCliente={editarCliente}
            onInteraccion={marcar}
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
        onInteraccion={marcar}
      />
      {/* Quién entra en la glass automática: al aceptar solo se mandan los cambios, y si alguno falla el diálogo
          se queda abierto con el aviso. Para el ADMIN los checks van deshabilitados y solo queda "Cerrar". */}
      <TecnicosGlassDialog
        abierto={glassAbierto}
        soloLectura={soloLectura}
        onCerrar={() => setGlassAbierto(false)}
        onInteraccion={marcar}
      />
      {aviso}
      {dialogos}
    </div>
  )
}
