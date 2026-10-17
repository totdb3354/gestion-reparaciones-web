import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { api, type MovilBuscado } from './client'

/** Busca por IMEI en todo el espejo de NSYS, también los vendidos (0.9.17). Lo usan el buscador del stock de teléfonos y
 *  la lista de IMEIs; por eso vive en `shared`. Con menos de 4 caracteres, o con `activo` a false, no pregunta. */
export function useBuscarMoviles(texto: string, activo = true): UseQueryResult<MovilBuscado[]> {
  const limpio = texto.trim()
  return useQuery({
    queryKey: ['nsys', 'buscar', limpio],
    enabled: activo && limpio.length >= 4,
    queryFn: async () => (await api.GET('/api/stock-telefonos/buscar', { params: { query: { imei: limpio } } })).data ?? [],
    meta: { sinCapa: true },
  })
}
