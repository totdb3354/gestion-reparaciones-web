import { useEffect, useRef, type Dispatch } from 'react'
import { anadirAccionHabilitado, contadorAcciones, otrasAccionesVisible, type AccionFormulario, type EstadoFormulario } from './estado'

type Props = { estado: EstadoFormulario; dispatch: Dispatch<AccionFormulario>; onGuardarAccion: (id: number) => void }

/** Sección OTRAS ACCIONES (igual en reparación y en glass): cabecera con badge, caja blanca con las líneas y "+ Añadir acción".
 *  La visibilidad, el badge y el habilitado de "+ Añadir acción" son selectores del estado; cada línea despacha lo que se teclea. */
export function OtrasAcciones({ estado, dispatch, onGuardarAccion }: Props) {
  // "+ Añadir acción" da el foco a la línea nueva: se marca en el clic y se enfoca cuando la línea ya está pintada.
  const ultimoCampo = useRef<HTMLInputElement | null>(null)
  const enfocarNueva = useRef(false)
  const total = estado.otros.length
  useEffect(() => {
    if (!enfocarNueva.current) return
    enfocarNueva.current = false
    ultimoCampo.current?.focus()
  }, [total])

  if (!otrasAccionesVisible(estado)) return null
  return (
    <section data-testid="otras-acciones" className="border-l-4 border-l-azul-medio bg-form-otros-bg">
      <div className="flex items-center gap-2 px-3.5 pt-2 pb-0.5">
        <span className="text-[11.5px] font-bold text-azul-medio">OTRAS ACCIONES</span>
        <span data-testid="otras-acciones-badge" className="rounded-[10px] bg-azul-medio px-2 py-px text-[10px] font-bold text-superficie">
          {contadorAcciones(estado)}
        </span>
      </div>
      <div className="flex flex-col items-start gap-2 px-3.5 pt-0.5 pb-3">
        <div className="flex max-h-[150px] min-h-[36px] w-full flex-col gap-[5px] overflow-y-auto rounded-[6px] border border-fila-sep bg-superficie p-[5px]">
          {estado.otros.map((accion, i) => (
            <div key={accion.id} data-testid={`accion-${i + 1}`} className="flex items-center gap-[5px]">
              <input
                ref={i === total - 1 ? ultimoCampo : undefined}
                aria-label={`Descripción de la acción ${i + 1}`}
                value={accion.texto}
                // Mientras se guarda tampoco se escribe: lo enviado y lo que queda en pantalla deben ser lo mismo.
                disabled={accion.guardada !== null || accion.guardando}
                onChange={(e) => dispatch({ tipo: 'ESCRIBIR_ACCION', id: accion.id, texto: e.target.value })}
                placeholder="Describe la acción"
                className="min-w-0 flex-1 rounded border border-fila-sep bg-superficie px-2 py-1 text-[12px] disabled:opacity-60"
              />
              {accion.guardada !== null ? (
                <span className="shrink-0 px-1 text-[11px] font-bold text-recibido-text">{`✓ Guardada ${accion.guardada.fecha}`}</span>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={accion.texto.trim() === '' || accion.guardando}
                    onClick={() => onGuardarAccion(accion.id)}
                    className="shrink-0 cursor-pointer rounded bg-azul-noche px-2.5 py-1 text-[11px] font-bold text-superficie disabled:cursor-default disabled:opacity-50"
                  >
                    {accion.confirmando ? '✓ Confirmar' : '✓ Guardar'}
                  </button>
                  <button type="button" aria-label="Quitar acción" onClick={() => dispatch({ tipo: 'QUITAR_ACCION', id: accion.id })} className="shrink-0 cursor-pointer bg-transparent px-1 py-0.5">
                    <img src="/borrar.png" alt="" className="h-[18px] w-[18px]" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={!anadirAccionHabilitado(estado)}
          onClick={() => { enfocarNueva.current = true; dispatch({ tipo: 'ANADIR_ACCION' }) }}
          className="cursor-pointer rounded-[6px] bg-azul-medio px-3 py-1.5 text-[11.5px] font-bold text-superficie disabled:cursor-default disabled:opacity-50"
        >
          + Añadir acción
        </button>
      </div>
    </section>
  )
}
