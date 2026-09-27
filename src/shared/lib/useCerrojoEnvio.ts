import { useEffect, useLayoutEffect, useRef } from 'react'

type Args = {
  /** Si el diálogo (o el formulario) está abierto. Cerrado no envía nada; cada apertura empieza con el cerrojo abierto. */
  abierto: boolean
  /** El `isPending` de la mutación que lanza el envío (falso si quien envía no lo expone). */
  enviando: boolean
  /** El error que pinta el diálogo. Un error nuevo (no nulo) suelta el cerrojo: el envío falló y se puede reintentar. */
  error?: string | null
}

/**
 * Cerrojo síncrono de un envío, como `enVuelo` en `taller/formulario/useGuardado.ts`. El `isPending` de TanStack Query llega
 * a React un instante después de `mutate` (su notificación va en un temporizador), así que un doble clic podía enviar dos
 * veces. `enviar(accion)` cierra el cerrojo en el mismo instante y ejecuta la acción; mientras siga cerrado, los siguientes
 * `enviar` no hacen nada. Se vuelve a abrir:
 * - cuando `enviando` ha pasado por verdadero y vuelto a falso (el envío terminó, bien o mal);
 * - cuando llega un `error` nuevo, o el diálogo se vuelve a abrir;
 * - si la acción no llegó a lanzar ningún envío (una validación local que falla): pasado el primer turno del bucle de eventos
 *   sin que `enviando` se haya puesto a verdadero. La notificación de la mutación se programó antes que esa comprobación, así
 *   que cuando la hubo ya se ha visto.
 * Con el diálogo cerrado (también durante su animación de salida) `enviar` no hace nada.
 */
export function useCerrojoEnvio({ abierto, enviando, error = null }: Args): (accion: () => void) => void {
  const cerrado = useRef(false)
  // `enviando` ha llegado a verdadero desde el último envío.
  const visto = useRef(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const estado = useRef({ abierto, enviando })

  useLayoutEffect(() => {
    estado.current = { abierto, enviando }
  })
  useLayoutEffect(() => {
    if (enviando) visto.current = true
    else if (visto.current) {
      visto.current = false
      cerrado.current = false
    }
  }, [enviando])
  useLayoutEffect(() => {
    if (!abierto) return
    cerrado.current = false
    visto.current = false
  }, [abierto])
  useLayoutEffect(() => {
    if (error !== null) cerrado.current = false
  }, [error])
  useEffect(
    () => () => {
      if (temporizador.current !== null) clearTimeout(temporizador.current)
    },
    [],
  )

  return (accion) => {
    if (cerrado.current || !estado.current.abierto || estado.current.enviando) return
    cerrado.current = true
    visto.current = false
    accion()
    if (temporizador.current !== null) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      temporizador.current = null
      if (!visto.current) cerrado.current = false
    }, 0)
  }
}
