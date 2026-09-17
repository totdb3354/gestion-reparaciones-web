import { intervaloRefresco, useConexion } from './conexion'

export const INTERVALO_CONECTADO_MS = 60_000
export const INTERVALO_DESCONECTADO_MS = 5_000

/**
 * Calco de Poller.java: las vistas que sondean recargan cada 60 s, y cada 5 s mientras el banner de conexión
 * está activo. `activo = false` para las vistas que no sondean (ADMIN en el taller, Clientes, Estadísticas).
 * Uso: `useQuery({ ..., refetchInterval: useIntervaloRefresco(sondea) })`.
 *
 * CONTRATO DE ERRORES de las consultas (crearQueryClient, QueryCache.onError):
 * - Un fallo de conexión (red, timeout, 5xx) abre el diálogo "Sin conexión con el servidor: <detalle>" SOLO en el
 *   primer fallo de una consulta que nunca tuvo datos (`query.state.data === undefined && errorUpdateCount === 1`):
 *   es la carga inicial que pidió el usuario al navegar. Los refetch por intervalo, por foco o por invalidación
 *   dejan solo el banner (`errorUpdateCount` sigue subiendo mientras el servidor esté caído, así que el diálogo
 *   no se repite; dentro de los 5 min de gcTime de una consulta fallida tampoco se repite al volver a la vista).
 * - Cualquier otro error (403, 404, 409, 422...) abre el diálogo con su mensaje; las mutaciones avisan siempre.
 * - Una recarga MANUAL (EtiquetaActualizado) con datos en pantalla solo enciende el banner por esta vía; por eso
 *   la etiqueta muestra ella misma el diálogo cuando su `refetch({ throwOnError: true })` falla por conexión.
 */
export function useIntervaloRefresco(activo = true): number | false {
  const conectado = useConexion()
  if (!activo) return false
  return conectado ? INTERVALO_CONECTADO_MS : INTERVALO_DESCONECTADO_MS
}

export { intervaloRefresco }
