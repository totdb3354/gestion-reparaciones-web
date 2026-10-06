import { useCallback, useEffect, useReducer, useRef, type RefObject } from 'react'
import { NavigationType, useBlocker } from 'react-router'
import type { AsignacionActiva } from '@/shared/api/client'
import { esErrorGestionadoGlobalmente, mensajeDeError } from '@/shared/api/errors'
import { useSession } from '@/shared/session/SessionProvider'
import { conEntorno } from '@/shared/lib/entorno'
import { useAvisoAlSalir } from '@/shared/lib/useAvisoAlSalir'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog'
import { useCargaEditar, useCargaNuevo, useRecargarAlCerrar } from './api'
import { CabeceraFormulario } from './CabeceraFormulario'
import { DialogoSalirSinGuardar } from './DialogoSalirSinGuardar'
import { estadoInicial, filasVisibles, hayCambiosSinGuardar, reducir, textoConflicto, tituloPestana, type DatosEditar, type DatosNuevo } from './estado'
import { FilaComponente } from './FilaComponente'
import { OtrasAcciones } from './OtrasAcciones'
import { SubFilaAgotado } from './SubFilaAgotado'
import { useBorrador } from './useBorrador'
import { useGuardado } from './useGuardado'
import { ZonaGuardar } from './ZonaGuardar'

type Props =
  | { modo: 'nuevo' | 'glass'; idAsignacion: string; onCerrar: () => void }
  | { modo: 'editar'; idRep: string; onCerrar: () => void }

/** Lo que necesita el formulario ya cargado. `CargaNuevo` (W10) tiene esta misma forma; la edición la compone sin asignaciones
 *  activas (no hay banda de conflicto) ni borrador. */
type CargaFormulario = { datos: DatosNuevo | DatosEditar; asignacionesActivas: AsignacionActiva[]; borradorJson: string | null }

/** Cabecera de columnas: mismos anchos que las celdas de cada fila (la observación, 280 fijo). El botón derecho no tiene columna. */
const COLUMNAS = [
  { texto: 'Unit (+/-)', clase: 'w-[70px]' },
  { texto: 'Componente', clase: 'w-[100px]' },
  { texto: 'SKU', clase: 'w-[170px]' },
  { texto: 'Stock', clase: 'w-[70px] text-center' },
  { texto: '¿Reutilizado?', clase: 'w-[110px]' },
  { texto: 'Observación', clase: 'w-[280px]' },
] as const

/** El formulario de reparación como diálogo modal sobre la lista. La URL lo gobierna: quien lo monta (formulario/rutas.tsx)
 *  decide a dónde se vuelve en `onCerrar`. Sin hooks aquí: cada modo tiene su cargador (el flujo nuevo y el de glass comparten
 *  el suyo: `cargarNuevo` deduce la categoría del prefijo de la asignación). */
export function FormularioReparacion(props: Props) {
  if (props.modo === 'editar') return <FormularioEditar idRep={props.idRep} onCerrar={props.onCerrar} />
  return <FormularioNuevo idAsignacion={props.idAsignacion} onCerrar={props.onCerrar} />
}

/** Común a las dos cargas. (1) Al cerrar —✕, Escape, Atrás, "Salir sin guardar" o tras guardar— se recarga la lista de debajo:
 *  se hace al desmontar, que es lo único que tienen en común todas las salidas. (2) La carga va con meta.silenciarError: el
 *  aviso lo da esta vista y después vuelve a la lista (403 → mensaje genérico de permisos; 404 o detalle vacío → "Recurso no
 *  encontrado."); 401 y corte de conexión ya los gestiona el shell: ahí solo se cierra. Las refs evitan depender de la
 *  identidad de las funciones en cada render. */
function useCierreDeCarga(falla: boolean, error: unknown, onCerrar: () => void) {
  const { mostrarError } = useAlerta()
  const recargar = useRecargarAlCerrar()
  const recargarRef = useRef(recargar)
  const onCerrarRef = useRef(onCerrar)
  useEffect(() => {
    recargarRef.current = recargar
    onCerrarRef.current = onCerrar
  })
  useEffect(() => () => recargarRef.current(), [])
  useEffect(() => {
    if (!falla) return
    if (!esErrorGestionadoGlobalmente(error)) mostrarError(mensajeDeError(error))
    onCerrarRef.current()
  }, [falla, error, mostrarError])
}

