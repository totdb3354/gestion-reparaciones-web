import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/** Lo que dura el aviso en pantalla. Ocho segundos: el tiempo de leerlo y decidir, sin dejar un panel colgando. */
export const MS_DESHACER = 8_000

export type AccionReversible = {
  /** Lo que ya ha pasado, en pasado y nombrando la fila ("A… marcada como urgente"). */
  texto: string
  hacer: () => Promise<unknown>
  /** La misma escritura con el valor contrario. */
  deshacer: () => Promise<unknown>
}

type Pendiente = { texto: string; deshacer: () => Promise<unknown> }

/**
 * Escritura inmediata con un aviso que permite deshacerla (spec 3a, D2). El JavaFX escribe al instante y sin
 * confirmar; en un navegador un clic o una tecla de más mueve trabajo entre técnicos en silencio, así que se
 * conserva el gesto y se añade la vuelta atrás.
 *
 * Es genérico a propósito: no sabe nada de asignaciones ni de mutaciones, solo encadena dos promesas inversas.
 * Quien lo usa aporta el texto y las dos escrituras.
 *
 * Dos decisiones de borde:
 * - **La acción falla**: no hay aviso, porque no hay nada que deshacer. El error lo cuenta el manejador global de
 *   mutaciones (MutationCache.onError), así que aquí se traga la promesa rechazada para no duplicarlo.
 * - **Dos acciones seguidas**: solo hay un aviso a la vez y gana la última. Apilarlos escondería cuál deshace qué
 *   justo cuando el usuario va rápido; la que se puede deshacer es siempre la última, que es la que acaba de hacer.
 *   Lo mismo al pulsar "Deshacer": el aviso se cierra en el acto, sin esperar a la respuesta, y si la inversa falla
 *   el error sale por el manejador global y la lista se recarga con la verdad del servidor.
 */
export function useAccionConDeshacer(): { ejecutar: (accion: AccionReversible) => void; aviso: ReactNode } {
  const [pendiente, setPendiente] = useState<Pendiente | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cerrar = useCallback(() => {
    if (temporizador.current !== null) clearTimeout(temporizador.current)
    temporizador.current = null
    setPendiente(null)
  }, [])

  // Sin esto, salir de la vista con un aviso abierto dejaría el temporizador vivo hasta que saltara solo. La marca
  // cubre además la escritura que aún estaba en vuelo al salir: sin ella abriría un aviso que ya nadie pinta y
  // dejaría armado su temporizador, fuera del alcance de esta limpieza.
  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      cerrar()
    }
  }, [cerrar])

  const ejecutar = useCallback(
    ({ texto, hacer, deshacer }: AccionReversible) => {
      void (async () => {
        try {
          await hacer()
        } catch {
          return
        }
        if (!montado.current) return
        cerrar()
        setPendiente({ texto, deshacer })
        temporizador.current = setTimeout(() => {
          temporizador.current = null
          setPendiente(null)
        }, MS_DESHACER)
      })()
    },
    [cerrar],
  )

  const pulsarDeshacer = useCallback(() => {
    const actual = pendiente
    cerrar()
    if (!actual) return
    void actual.deshacer().catch(() => {
      /* lo cuenta el manejador global */
    })
  }, [pendiente, cerrar])

  // role="status" (aria-live polite): el lector de pantalla lo anuncia sin robar el foco, que sigue en la tabla.
  const aviso = pendiente && (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-lg border border-fila-sep bg-azul-noche px-4 py-2.5 text-[12px] font-bold text-crema shadow-md"
    >
      <span>{pendiente.texto}</span>
      <button
        type="button"
        onClick={pulsarDeshacer}
        className="cursor-pointer rounded-3xl border border-crema px-3 py-1 text-[12px] font-bold text-crema hover:bg-azul-noche-hover"
      >
        Deshacer
      </button>
    </div>
  )

  return { ejecutar, aviso }
}
