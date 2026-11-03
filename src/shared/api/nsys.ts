import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { api, type EstadoNsys, type MovilBuscado } from './client'
import { useIntervaloRefresco } from './refresco'

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

/** Como mucho los IMEIs que se comprueban de una vez (spec 0.9.18 §4.9; el servidor da 400 por encima). Desde la 0.9.23 vive
 *  aquí: también comprueba IMEIs el modal de asignación del taller. */
export const MAX_IMEIS = 500
export const CLAVE_ESTADO_NSYS = ['telefonos', 'estado'] as const

/** GET /api/stock-telefonos/estado: hora de la última exportación de NSYS y nivel del aviso. Sin capa de carga ni diálogo
 *  de error: lo enseñan la píldora de la cabecera («no se pudo comprobar») y, desde la 0.9.18, el indicador de la barra
 *  superior en todas las vistas. `activo`: el indicador solo pregunta para SUPERTECNICO y ADMIN (al TECNICO le daría 403).
 *  Desde la 0.9.23 vive aquí: el modal de asignación del taller enseña la hora del último Items. */
export function useEstadoNsys(activo = true): UseQueryResult<EstadoNsys | null> {
  const intervalo = useIntervaloRefresco(activo)
  return useQuery({
    queryKey: CLAVE_ESTADO_NSYS,
    enabled: activo,
    queryFn: async () => (await api.GET('/api/stock-telefonos/estado')).data ?? null,
    refetchInterval: intervalo,
    meta: { sinCapa: true, silenciarError: true },
  })
}

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