function FormularioNuevo({ idAsignacion, onCerrar }: { idAsignacion: string; onCerrar: () => void }) {
  const carga = useCargaNuevo(idAsignacion)
  useCierreDeCarga(carga.isError, carga.error, onCerrar)
  if (!carga.data) return null
  // El reductor se monta solo con la carga terminada: `key` evita reinicializarlo con datos de otra asignación.
  return <FormularioCargado key={idAsignacion} carga={carga.data} onCerrar={onCerrar} />
}

/** Carga de la edición: detalle → agrupados + ya reparados + acciones ya reparadas. Sin banda de conflicto, incidencia,
 *  solicitudes, borrador ni consulta del modelo del teléfono. Si el detalle llega vacío (la reparación ya no existe) la carga
 *  rechaza con NoEncontradoError: el formulario no llega a pintarse, sale el aviso y se vuelve a la lista. */
function FormularioEditar({ idRep, onCerrar }: { idRep: string; onCerrar: () => void }) {
  const carga = useCargaEditar(idRep)
  useCierreDeCarga(carga.isError, carga.error, onCerrar)
  if (!carga.data) return null
  return <FormularioCargado key={idRep} carga={{ datos: carga.data, asignacionesActivas: [], borradorJson: null }} onCerrar={onCerrar} />
}

/** Todos los cierres de la edición son navegaciones (✕ y Escape navegan a la lista con replace; Atrás es un POP): un único
 *  bloqueo las cubre. Bloquea solo si la zona de guardar está visible ("hay cambios") y no se acaba de guardar. Un cambio
 *  inválido oculta la zona, así que cerrar en ese estado no pregunta y el cambio se pierde (calco de la referencia). Vive en
 *  un componente aparte que solo se monta en edición (`useBlocker` exige data router, como el de app/router.tsx). */
function GuardiaSalida({ hayCambios, salidaLibre }: { hayCambios: boolean; salidaLibre: RefObject<boolean> }) {
  const blocker = useBlocker(() => hayCambios && !salidaLibre.current)
  return <DialogoSalirSinGuardar abierto={blocker.state === 'blocked'} onSalir={() => blocker.proceed?.()} onCancelar={() => blocker.reset?.()} />
}

/** Flujo nuevo y Glass: Atrás (y Adelante) del navegador hacen lo mismo que la ✕: se para la navegación, se vuelca el
 *  borrador en ese momento y se sigue sin preguntar. ✕, Escape y el cierre tras guardar navegan con replace y no pasan por
 *  aquí (ya han volcado o descartado el borrador). */
function GuardiaAtras({ volcarAhora }: { volcarAhora: () => Promise<void> }) {
  const blocker = useBlocker(({ historyAction }) => historyAction === NavigationType.Pop)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    void volcarAhora()
    blocker.proceed()
  }, [blocker, volcarAhora])
  return null
}

