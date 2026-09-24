import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import { api, type Proveedor } from '@/shared/api/client'
import { useIntervaloRefresco } from '@/shared/api/refresco'

/** Siempre con ?tipo=COMPONENTES (diferencia hotfix→main adoptada, spec paraguas §2): el servidor de main distingue
 *  proveedores de componentes y de teléfonos, y sin el parámetro los mezcla. */
export const CLAVE_PROVEEDORES = ['proveedores', 'COMPONENTES'] as const

export function useProveedoresComponentes({ activo }: { activo: boolean }): UseQueryResult<Proveedor[]> {
  const intervalo = useIntervaloRefresco(activo)
  return useQuery({
    queryKey: CLAVE_PROVEEDORES,
    queryFn: async () => (await api.GET('/api/proveedores', { params: { query: { tipo: 'COMPONENTES' } } })).data ?? [],
    refetchInterval: intervalo,
    refetchOnWindowFocus: activo,
  })
}

/** Guard de "Borrar" en el menú (inventario §12): al abrir el menú, no en cada clic de fila (spec 4a, S6). */
export async function tienePedidos(idProv: number): Promise<boolean> {
  const { data } = await api.GET('/api/proveedores/{idProv}/tiene-pedidos', { params: { path: { idProv } } })
  return data?.value ?? false
}

function useRecarga() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: CLAVE_PROVEEDORES })
}

/** El alta del cliente no manda divisa y el DAO pone EUR; el contrato (`ProveedorAltaRequest`) exige `nombre`, `divisa`
 *  y `tipo`, así que se manda 'EUR' explícito: mismo resultado. Su 422 lo pinta el diálogo: silencia el global. */
export function useCrearProveedor(): UseMutationResult<unknown, unknown, string> {
  const recargar = useRecarga()
  return useMutation({
    mutationFn: (nombre: string) => api.POST('/api/proveedores', { body: { nombre, divisa: 'EUR', tipo: 'COMPONENTES' } }),
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}

/** Su 422 (nombre o divisa, Task 2) lo pinta el diálogo: silencia el global. */
export function useEditarProveedor(): UseMutationResult<unknown, unknown, { idProv: number; nombre: string; divisa: string; comentario: string }> {
  const recargar = useRecarga()
  return useMutation({
    mutationFn: ({ idProv, ...body }: { idProv: number; nombre: string; divisa: string; comentario: string }) =>
      api.PUT('/api/proveedores/{idProv}', { params: { path: { idProv } }, body }),
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}

export function useSetActivoProveedor(): UseMutationResult<unknown, unknown, { idProv: number; activo: boolean }> {
  const recargar = useRecarga()
  return useMutation({
    mutationFn: ({ idProv, activo }: { idProv: number; activo: boolean }) =>
      api.PATCH('/api/proveedores/{idProv}/activo', { params: { path: { idProv } }, body: { activo } }),
    onSettled: recargar,
  })
}

/** El 409 "tiene pedidos" del servidor (Task 2) lo muestra el diálogo global del MutationCache con su mensaje. */
export function useBorrarProveedor(): UseMutationResult<unknown, unknown, number> {
  const recargar = useRecarga()
  return useMutation({
    mutationFn: (idProv: number) => api.DELETE('/api/proveedores/{idProv}', { params: { path: { idProv } } }),
    onSettled: recargar,
  })
}
