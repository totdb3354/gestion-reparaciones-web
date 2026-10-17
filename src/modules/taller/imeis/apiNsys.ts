import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { api, type EventoRastro, type FichaMovil } from '@/shared/api/client'

/** Lecturas del espejo de NSYS para el detalle y la lista de IMEIs (0.9.17). Solo SUPERTECNICO y ADMIN las piden
 *  (`activo`). La búsqueda de móviles es `useBuscarMoviles` de `shared/api/nsys.ts`. */

/** La ficha de NSYS de un IMEI. Un 404 (NSYS no lo conoce) es normal: sin diálogo, sin reintentos y sin ficha. */
export function useFichaMovil(imei: string, activo: boolean): UseQueryResult<FichaMovil | null> {
  return useQuery({
    queryKey: ['imeis', 'ficha', imei],
    enabled: activo,
    queryFn: async () => (await api.GET('/api/stock-telefonos/{imeiSn}', { params: { path: { imeiSn: imei } } })).data ?? null,
    retry: false,
    meta: { silenciarError: true, sinCapa: true },
  })
}

export function useRastro(imei: string, activo: boolean): UseQueryResult<EventoRastro[]> {
  return useQuery({
    queryKey: ['imeis', 'rastro', imei],
    enabled: activo,
    queryFn: async () => (await api.GET('/api/stock-telefonos/{imeiSn}/rastro', { params: { path: { imeiSn: imei } } })).data ?? [],
    meta: { sinCapa: true },
  })
}