function FormularioCargado({ carga, onCerrar }: { carga: CargaFormulario; onCerrar: () => void }) {
  const { sesion } = useSession()
  const [estado, dispatch] = useReducer(reducir, carga.datos, estadoInicial)
  const titulo = tituloPestana(estado)
  // En edición no hay asignación propia ni activas: textoConflicto([], …) da null y la banda no se pinta.
  const conflicto = textoConflicto(carga.asignacionesActivas, estado.idAsignacion ?? '', sesion?.idTec ?? null)
  // Borrador: solo flujo nuevo y Glass; en edición el hook queda inactivo y no llama a nada.
  const { sinVolcar, volcarAhora, descartar } = useBorrador({ estado, dispatch, borradorJson: carga.borradorJson, activo: estado.modo !== 'editar' })
  /** ✕ y Escape. Flujo nuevo y Glass: nunca pregunta; vuelca el borrador YA y cierra sin esperar a la red. Edición: `volcarAhora`
   *  no hace nada y `onCerrar` navega; si hay cambios, GuardiaSalida intercepta esa navegación y abre "Salir sin guardar". */
  const cerrar = useCallback(() => {
    void volcarAhora()
    onCerrar()
  }, [volcarAhora, onCerrar])
  // Tras un guardado con éxito se sale sin preguntar aunque el estado siga diciendo "hay cambios".
  const salidaLibre = useRef(false)
  const alGuardar = useCallback(() => {
    salidaLibre.current = true
    onCerrar()
  }, [onCerrar])
  // Guardar de verdad no vuelca: borra el borrador (antesDeCerrar; en edición no llama a nada) y cierra con el onCerrar de las props.
  const guardado = useGuardado({ estado, dispatch, onGuardado: alGuardar, antesDeCerrar: descartar })
  // F5, cerrar la pestaña o salir de la web: en edición, con cambios sin guardar; en flujo nuevo y Glass, con cambios que aún
  // no han llegado al borrador (los 2 s del autoguardado).
  useAvisoAlSalir(estado.modo === 'editar' ? hayCambiosSinGuardar(estado) : sinVolcar)

  // El título de la ventana del JavaFX pasa a ser el de la pestaña; al cerrar vuelve el que había. En preprod, con "[PRE] ".
  useEffect(() => {
    const anterior = document.title
    document.title = conEntorno(titulo)
    return () => {
      document.title = anterior
    }
  }, [titulo])

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) cerrar() }}>
      {/* max-w-none anula el max-w de DialogContent. Pulsar fuera no cierra: la ventana del JavaFX solo se cerraba con su ✕.
          Nunca más alto ni más ancho que la ventana: la cabecera y la zona de guardar quedan siempre a la vista y lo que se
          desplaza es el cuerpo (filas y OTRAS ACCIONES). Por debajo de 960 px de ancho, el marco se desplaza en horizontal. */}
      <DialogContent
        aria-label={titulo}
        aria-describedby={undefined}
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex h-[calc(100vh-48px)] max-h-[calc(100vh-48px)] w-[calc(100vw-48px)] max-w-none flex-col gap-0 overflow-x-auto overflow-y-hidden rounded-none border-0 bg-fondo-vista p-0"
      >
        <DialogTitle className="sr-only">{titulo}</DialogTitle>
        <div data-testid="formulario-marco" className="flex min-h-0 min-w-[960px] flex-1 flex-col">
          <CabeceraFormulario estado={estado} conflicto={conflicto} dispatch={dispatch} onCerrar={cerrar} />
          <div className="flex border-b border-form-cabecera-brd bg-form-cabecera-bg">
            {COLUMNAS.map((c) => (
              <span key={c.texto} className={`${c.clase} shrink-0 px-2.5 py-1.5 text-[12px] text-azul-gris`}>
                {c.texto}
              </span>
            ))}
          </div>
          {/* Filas y OTRAS ACCIONES desplazan juntas; el hueco flexible empuja la zona de guardar al fondo. */}
          <div data-testid="formulario-cuerpo" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {filasVisibles(estado) ? (
              estado.filas.map((fila) => (
                <FilaComponente key={fila.prefijo} estado={estado} fila={fila} dispatch={dispatch} onGuardarFila={guardado.guardarFila}>
                  <SubFilaAgotado estado={estado} fila={fila} dispatch={dispatch} />
                </FilaComponente>
              ))
            ) : (
              <p className="py-10 text-center text-[13px] text-azul-gris">Selecciona un modelo de iPhone para continuar</p>
            )}
            <OtrasAcciones estado={estado} dispatch={dispatch} onGuardarAccion={guardado.guardarAccion} />
          </div>
          <ZonaGuardar estado={estado} onPulsar={guardado.pulsarGuardar} />
        </div>
        {estado.modo === 'editar' ? <GuardiaSalida hayCambios={hayCambiosSinGuardar(estado)} salidaLibre={salidaLibre} /> : <GuardiaAtras volcarAhora={volcarAhora} />}
      </DialogContent>
    </Dialog>
  )
}
