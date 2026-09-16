import { ConexionError, esErrorGestionadoGlobalmente, mensajeDeError, mensajeSinConexion } from '@/shared/api/errors'
import { horaLocal } from '@/shared/lib/fechas'
import { useAlerta } from './AlertaProvider'

type Props = {
  /** `dataUpdatedAt` de la consulta (ms); 0 = todavía sin datos. */
  actualizadoEn: number
  /** Recarga manual; debe rechazar si falla (`() => refetch({ throwOnError: true })`). */
  onRecargar: () => Promise<unknown>
}

/** Calco de lblUltimaActualizacion: "Actualizado HH:mm" (10 px, gris, hora local del PC) abajo a la derecha, con
 *  subrayado al pasar y recarga al pulsar. La recarga la pide el usuario, así que un fallo de conexión abre el
 *  diálogo (en el JavaFX el catch de cargar() muestra el Alert porque no es un refresco de fondo). */
export function EtiquetaActualizado({ actualizadoEn, onRecargar }: Props) {
  const { mostrarError } = useAlerta()
  async function recargar() {
    try {
      await onRecargar()
    } catch (e) {
      if (e instanceof ConexionError) mostrarError(mensajeSinConexion(e))
      else if (!esErrorGestionadoGlobalmente(e)) mostrarError(mensajeDeError(e))
    }
  }
  return (
    <button type="button" onClick={recargar} className="mt-1 block w-full cursor-pointer text-right text-[10px] text-texto-vacio hover:underline">
      {actualizadoEn > 0 ? `Actualizado ${horaLocal(new Date(actualizadoEn))}` : ''}
    </button>
  )
}
