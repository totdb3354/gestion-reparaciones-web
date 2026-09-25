import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api, type CompraComponente, type CompraOtro } from '@/shared/api/client'
import { useIntervaloRefresco } from '@/shared/api/refresco'
import { ordenarCanceladosAlFinal } from './filtros'
import { esCompra, type Pedido, type TipoPedido } from './reglas'

export const CLAVE_COMPRAS = ['compras'] as const
export function claveCompras(tipo: TipoPedido): readonly ['compras', TipoPedido] {
  return ['compras', tipo] as const
}

type OpcionesConsulta = { activo: boolean; habilitada?: boolean }

/** GET /api/compras (los tres roles). `activo = false` congela el sondeo y el refetch por foco con un menú, un diálogo o un
 *  formulario abiertos; `habilitada = false` no la pide (la página solo consulta la tabla del toggle visible, spec §5). */
export function useCompras({ activo, habilitada = true }: OpcionesConsulta): UseQueryResult<CompraComponente[]> {
  const intervalo = useIntervaloRefresco(activo)
  return useQuery({
    queryKey: claveCompras('componentes'),
    queryFn: async () => ordenarCanceladosAlFinal((await api.GET('/api/compras')).data ?? []),
    enabled: habilitada,
    refetchInterval: intervalo,
    refetchOnWindowFocus: activo,
  })
}

/** GET /api/compras-otros (los tres roles), con las mismas reglas que useCompras. */
export function useComprasOtros({ activo, habilitada = true }: OpcionesConsulta): UseQueryResult<CompraOtro[]> {
  const intervalo = useIntervaloRefresco(activo)
  return useQuery({
    queryKey: claveCompras('otros'),
    queryFn: async () => ordenarCanceladosAlFinal((await api.GET('/api/compras-otros')).data ?? []),
    enabled: habilitada,
    refetchInterval: intervalo,
    refetchOnWindowFocus: activo,
  })
}

/** Recarga tras escribir (spec 4b §7): las dos tablas de Pedidos, Stock actual (`['componentes', …]`) y la campana entera
 *  (`['notificaciones', …]`: contador, solicitudes que el lote marca GESTIONADA y alertas de stock). Literales: un módulo no
 *  importa de otro. El JavaFX recarga stock solo en algunas acciones; aquí siempre (diferencia inocua, §10). */
export function useRecargaPedidos(): () => void {
  const qc = useQueryClient()
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: CLAVE_COMPRAS })
    void qc.invalidateQueries({ queryKey: ['componentes'] })
    void qc.invalidateQueries({ queryKey: ['notificaciones'] })
  }, [qc])
}

export type AccionTransicion = 'confirmar' | 'confirmar-recibido' | 'confirmar-parcial' | 'recibir-resto' | 'confirmar-alterado' | 'cancelar' | 'desrecibir' | 'borrar'

function exigirCantidad(cantidad: number | undefined): number {
  if (cantidad === undefined) throw new Error('Falta la cantidad de la recepción')
  return cantidad
}

/** Cuerpos de hoy (inventario §7.1): `{updatedAt}`, `{cantidadRecibida, updatedAt}`, `{cantidadExtra, updatedAt}`;
 *  el DELETE va sin cuerpo (ni updatedAt). Una llamada por ruta literal para que openapi-fetch tipe cada cuerpo. */
async function transicionCompra(accion: AccionTransicion, p: CompraComponente, cantidad: number | undefined) {
  const params = { path: { idCompra: p.idCompra } }
  const updatedAt = p.updatedAt
  switch (accion) {
    case 'confirmar':
      return api.PATCH('/api/compras/{idCompra}/confirmar', { params, body: { updatedAt } })
    case 'confirmar-recibido':
      return api.PATCH('/api/compras/{idCompra}/confirmar-recibido', { params, body: { updatedAt } })
    case 'confirmar-parcial':
      return api.PATCH('/api/compras/{idCompra}/confirmar-parcial', { params, body: { cantidadRecibida: exigirCantidad(cantidad), updatedAt } })
    case 'recibir-resto':
      return api.PATCH('/api/compras/{idCompra}/recibir-resto', { params, body: { cantidadExtra: exigirCantidad(cantidad), updatedAt } })
    case 'confirmar-alterado':
      return api.PATCH('/api/compras/{idCompra}/confirmar-alterado', { params, body: { updatedAt } })
    case 'cancelar':
      return api.PATCH('/api/compras/{idCompra}/cancelar', { params, body: { updatedAt } })
    case 'desrecibir':
      return api.PATCH('/api/compras/{idCompra}/desrecibir', { params, body: { updatedAt } })
    case 'borrar':
      return api.DELETE('/api/compras/{idCompra}', { params })
  }
}

