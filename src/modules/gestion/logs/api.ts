import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { api, type LogActividad } from '@/shared/api/client'
import type { QueryLogs } from './filtros'

export const CLAVE_LOGS = ['logs'] as const
export const CLAVE_ACCIONES_LOG = ['logs', 'acciones'] as const

/** Sin sondeo ni recarga al volver a la pestaña o a la red (calco: el visor del JavaFX solo recarga con "Actualizar" o al
 *  tocar un filtro, spec §7). */
const SIN_REFRESCO = { refetchOnWindowFocus: false, refetchOnReconnect: false } as const

/** GET /api/logs con los filtros de servidor y `limite` (G3). La clave lleva la query entera: cambiar un filtro cambia la
 *  clave y dispara una carga; "Limpiar filtros" la cambia una sola vez. `silenciarError`: el fallo lo enseña la página con
 *  "Error al cargar los logs: …" (LogController :223-225) y no debe salir además el diálogo genérico. */
export function useLogs(q: QueryLogs): UseQueryResult<LogActividad[]> {
  return useQuery({
    queryKey: [...CLAVE_LOGS, q],
    queryFn: async () => (await api.GET('/api/logs', { params: { query: q } })).data ?? [],
    ...SIN_REFRESCO,
    meta: { silenciarError: true },
  })
}

/** Lista del filtro "Acción..." (G4: `SELECT DISTINCT ACCION ORDER BY ACCION` en el servidor). Un fallo es silencioso: el
 *  autocompletar queda vacío, como el desplegable de usuarios del JavaFX (:209-211). */
export function useAccionesLog(): UseQueryResult<string[]> {
  return useQuery({
    queryKey: CLAVE_ACCIONES_LOG,
    queryFn: async () => (await api.GET('/api/logs/acciones')).data ?? [],
    ...SIN_REFRESCO,
    meta: { silenciarError: true },
  })
}
