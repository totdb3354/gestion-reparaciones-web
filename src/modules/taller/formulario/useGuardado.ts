import type { Dispatch } from 'react'
import { esErrorGestionadoGlobalmente, mensajeDeError, StaleDataError } from '@/shared/api/errors'
import { useSession } from '@/shared/session/SessionProvider'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { useAgotarComponente, useCompleta, useGuardarFila } from './api'
import { accionPideConfirmacion, cuerpoGuardarAccion, cuerpoGuardarFila, planTerminar, reducir, type AccionFormulario, type EstadoFormulario } from './estado'

type Args = { estado: EstadoFormulario; dispatch: Dispatch<AccionFormulario>; onGuardado: () => void; antesDeCerrar?: () => Promise<void> }
type Guardado = { pulsarGuardar: () => void; guardarFila: (prefijo: string) => void; guardarAccion: (id: number) => void }

/** Fecha de "✓ Guardada": hora LOCAL del navegador como texto dd/MM HH:mm, sin año (no la de Madrid de shared/lib/fechas). */
export function fechaGuardado(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${dos(d.getHours())}:${dos(d.getMinutes())}`
}

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
  // En flujo nuevo y glass el servidor toma el técnico del token; el contrato exige el campo y se envía el de la sesión.
  const idTecSesion = sesion?.idTec ?? 0

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

  function pulsarGuardar() {
    if (estado.guardado.enCurso) return
    if (estado.guardado.clics === 0) {
      dispatch({ tipo: 'PEDIR_CONFIRMACION_GUARDAR' })
      return
    }
    // "Guardar cambios" (modo editar) se ejecuta con planGuardarCambios cuando exista la ruta de edición.
    if (estado.modo === 'editar' || estado.idAsignacion === null) return
    void terminar(estado.idAsignacion)
  }

  return { pulsarGuardar, guardarFila, guardarAccion }
}