async function transicionOtro(accion: AccionTransicion, p: CompraOtro, cantidad: number | undefined) {
  const params = { path: { id: p.idCompraOtro } }
  const updatedAt = p.updatedAt
  switch (accion) {
    case 'confirmar':
      return api.PATCH('/api/compras-otros/{id}/confirmar', { params, body: { updatedAt } })
    case 'confirmar-recibido':
      return api.PATCH('/api/compras-otros/{id}/confirmar-recibido', { params, body: { updatedAt } })
    case 'confirmar-parcial':
      return api.PATCH('/api/compras-otros/{id}/confirmar-parcial', { params, body: { cantidadRecibida: exigirCantidad(cantidad), updatedAt } })
    case 'recibir-resto':
      return api.PATCH('/api/compras-otros/{id}/recibir-resto', { params, body: { cantidadExtra: exigirCantidad(cantidad), updatedAt } })
    case 'confirmar-alterado':
      return api.PATCH('/api/compras-otros/{id}/confirmar-alterado', { params, body: { updatedAt } })
    case 'cancelar':
      return api.PATCH('/api/compras-otros/{id}/cancelar', { params, body: { updatedAt } })
    case 'desrecibir':
      return api.PATCH('/api/compras-otros/{id}/desrecibir', { params, body: { updatedAt } })
    case 'borrar':
      return api.DELETE('/api/compras-otros/{id}', { params })
  }
}

/** Las ocho transiciones del menú. El 409 (genérico o el de desrecibir) y el 422 de parcial/resto los traduce la página,
 *  así que silencia el diálogo global; recarga siempre, también con error (calco: el 409 "recarga los datos"). */
export function useTransicionPedido(tipo: TipoPedido): UseMutationResult<unknown, unknown, { accion: AccionTransicion; pedido: Pedido; cantidad?: number }> {
  const recargar = useRecargaPedidos()
  return useMutation({
    mutationFn: ({ accion, pedido, cantidad }: { accion: AccionTransicion; pedido: Pedido; cantidad?: number }) => {
      if (tipo === 'componentes') {
        if (!esCompra(pedido)) throw new Error('El pedido no es de componentes')
        return transicionCompra(accion, pedido, cantidad)
      }
      if (esCompra(pedido)) throw new Error('El pedido no es de otros')
      return transicionOtro(accion, pedido, cantidad)
    },
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}

export type CuerpoEditarCompra = { idProv: number; cantidad: number; esUrgente: boolean; precioUnidad: number; divisa: string; updatedAt: string }
export type CuerpoEditarOtro = CuerpoEditarCompra & { concepto: string }

/** PUT del editor (spec 4b §6). `precioEur` va a null: el servidor lo calcula e ignora el de la petición (P3). */
export function useEditarCompra(): UseMutationResult<unknown, unknown, { idCompra: number; cuerpo: CuerpoEditarCompra }> {
  const recargar = useRecargaPedidos()
  return useMutation({
    mutationFn: ({ idCompra, cuerpo }: { idCompra: number; cuerpo: CuerpoEditarCompra }) =>
      api.PUT('/api/compras/{idCompra}', { params: { path: { idCompra } }, body: { ...cuerpo, precioEur: null } }),
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}

export function useEditarOtro(): UseMutationResult<unknown, unknown, { idCompraOtro: number; cuerpo: CuerpoEditarOtro }> {
  const recargar = useRecargaPedidos()
  return useMutation({
    mutationFn: ({ idCompraOtro, cuerpo }: { idCompraOtro: number; cuerpo: CuerpoEditarOtro }) =>
      api.PUT('/api/compras-otros/{id}', { params: { path: { id: idCompraOtro } }, body: { ...cuerpo, precioEur: null } }),
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}

export type CuerpoLoteCompras = {
  lineas: { idCom: number; idProv: number; cantidad: number; esUrgente: boolean; precioUnidad: number }[]
  solicitudes: { urgentes: number[]; preventivas: number[] }
}
export type CuerpoLoteOtros = { lineas: { idProv: number; concepto: string; cantidad: number; esUrgente: boolean; precioUnidad: number }[] }

/** Alta por lotes (P5): una petición con `Idempotency-Key` (la da el formulario con crearClavesIdempotencia; la misma clave
 *  y el mismo cuerpo devuelven la respuesta guardada sin escribir). Recarga solo si sale bien. */
export function useGuardarLoteCompras(): UseMutationResult<{ idsCreados: number[] }, unknown, { cuerpo: CuerpoLoteCompras; clave: string }> {
  const recargar = useRecargaPedidos()
  return useMutation({
    mutationFn: async ({ cuerpo, clave }: { cuerpo: CuerpoLoteCompras; clave: string }) =>
      (await api.POST('/api/compras/lote', { params: { header: { 'Idempotency-Key': clave } }, body: cuerpo })).data ?? { idsCreados: [] },
    meta: { silenciarError: true },
    onSuccess: recargar,
  })
}

export function useGuardarLoteOtros(): UseMutationResult<{ idsCreados: number[] }, unknown, { cuerpo: CuerpoLoteOtros; clave: string }> {
  const recargar = useRecargaPedidos()
  return useMutation({
    mutationFn: async ({ cuerpo, clave }: { cuerpo: CuerpoLoteOtros; clave: string }) =>
      (await api.POST('/api/compras-otros/lote', { params: { header: { 'Idempotency-Key': clave } }, body: cuerpo })).data ?? { idsCreados: [] },
    meta: { silenciarError: true },
    onSuccess: recargar,
  })
}
