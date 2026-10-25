import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { api, type MovilBuscado } from './client'

/** Claves de consulta del stock de teléfonos que también recarga la ficha del IMEI al corregir lo del taller (0.9.21): viven
 *  aquí porque un módulo no importa de otro. */
export const CLAVE_STOCK_TELEFONOS = ['telefonos', 'stock'] as const
export const CLAVE_POR_PASAR_NSYS = ['telefonos', 'por-pasar'] as const
/** 0.9.22: las cuatro tarjetas de «Por pasar a NSYS». Cuelga de CLAVE_POR_PASAR_NSYS, así que corregir en la ficha del IMEI (que
 *  recarga ese prefijo) recarga también las tarjetas. */
export const CLAVE_TARJETAS_NSYS = [...CLAVE_POR_PASAR_NSYS, 'tarjetas'] as const
/** Prefijos de la ficha y del rastro de NSYS del detalle del IMEI (`[...prefijo, imei]`): también los recarga el formulario de
 *  la reparación y el borrado de una R…, que cambian el color y el grado del móvil. */
export const CLAVE_FICHA_MOVIL = ['imeis', 'ficha'] as const
export const CLAVE_RASTRO_MOVIL = ['imeis', 'rastro'] as const

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
