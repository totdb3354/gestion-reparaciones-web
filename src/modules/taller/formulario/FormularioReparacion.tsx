import { useEffect, useReducer, useRef } from 'react'
import { esErrorGestionadoGlobalmente, mensajeDeError } from '@/shared/api/errors'
import { useSession } from '@/shared/session/SessionProvider'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog'
import { useCargaNuevo, useRecargarAlCerrar, type CargaNuevo } from './api'
import { CabeceraFormulario } from './CabeceraFormulario'
import { estadoInicial, filasVisibles, reducir, textoConflicto, tituloPestana } from './estado'
import { FilaComponente } from './FilaComponente'
import { OtrasAcciones } from './OtrasAcciones'
import { SubFilaAgotado } from './SubFilaAgotado'
import { useGuardado } from './useGuardado'
import { ZonaGuardar } from './ZonaGuardar'

type Props =
  | { modo: 'nuevo' | 'glass'; idAsignacion: string; onCerrar: () => void }
  | { modo: 'editar'; idRep: string; onCerrar: () => void }

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
 *  decide a dónde se vuelve en `onCerrar`. El flujo nuevo y el de glass comparten carga (`cargarNuevo` deduce la categoría
 *  del prefijo de la asignación); la edición tiene su propia carga y su propia ruta, y hasta que exista no pinta nada. */
export function FormularioReparacion(props: Props) {
  if (props.modo === 'editar') return null
  return <FormularioNuevo idAsignacion={props.idAsignacion} onCerrar={props.onCerrar} />
}

function FormularioNuevo({ idAsignacion, onCerrar }: { idAsignacion: string; onCerrar: () => void }) {
  const carga = useCargaNuevo(idAsignacion)
  const { mostrarError } = useAlerta()

  // Al cerrar —✕, Escape, Atrás o tras guardar— se recarga la lista de debajo: se hace al desmontar, que es lo único que
  // tienen en común las cuatro salidas. La ref evita depender de la identidad de la función en cada render.
  const recargar = useRecargarAlCerrar()
  const recargarRef = useRef(recargar)
  const onCerrarRef = useRef(onCerrar)
  useEffect(() => {
    recargarRef.current = recargar
    onCerrarRef.current = onCerrar
  })
  useEffect(() => () => recargarRef.current(), [])

  // La carga va con meta.silenciarError: el aviso lo da esta vista y después vuelve a la lista. 401 y corte de conexión ya
  // los gestiona el shell (redirección a login y banner): ahí solo se cierra.
  useEffect(() => {
    if (!carga.isError) return
    if (!esErrorGestionadoGlobalmente(carga.error)) mostrarError(mensajeDeError(carga.error))
    onCerrarRef.current()
  }, [carga.isError, carga.error, mostrarError])

  if (!carga.data) return null
  // El reductor se monta solo con la carga terminada: `key` evita reinicializarlo con datos de otra asignación.
  return <FormularioCargado key={idAsignacion} carga={carga.data} onCerrar={onCerrar} />
}

function FormularioCargado({ carga, onCerrar }: { carga: CargaNuevo; onCerrar: () => void }) {
  const { sesion } = useSession()
  const [estado, dispatch] = useReducer(reducir, carga.datos, estadoInicial)
  const titulo = tituloPestana(estado)
  const conflicto = textoConflicto(carga.asignacionesActivas, carga.datos.idAsignacion, sesion?.idTec ?? null)
  // Guardar (fila a fila, acción a acción, o "Terminar asignación") cierra el formulario igual que ✕: la recarga de la lista
  // la hace el desmontaje.
  const guardado = useGuardado({ estado, dispatch, onGuardado: onCerrar })

  // El título de la ventana del JavaFX pasa a ser el de la pestaña; al cerrar vuelve el que había.
  useEffect(() => {
    const anterior = document.title
    document.title = titulo
    return () => {
      document.title = anterior
    }
  }, [titulo])

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) onCerrar() }}>
      {/* max-w-none y sm:max-w-none anulan el max-w y el sm:max-w-lg de DialogContent (tailwind-merge no descarta la variante
          con modificador si no se repite). Pulsar fuera no cierra: la ventana del JavaFX solo se cerraba con su ✕. */}
      <DialogContent
        aria-label={titulo}
        aria-describedby={undefined}
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex h-[calc(100vh-48px)] min-h-[700px] w-[calc(100vw-48px)] max-w-none min-w-[960px] flex-col gap-0 overflow-hidden rounded-none border-0 bg-fondo-vista p-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{titulo}</DialogTitle>
        <CabeceraFormulario estado={estado} conflicto={conflicto} dispatch={dispatch} onCerrar={onCerrar} />
        <div className="flex border-b border-form-cabecera-brd bg-form-cabecera-bg">
          {COLUMNAS.map((c) => (
            <span key={c.texto} className={`${c.clase} shrink-0 px-2.5 py-1.5 text-[12px] text-azul-gris`}>
              {c.texto}
            </span>
          ))}
        </div>
        {/* Filas y OTRAS ACCIONES desplazan juntas; el hueco flexible empuja la zona de guardar al fondo. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
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
      </DialogContent>
    </Dialog>
  )
}
