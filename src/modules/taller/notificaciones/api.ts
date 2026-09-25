import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import { api, type Componente, type SolicitudResumen, type SolicitudStock } from '@/shared/api/client'
import { ConexionError, SesionExpiradaError, mensajeDeError, mensajeSinConexion } from '@/shared/api/errors'
import { useIntervaloRefresco } from '@/shared/api/refresco'
import { emitirError } from '@/shared/ui/alertas'
import { CLAVE_NOTIF } from '../formulario/api'
import { componerListas, type ListasSolicitudes } from './solicitudes'

export { CLAVE_NOTIF } from '../formulario/api'
export const CLAVE_NOTIF_CONTADOR = ['notificaciones', 'contador'] as const
export const CLAVE_NOTIF_SOLICITUDES = ['notificaciones', 'solicitudes'] as const
export const CLAVE_NOTIF_COMPONENTES = ['notificaciones', 'componentes'] as const

type Estado = 'PENDIENTE' | 'RECHAZADA'

async function contar(): Promise<number> {
  const [urgentes, preventivas] = await Promise.all([api.GET('/api/solicitudes/count'), api.GET('/api/solicitudes-stock/count')])
  return (urgentes.data?.value ?? 0) + (preventivas.data?.value ?? 0)
}

const pedirUrgentes = async (estado: Estado) => (await api.GET('/api/solicitudes', { params: { query: { estado } } })).data ?? []
const pedirPreventivas = async (estado: Estado) => (await api.GET('/api/solicitudes-stock', { params: { query: { estado } } })).data ?? []

/** "Pedir piezas" de la campana (calco de MainController :334-351): relee en ese momento las urgentes y las preventivas
 *  PENDIENTE, sin pasar por la caché del panel, para abrir "Nuevo pedido" con ellas (sub-proyecto 4b, D10). Un fallo se
 *  propaga: lo muestra quien llama. */
export async function pedirPendientes(): Promise<{ urgentes: SolicitudResumen[]; preventivas: SolicitudStock[] }> {
  const [urgentes, preventivas] = await Promise.all([pedirUrgentes('PENDIENTE'), pedirPreventivas('PENDIENTE')])
  return { urgentes, preventivas }
}

async function pedirListas(): Promise<ListasSolicitudes> {
  const [urgPend, prevPend, urgRech, prevRech] = await Promise.all([
    pedirUrgentes('PENDIENTE'), pedirPreventivas('PENDIENTE'), pedirUrgentes('RECHAZADA'), pedirPreventivas('RECHAZADA'),
  ])
  return componerListas({ urgPend, prevPend, urgRech, prevRech })
}

/** Total del badge: urgentes PENDIENTE + preventivas PENDIENTE. Sondea con el intervalo general (60 s / 5 s) y al volver el
 *  foco (refetchOnWindowFocus del QueryClient). Un fallo se ignora en silencio y el badge se queda como estaba. */
export function useContadorNotificaciones(activo: boolean): UseQueryResult<number> {
  const intervalo = useIntervaloRefresco(activo)
  return useQuery({ queryKey: CLAVE_NOTIF_CONTADOR, queryFn: contar, enabled: activo, refetchInterval: intervalo, meta: { silenciarError: true } })
}

/** Las cuatro listas del panel. Solo con el panel abierto; sondea con el intervalo general. Errores: política general de
 *  las consultas (un corte de conexión con datos en pantalla deja solo el banner y se conserva la última lista). */
export function useSolicitudesPanel(abierto: boolean): UseQueryResult<ListasSolicitudes> {
  const intervalo = useIntervaloRefresco(abierto)
  return useQuery({ queryKey: CLAVE_NOTIF_SOLICITUDES, queryFn: pedirListas, enabled: abierto, refetchInterval: intervalo })
}

