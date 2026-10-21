import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { api, type EventoRastro, type FichaMovil, type OpcionesTaller, type PeticionTaller } from '@/shared/api/client'
import { CLAVE_FICHA_MOVIL, CLAVE_POR_PASAR_NSYS, CLAVE_RASTRO_MOVIL, CLAVE_STOCK_TELEFONOS } from '@/shared/api/nsys'

/** Lecturas del espejo de NSYS para el detalle y la lista de IMEIs (0.9.17). Solo SUPERTECNICO y ADMIN las piden
 *  (`activo`). La búsqueda de móviles es `useBuscarMoviles` de `shared/api/nsys.ts`. Desde la 0.9.21, también la corrección
 *  a mano de lo del taller (spec «SKU del taller» §2.3). */

const claveFicha = (imei: string) => [...CLAVE_FICHA_MOVIL, imei] as const
const claveRastro = (imei: string) => [...CLAVE_RASTRO_MOVIL, imei] as const
const claveOpciones = (imei: string) => ['imeis', 'opciones-taller', imei] as const

/** La ficha de NSYS de un IMEI. Un 404 (NSYS no lo conoce) es normal: sin diálogo, sin reintentos y sin ficha. */
export function useFichaMovil(imei: string, activo: boolean): UseQueryResult<FichaMovil | null> {
  return useQuery({
    queryKey: claveFicha(imei),
    enabled: activo,
    queryFn: async () => (await api.GET('/api/stock-telefonos/{imeiSn}', { params: { path: { imeiSn: imei } } })).data ?? null,
    retry: false,
    meta: { silenciarError: true, sinCapa: true },
  })
}

export function useRastro(imei: string, activo: boolean): UseQueryResult<EventoRastro[]> {
  return useQuery({
    queryKey: claveRastro(imei),
    enabled: activo,
    queryFn: async () => (await api.GET('/api/stock-telefonos/{imeiSn}/rastro', { params: { path: { imeiSn: imei } } })).data ?? [],
    meta: { sinCapa: true },
  })
}

/** GET /api/stock-telefonos/{imeiSn}/colores: los colores del maestro con su producto y los SKU por color y grado, para el
 *  diálogo «Corregir…»; solo mientras está abierto. */
export function useOpcionesTaller(imei: string, activo: boolean): UseQueryResult<OpcionesTaller | null> {
  return useQuery({
    queryKey: claveOpciones(imei),
    enabled: activo,
    queryFn: async () => (await api.GET('/api/stock-telefonos/{imeiSn}/colores', { params: { path: { imeiSn: imei } } })).data ?? null,
    meta: { sinCapa: true },
  })
}

/** Tras corregir o volver a NSYS, bien o mal: la ficha, el rastro y las opciones del IMEI, el stock de teléfonos y la lista
 *  «Por pasar a NSYS». No espera a la recarga, para que el error (si lo hay) salga al momento. */
function useRecargarTrasCorregir(imei: string): () => void {
  const qc = useQueryClient()
  return () => {
    for (const queryKey of [claveFicha(imei), claveRastro(imei), claveOpciones(imei), CLAVE_STOCK_TELEFONOS, CLAVE_POR_PASAR_NSYS])
      void qc.invalidateQueries({ queryKey })
  }
}

/** PUT /api/stock-telefonos/{imeiSn}/taller (spec 0.9.21 §2.3). Un 400 (sin cambios, motivo…) sale en el diálogo de error. */
export function useCorregirTaller(imei: string) {
  const recargar = useRecargarTrasCorregir(imei)
  return useMutation({
    mutationFn: (cuerpo: PeticionTaller) => api.PUT('/api/stock-telefonos/{imeiSn}/taller', { params: { path: { imeiSn: imei } }, body: cuerpo }),
    onSettled: recargar,
  })
}

/** DELETE /api/stock-telefonos/{imeiSn}/taller: «Volver a lo de NSYS», con el motivo si se ha escrito. */
export function useVolverANsys(imei: string) {
  const recargar = useRecargarTrasCorregir(imei)
  return useMutation({
    mutationFn: (motivo: string | null) => api.DELETE('/api/stock-telefonos/{imeiSn}/taller', { params: { path: { imeiSn: imei } }, body: { motivo } }),
    onSettled: recargar,
  })
}
