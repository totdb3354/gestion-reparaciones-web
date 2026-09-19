import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type Dispatch } from 'react'
import { borrarBorrador, guardarBorrador, idsReparacionesDelImei } from './api'
import { aplicarBorrador, leerBorrador, serializar, tieneGuardadas } from './borrador'
import type { AccionFormulario, EstadoFormulario } from './estado'

export const RETARDO_BORRADOR_MS = 2000

/** Cola serie de módulo: las escrituras del borrador salen de una en una y en orden, de modo que el DELETE de `descartar`
 *  nunca adelanta a un PUT que siguiera en vuelo. Las tareas nunca rechazan (capturan su propio error). */
let cola: Promise<void> = Promise.resolve()
function encolar(tarea: () => Promise<void>): Promise<void> {
  cola = cola.then(tarea, tarea)
  return cola
}
/** Se resuelve cuando no quedan escrituras de borrador en vuelo (para los tests que montan el formulario). */
export function borradorEnReposo(): Promise<void> {
  return cola
}

type Args = { estado: EstadoFormulario; dispatch: Dispatch<AccionFormulario>; borradorJson: string | null; activo: boolean }

/** Borrador persistente del flujo nuevo y Glass: aplica el recuperado una sola vez, comprueba que sus filas guardadas
 *  sigan existiendo, autoguarda 2 s después del último cambio, vuelca al momento cuando sube `estado.volcados` y al
 *  desmontar, y deja de escribir tras un guardado real. Todos los fallos son silenciosos. */
export function useBorrador({ estado, dispatch, borradorJson, activo }: Args): { listo: boolean; volcarAhora: () => Promise<void>; descartar: () => Promise<void> } {
  // Ilegible, vacío o inactivo → null: formulario limpio, sin banda y sin error.
  const recuperado = useMemo(() => (activo ? leerBorrador(borradorJson) : null), [activo, borradorJson])
  // Derivado, no estado: pasa a true en el mismo commit que el REEMPLAZAR (aplicarBorrador pone borradorRecuperado).
  const listo = recuperado === null || estado.borradorRecuperado

  // Último estado para los volcados que ocurren fuera del render (temporizador, cierre, desmontaje). Se actualiza en un
  // layout effect, no durante el render (regla react-hooks/refs; mismo patrón que shared/ui/exportable.tsx).
  const vivo = useRef({ estado, listo, activo })
  useLayoutEffect(() => {
    vivo.current = { estado, listo, activo }
  })
  /** Último contenido escrito con éxito (null = DELETE); undefined = aún nada en esta apertura. */
  const escrito = useRef<string | null | undefined>(undefined)
  const descartado = useRef(false)
  const aplicado = useRef(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const revisionInicial = useRef(estado.revision)
  const volcadosVistos = useRef(estado.volcados)

  const cancelar = useCallback(() => {
    if (temporizador.current !== null) {
      clearTimeout(temporizador.current)
      temporizador.current = null
    }
  }, [])

  const escribir = useCallback(
    (): Promise<void> =>
      encolar(async () => {
        const { estado: e, listo: aplicadoYa, activo: enUso } = vivo.current
        if (!enUso || !aplicadoYa || descartado.current || e.borradorDescartado || e.idAsignacion === null) return
        const contenido = serializar(e)
        // Mismo contenido que la última escritura buena (✕ y, acto seguido, el desmontaje): no se repite.
        if (escrito.current !== undefined && contenido === escrito.current) return
        try {
          if (contenido === null) await borrarBorrador(e.idAsignacion)
          else await guardarBorrador(e.idAsignacion, contenido)
          escrito.current = contenido
        } catch {
          // Silencioso. No se anota como escrito: el siguiente volcado (el de cerrar) lo reintenta.
        }
      }),
    [],
  )

  // 1) Recuperación, una sola vez (la ref sobrevive al montaje doble de StrictMode), y verificación de las guardadas.
  useEffect(() => {
    if (recuperado === null || aplicado.current) return
    aplicado.current = true
    const base = vivo.current.estado
    dispatch({ tipo: 'REEMPLAZAR', estado: aplicarBorrador(base, recuperado) })
    if (!tieneGuardadas(recuperado)) return
    idsReparacionesDelImei(base.imei).then(
      (ids) => dispatch({ tipo: 'DESBLOQUEAR_BORRADAS', idsExistentes: ids }),
      () => {
        // Silencioso: siguen bloqueadas hasta la siguiente apertura.
      },
    )
  }, [recuperado, dispatch])

  // 2) Autoguardado: 2 s después del último cambio. REEMPLAZAR no sube `revision`, así que aplicar el borrador no escribe.
  useEffect(() => {
    if (!activo || !listo || estado.borradorDescartado || estado.revision === revisionInicial.current) return
    const t = setTimeout(() => {
      temporizador.current = null
      void escribir()
    }, RETARDO_BORRADOR_MS)
    temporizador.current = t
    return () => clearTimeout(t)
  }, [activo, listo, estado.revision, estado.borradorDescartado, escribir])

  // 3) Volcado inmediato: fila guardada, acción guardada y filas desbloqueadas. Va DESPUÉS del efecto 2 para cancelar
  //    el temporizador que ese mismo commit acaba de programar.
  useEffect(() => {
    if (!activo || !listo || estado.volcados === volcadosVistos.current) return
    volcadosVistos.current = estado.volcados
    cancelar()
    void escribir()
  }, [activo, listo, estado.volcados, cancelar, escribir])

  // 4) Volcado al desmontar (Atrás del navegador, cambio de ruta). Solo se registra con `listo`: el desmontaje simulado
  //    de StrictMode, que ocurre antes de aplicar el borrador recuperado, no escribe nada.
  useEffect(() => {
    if (!activo || !listo) return
    return () => {
      cancelar()
      void escribir()
    }
  }, [activo, listo, cancelar, escribir])

  const volcarAhora = useCallback((): Promise<void> => {
    cancelar()
    return escribir()
  }, [cancelar, escribir])

  const descartar = useCallback((): Promise<void> => {
    cancelar()
    descartado.current = true
    return encolar(async () => {
      const { estado: e, activo: enUso } = vivo.current
      if (!enUso || e.idAsignacion === null) return
      try {
        await borrarBorrador(e.idAsignacion)
      } catch {
        // Se ignora: el guardado real ya está hecho y el formulario se cierra igualmente.
      }
    })
  }, [cancelar])

  return { listo, volcarAhora, descartar }
}