/** Componentes gestionados, de los que salen las alertas (alertas.ts). `sondea` = panel abierto. La primera carga (la del
 *  pulso) SÍ avisa del error; los sondeos y recargas posteriores, no. Como `meta` es fijo por consulta, la consulta va
 *  silenciada y el aviso se da a mano en el primer fallo de una consulta que nunca tuvo datos. */
export function useComponentesGestionados(sondea: boolean): UseQueryResult<Componente[]> {
  const qc = useQueryClient()
  const intervalo = useIntervaloRefresco(sondea)
  return useQuery({
    queryKey: CLAVE_NOTIF_COMPONENTES,
    queryFn: async (): Promise<Componente[]> => {
      try {
        return (await api.GET('/api/componentes/gestionados')).data ?? []
      } catch (e) {
        const estado = qc.getQueryState(CLAVE_NOTIF_COMPONENTES)
        const primerFallo = estado?.data === undefined && (estado?.errorUpdateCount ?? 0) === 0
        if (primerFallo && !(e instanceof SesionExpiradaError)) emitirError(e instanceof ConexionError ? mensajeSinConexion(e) : mensajeDeError(e))
        throw e
      }
    },
    refetchInterval: intervalo,
    meta: { silenciarError: true },
  })
}

/** "Rechazar" y "Recuperar" de una tarjeta. Sin confirmación. Después recarga todo lo de la campana (contador, solicitudes y
 *  alertas), también si falla. El error lo muestra el aviso global. */
export function useCambiarEstadoSolicitud(): UseMutationResult<void, unknown, { clase: 'U' | 'P'; id: number; estado: Estado }> {
  const qc = useQueryClient()
  return useMutation<void, unknown, { clase: 'U' | 'P'; id: number; estado: Estado }>({
    mutationFn: async ({ clase, id, estado }) => {
      if (clase === 'U') await api.PATCH('/api/solicitudes/{idRc}/estado', { params: { path: { idRc: id } }, body: { estado } })
      else await api.PATCH('/api/solicitudes-stock/{idSol}/estado', { params: { path: { idSol: id } }, body: { estado } })
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: CLAVE_NOTIF })
    },
  })
}

/** Papelera de una rechazada: la urgente se oculta para siempre (limpiar); la preventiva se borra. */
export function useQuitarSolicitud(): UseMutationResult<void, unknown, { clase: 'U' | 'P'; id: number }> {
  const qc = useQueryClient()
  return useMutation<void, unknown, { clase: 'U' | 'P'; id: number }>({
    mutationFn: async ({ clase, id }) => {
      if (clase === 'U') await api.PATCH('/api/solicitudes/{idRc}/limpiar', { params: { path: { idRc: id } } })
      else await api.DELETE('/api/solicitudes-stock/{idSol}', { params: { path: { idSol: id } } })
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: CLAVE_NOTIF })
    },
  })
}

/** Pide las PENDIENTE en ese momento y las rechaza una a una (urgentes, luego preventivas); al primer error se detiene y
 *  lanza (las ya rechazadas quedan así; no recarga). Con éxito recarga solicitudes y contador, no las alertas. */
export function useRechazarTodo(): UseMutationResult<void, unknown, void> {
  const qc = useQueryClient()
  return useMutation<void, unknown, void>({
    mutationFn: async () => {
      const [urgentes, preventivas] = await Promise.all([pedirUrgentes('PENDIENTE'), pedirPreventivas('PENDIENTE')])
      for (const s of urgentes) await api.PATCH('/api/solicitudes/{idRc}/estado', { params: { path: { idRc: s.idRc } }, body: { estado: 'RECHAZADA' } })
      for (const s of preventivas) await api.PATCH('/api/solicitudes-stock/{idSol}/estado', { params: { path: { idSol: s.idSol } }, body: { estado: 'RECHAZADA' } })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CLAVE_NOTIF_SOLICITUDES })
      void qc.invalidateQueries({ queryKey: CLAVE_NOTIF_CONTADOR })
    },
  })
}
