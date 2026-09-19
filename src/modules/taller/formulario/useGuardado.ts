import type { Dispatch } from 'react'
import { esErrorGestionadoGlobalmente, mensajeDeError } from '@/shared/api/errors'
import { useSession } from '@/shared/session/SessionProvider'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { useGuardarFila } from './api'
import { cuerpoGuardarFila, type AccionFormulario, type EstadoFormulario } from './estado'

type Args = { estado: EstadoFormulario; dispatch: Dispatch<AccionFormulario>; onGuardado: () => void; antesDeCerrar?: () => Promise<void> }
type Guardado = { pulsarGuardar: () => void; guardarFila: (prefijo: string) => void; guardarAccion: (id: number) => void }

/** Fecha de "✓ Guardada": hora LOCAL del navegador como texto dd/MM HH:mm, sin año (no la de Madrid de shared/lib/fechas). */
export function fechaGuardado(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${dos(d.getHours())}:${dos(d.getMinutes())}`
}

/** Orquesta los guardados del formulario. Las mutaciones van con meta.silenciarError: el literal de la ficha lo pone este hook,
 *  salvo que el error ya lo gestione el shell (401 → login; corte de conexión → banner y su aviso). Se usa mutateAsync: los
 *  callbacks por llamada de `mutate` solo se disparan para la última, y dos filas pueden guardarse a la vez. */
export function useGuardado(args: Args): Guardado {
  // onGuardado y antesDeCerrar son de "Terminar asignación": aquí todavía no se usan.
  const { estado, dispatch } = args
  const { sesion } = useSession()
  const { mostrarError } = useAlerta()
  const guardarFilaMut = useGuardarFila()
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

  // pulsarGuardar y guardarAccion llegan con la zona de guardar y OTRAS ACCIONES; hasta entonces no hacen nada.
  return { pulsarGuardar: () => {}, guardarFila, guardarAccion: () => {} }
}
