import { useQuery } from '@tanstack/react-query'
import { api } from './client'

export const CLAVE_CLIENTES = ['clientes'] as const

export function useClientes() {
  return useQuery({
    queryKey: CLAVE_CLIENTES,
    queryFn: async () => (await api.GET('/api/clientes')).data ?? [],
  })
}
