import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import { api, type Componente } from '@/shared/api/client'
import { useIntervaloRefresco } from '@/shared/api/refresco'
import { ordenarStock } from './filtros'

export const CLAVE_COMPONENTES_GESTIONADOS = ['componentes', 'gestionados'] as const
/** Clave con la que la campana (modules/taller/notificaciones) consulta el mismo endpoint: se invalida también para que
 *  las alertas se recalculen tras editar stock. Literal a propósito: un módulo no importa de otro (regla de lint). */
const CLAVE_CAMPANA_COMPONENTES = ['notificaciones', 'componentes'] as const

/** GET /api/componentes/gestionados, la única petición de "Stock actual" (inventario §2): tabla, filtros, donut y pie
 *  salen de aquí. `activo = false` congela el sondeo y el refetch por foco con un menú o un diálogo abiertos (D4 del 3a). */
export function useComponentesStock({ activo }: { activo: boolean }): UseQueryResult<Componente[]> {
  const intervalo = useIntervaloRefresco(activo)
  return useQuery({
    queryKey: CLAVE_COMPONENTES_GESTIONADOS,
    queryFn: async () => ordenarStock((await api.GET('/api/componentes/gestionados')).data ?? []),
    refetchInterval: intervalo,
    refetchOnWindowFocus: activo,
  })
}

/** Barra "Pedido" del gráfico por SKU (inventario §8): solo se pide para ADMIN y SUPERTECNICO. */
export async function pedirCantidadEnCamino(idCom: number): Promise<number> {
  const { data } = await api.GET('/api/compras/cantidad-en-camino/{idCom}', { params: { path: { idCom } } })
  return data?.value ?? 0
}

/** Invalida `['componentes', …]` (tabla de Stock) y la clave de la campana. Los agrupados del formulario van con otra
 *  clave (`['formulario', …]`) y no se tocan: el formulario los recarga al abrirse. */
function useRecarga() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['componentes'] })
    void qc.invalidateQueries({ queryKey: CLAVE_CAMPANA_COMPONENTES })
  }
}

/** PUT con el cuerpo que el cliente reenvía tal cual (tipo, mínimo y updatedAt sin cambios). Su 409 lo traduce la vista
 *  ("El componente fue modificado mientras editabas…"), así que silencia el diálogo global. */
export function useEditarStock(): UseMutationResult<unknown, unknown, { c: Componente; stock: number }> {
  const recargar = useRecarga()
  return useMutation({
    mutationFn: ({ c, stock }: { c: Componente; stock: number }) =>
      api.PUT('/api/componentes/{idCom}', { params: { path: { idCom: c.idCom } }, body: { tipo: c.tipo, stock, stockMinimo: c.stockMinimo, updatedAt: c.updatedAt } }),
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}

/** Su 422 se pinta dentro del diálogo (spec §8) y el resto de errores los muestra la vista a mano: silencia el diálogo
 *  global para que el aviso no salga dos veces. */
export function useAjustarMinimo(): UseMutationResult<unknown, unknown, { idCom: number; stockMinimo: number }> {
  const recargar = useRecarga()
  return useMutation({
    mutationFn: ({ idCom, stockMinimo }: { idCom: number; stockMinimo: number }) =>
      api.PATCH('/api/componentes/{idCom}/stock-minimo', { params: { path: { idCom } }, body: { stockMinimo } }),
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}

export function useSetActivoComponente(): UseMutationResult<unknown, unknown, { idCom: number; activo: boolean }> {
  const recargar = useRecarga()
  return useMutation({
    mutationFn: ({ idCom, activo }: { idCom: number; activo: boolean }) =>
      api.PATCH('/api/componentes/{idCom}/activo', { params: { path: { idCom } }, body: { activo } }),
    onSettled: recargar,
  })
}

/** "Solicitar pieza": sin recarga ni aviso al terminar (calco, inventario §9.4). */
export function useSolicitarPieza(): UseMutationResult<unknown, unknown, { idCom: number; descripcion: string | null }> {
  return useMutation({
    mutationFn: ({ idCom, descripcion }: { idCom: number; descripcion: string | null }) =>
      api.POST('/api/solicitudes-stock', { body: { idCom, descripcion } }),
  })
}
