import { useRef, type Dispatch } from 'react'
import { esErrorGestionadoGlobalmente, mensajeDeError, StaleDataError } from '@/shared/api/errors'
import { useSession } from '@/shared/session/SessionProvider'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { useAgotarComponente, useCompleta, useEditarReparacion, useGuardarFila } from './api'
import {
  accionPideConfirmacion, cuerpoGuardarAccion, cuerpoGuardarFila, planGuardarCambios, planTerminar, reducir,
  type AccionFormulario, type EstadoFormulario,
} from './estado'

type Args = { estado: EstadoFormulario; dispatch: Dispatch<AccionFormulario>; onGuardado: () => void; antesDeCerrar?: () => Promise<void> }
type Guardado = { pulsarGuardar: () => void; guardarFila: (prefijo: string) => void; guardarAccion: (id: number) => void }

/** Fecha de "✓ Guardada": hora LOCAL del navegador como texto dd/MM HH:mm, sin año (no la de Madrid de shared/lib/fechas). */
export function fechaGuardado(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${dos(d.getHours())}:${dos(d.getMinutes())}`
}

/** Literal del cliente de referencia para el bloqueo optimista en edición. El formulario NO se recarga: solo avisa. */
const MSG_409_EDICION = 'No se pudo guardar: otro usuario modificó esta reparación.\nCierra y vuelve a abrir el formulario para ver los cambios actuales.'

/** Orquesta los guardados del formulario: fila a fila, acción a acción y "Terminar asignación". Qué se envía lo deciden los
 *  constructores de estado.ts; aquí se ejecuta, se despacha el resultado y se pone el literal de error de la ficha. Las mutaciones
 *  van con meta.silenciarError: si el error ya lo gestiona el shell (401 → login; corte de conexión → banner y su aviso) no se
 *  añade literal, pero el estado se rehabilita igual. Se usa mutateAsync: los callbacks por llamada de `mutate` solo se disparan
 *  para la última, y dos filas pueden guardarse a la vez. */
export function useGuardado({ estado, dispatch, onGuardado, antesDeCerrar }: Args): Guardado {
  const { sesion } = useSession()
  const { mostrarError } = useAlerta()
  const guardarFilaMut = useGuardarFila()
  const agotarMut = useAgotarComponente()
  const completaMut = useCompleta()
  const editarMut = useEditarReparacion()
  // En flujo nuevo y glass el servidor toma el técnico del token; el contrato exige el campo y se envía el de la sesión.
  const idTecSesion = sesion?.idTec ?? 0
  // Re-entrada en "terminar": el JavaFX llamaba al servidor en el hilo de la interfaz (nunca dos veces a la vez); aquí
  // un doble clic muy rápido podría invocar `terminar` dos veces antes de que `INICIO_GUARDADO` se refleje en `estado`.
  const enVuelo = useRef(false)

  function avisar(e: unknown, literal: string) {
    if (!esErrorGestionadoGlobalmente(e)) mostrarError(literal)
  }

  async function ejecutarGuardarFila(idAsignacion: string, prefijo: string) {
    dispatch({ tipo: 'INICIO_GUARDAR_FILA', prefijo })
    try {
      const idRep = await guardarFilaMut.mutateAsync({ idAsignacion, cuerpo: cuerpoGuardarFila(estado, prefijo, idTecSesion) })
      dispatch({ tipo: 'FILA_GUARDADA', prefijo, idRep, fecha: fechaGuardado(new Date()) })
    } catch (e) {
      dispatch({ tipo: 'FALLO_GUARDAR_FILA', prefijo })
      avisar(e, `No se pudo guardar la fila: ${mensajeDeError(e)}`)
    }
  }

  function guardarFila(prefijo: string) {
    // Mientras "Terminar asignación" está en curso, la fila activa ya viaja dentro de su `completa`: guardarla aparte
    // aquí duplicaría la escritura en el servidor (el JavaFX no podía solaparlas: llamaba en el hilo de la interfaz).
    if (estado.guardado.enCurso) return
    const fila = estado.filas.find((f) => f.prefijo === prefijo)
    if (!fila || fila.guardando || fila.guardada !== null || estado.idAsignacion === null) return
    if (!fila.confirmandoGuardar) {
      dispatch({ tipo: 'PEDIR_CONFIRMACION_FILA', prefijo })
      return
    }
    void ejecutarGuardarFila(estado.idAsignacion, prefijo)
  }

  async function ejecutarGuardarAccion(idAsignacion: string, id: number) {
    const cuerpo = cuerpoGuardarAccion(estado, id, idTecSesion)
    if (cuerpo === null) return
    dispatch({ tipo: 'INICIO_GUARDAR_ACCION', id })
    try {
      const idRep = await guardarFilaMut.mutateAsync({ idAsignacion, cuerpo })
      dispatch({ tipo: 'ACCION_GUARDADA', id, idRep, fecha: fechaGuardado(new Date()) })
    } catch (e) {
      dispatch({ tipo: 'FALLO_GUARDAR_ACCION', id })
      avisar(e, `No se pudo guardar la acción: ${mensajeDeError(e)}`)
    }
  }

  function guardarAccion(id: number) {
    // Mismo motivo que en guardarFila: la acción pendiente ya viaja dentro del `completa` de "Terminar asignación".
    if (estado.guardado.enCurso) return
    const accion = estado.otros.find((a) => a.id === id)
    if (!accion || accion.guardando || accion.guardada !== null || estado.idAsignacion === null) return
    // Lo decide el estado: primer clic, o primer clic tras un fallo (el texto sigue en "✓ Confirmar" pero `pideOtroClic`
    // obliga a confirmar otra vez). FALLO_GUARDAR_ACCION lo enciende; PEDIR_CONFIRMACION_ACCION y ESCRIBIR_ACCION lo apagan.
    if (accionPideConfirmacion(accion)) {
      dispatch({ tipo: 'PEDIR_CONFIRMACION_ACCION', id })
      return
    }
    void ejecutarGuardarAccion(estado.idAsignacion, id)
  }

  /** "Terminar asignación": primero un agotar-componente por cada agotado local AÚN NO registrado, en orden de filas y uno a uno;
   *  cada éxito se anota con AGOTADO_REGISTRADO y el plan se RECALCULA con el estado resultante (no se guarda una copia del plan
   *  del clic): `actual` avanza con el mismo reductor que el estado de la vista, así que un fallo a mitad y su reintento parten
   *  siempre de lo ya registrado. Después `completa`, salvo que el plan diga que no hay nada que completar (solo agotados:
   *  `completa: null`, estén registrados o no). Lo ya hecho no se deshace. */
  async function terminar(idAsignacion: string) {
    dispatch({ tipo: 'INICIO_GUARDADO' })
    let actual = estado
    for (;;) {
      const agotado = planTerminar(actual, idTecSesion).agotados[0]
      if (agotado === undefined) break
      try {
        await agotarMut.mutateAsync({ idAsignacion, cuerpo: agotado.cuerpo })
      } catch (e) {
        dispatch({ tipo: 'FALLO_GUARDADO' })
        const inicio = e instanceof StaleDataError ? 'No se pudo registrar componente agotado' : 'Error al registrar componente agotado'
        avisar(e, `${inicio}: ${mensajeDeError(e)}`)
        return
      }
      const registrado = { tipo: 'AGOTADO_REGISTRADO', prefijo: agotado.prefijo } as const
      dispatch(registrado)
      const siguiente = reducir(actual, registrado)
      if (siguiente === actual) break // no debería ocurrir: evita repetir la misma llamada sin fin
      actual = siguiente
    }
    const completa = planTerminar(actual, idTecSesion).completa
    if (completa !== null) {
      try {
        await completaMut.mutateAsync(completa)
      } catch (e) {
        dispatch({ tipo: 'FALLO_GUARDADO' })
        const base = `No se pudo guardar: ${mensajeDeError(e)}`
        avisar(e, e instanceof StaleDataError ? `${base}\nCierra el formulario y comprueba el estado de la asignación.` : base)
        return
      }
    }
    dispatch({ tipo: 'GUARDADO_COMPLETADO' })
    try {
      await antesDeCerrar?.()
    } catch {
      // Descartar el borrador es silencioso: su fallo no impide cerrar.
    }
    onGuardado()
  }

  /** "Guardar cambios", en el orden de la referencia: (0) acción editada, (1) fila editada, (2) filas nuevas, (3) acciones
   *  nuevas, (4) cerrar. Lo ya hecho no se deshace si un paso posterior falla. Los cuerpos salen de planGuardarCambios:
   *  las filas y acciones nuevas conservan el técnico ORIGINAL (idTec del detalle) y van sin idAsignacion. */
  async function guardarCambios(idRep: string) {
    dispatch({ tipo: 'INICIO_GUARDADO' })
    const plan = planGuardarCambios(estado)
    try {
      if (plan.editarAccion) await editarMut.mutateAsync({ idRep, cuerpo: plan.editarAccion })
      if (plan.editarFila) await editarMut.mutateAsync({ idRep, cuerpo: plan.editarFila })
      if (plan.completaFilas) await completaMut.mutateAsync(plan.completaFilas)
      if (plan.completaAcciones) await completaMut.mutateAsync(plan.completaAcciones)
    } catch (e) {
      // clics = 0 y enCurso = false; el texto sigue en "✓  Confirmar terminar" y hacen falta otros dos clics.
      dispatch({ tipo: 'FALLO_GUARDADO' })
      avisar(e, e instanceof StaleDataError ? MSG_409_EDICION : `No se pudo guardar: ${mensajeDeError(e)}`)
      return
    }
    dispatch({ tipo: 'GUARDADO_COMPLETADO' })
    try {
      await antesDeCerrar?.()
    } catch {
      // En edición no hay borrador que descartar; se mantiene la misma tolerancia que en "Terminar asignación".
    }
    onGuardado()
  }

  function pulsarGuardar() {
    if (estado.guardado.enCurso) return
    if (estado.guardado.clics === 0) {
      dispatch({ tipo: 'PEDIR_CONFIRMACION_GUARDAR' })
      return
    }
    // Cinturón además de estado.guardado.enCurso: protege el intervalo entre el clic y el primer re-render con
    // INICIO_GUARDADO ya reflejado (un doble clic no debe lanzar `terminar`/`guardarCambios` dos veces en paralelo).
    if (enVuelo.current) return
    if (estado.modo === 'editar') {
      if (estado.edicion === null) return
      enVuelo.current = true
      void guardarCambios(estado.edicion.idRep).finally(() => {
        enVuelo.current = false
      })
      return
    }
    if (estado.idAsignacion === null) return
    enVuelo.current = true
    void terminar(estado.idAsignacion).finally(() => {
      enVuelo.current = false
    })
  }

  return { pulsarGuardar, guardarFila, guardarAccion }
}
