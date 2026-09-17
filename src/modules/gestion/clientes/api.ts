import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Cliente } from '@/shared/api/client'

export const CLAVE_CLIENTES = ['clientes'] as const

export function useClientes() {
  return useQuery({
    queryKey: CLAVE_CLIENTES,
    queryFn: async () => (await api.GET('/api/clientes')).data ?? [],
  })
}

export async function tieneTelefonos(idCli: number): Promise<boolean> {
  const { data } = await api.GET('/api/clientes/{idCli}/tiene-telefonos', { params: { path: { idCli } } })
  return data?.value ?? false
}

function useRecarga() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: CLAVE_CLIENTES })
}

export function useCrearCliente() {
  const recargar = useRecarga()
  return useMutation({
    mutationFn: (nombre: string) => api.POST('/api/clientes', { body: { nombre } }),
    onSettled: recargar,
  })
}
/** Editar y activar comparten el bloqueo optimista por updatedAt: su 409 lo traduce la vista, así que
 *  silencian el diálogo global del MutationCache (ver crearQueryClient) para no mostrarlo dos veces. */
export function useEditarCliente() {
  const recargar = useRecarga()
  return useMutation({
    mutationFn: (c: Pick<Cliente, 'idCli' | 'nombre' | 'updatedAt'>) =>
      api.PUT('/api/clientes/{idCli}', { params: { path: { idCli: c.idCli } }, body: { nombre: c.nombre, updatedAt: c.updatedAt } }),
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}
export function useSetActivoCliente() {
  const recargar = useRecarga()
  return useMutation({
    mutationFn: (c: Pick<Cliente, 'idCli' | 'activo' | 'updatedAt'>) =>
      api.PATCH('/api/clientes/{idCli}/activo', { params: { path: { idCli: c.idCli } }, body: { activo: c.activo, updatedAt: c.updatedAt } }),
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}
export function useBorrarCliente() {
  const recargar = useRecarga()
  return useMutation({
    mutationFn: (idCli: number) => api.DELETE('/api/clientes/{idCli}', { params: { path: { idCli } } }),
    onSettled: recargar,
  })
}
