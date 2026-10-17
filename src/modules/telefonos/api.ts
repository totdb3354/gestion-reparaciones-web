import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { api, type EstadoNsys, type MovilStock } from '@/shared/api/client'
import { useIntervaloRefresco } from '@/shared/api/refresco'

export const CLAVE_STOCK_TELEFONOS = ['telefonos', 'stock'] as const
export const CLAVE_ESTADO_NSYS = ['telefonos', 'estado'] as const

/** GET /api/stock-telefonos: los móviles que están en la empresa. Los filtros se aplican en la pantalla (spec §8). Sondea
 *  como las demás vistas: la importación trae datos nuevos cada 5 min. */
export function useStockTelefonos(): UseQueryResult<MovilStock[]> {
  const intervalo = useIntervaloRefresco(true)
  return useQuery({
    queryKey: CLAVE_STOCK_TELEFONOS,
    queryFn: async () => (await api.GET('/api/stock-telefonos')).data ?? [],
    refetchInterval: intervalo,
  })
}

/** GET /api/stock-telefonos/estado: hora de la última exportación de NSYS y nivel del aviso. Sin capa de carga: es la
 *  píldora de la cabecera. */
export function useEstadoNsys(): UseQueryResult<EstadoNsys | null> {
  const intervalo = useIntervaloRefresco(true)
  return useQuery({
    queryKey: CLAVE_ESTADO_NSYS,
    queryFn: async () => (await api.GET('/api/stock-telefonos/estado')).data ?? null,
    refetchInterval: intervalo,
    meta: { sinCapa: true },
  })
}
