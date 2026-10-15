import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { api, type CompraComponente, type CompraOtro } from '@/shared/api/client'
import { useIntervaloRefresco } from '@/shared/api/refresco'
import { juntarLineas, ordenarCanceladosAlFinal } from './filtros'
import { esCompra, idPedido, tipoLinea, type Pedido, type TipoLinea, type TipoPedido } from './reglas'

export const CLAVE_COMPRAS = ['compras'] as const
export function claveCompras(tipo: TipoPedido): readonly ['compras', TipoPedido] {
  return ['compras', tipo] as const
}

type OpcionesConsulta = { activo: boolean; habilitada?: boolean }

/** GET /api/compras (los tres roles). `activo = false` congela el sondeo y el refetch por foco con un menú, un diálogo o un
 *  formulario abiertos; `habilitada = false` no la pide (un editor cerrado, por ejemplo). */
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

/** Las dos listas de Pedidos juntas (0.9.15, spec «Añadir otro» §5.1): piezas y otros en una sola lista de líneas. */
export type ConsultaLineas = {
  /** Solo cuando han llegado las dos: con una sola, los bloques saldrían a medias. */
  data: Pedido[] | undefined
  isPending: boolean
  isSuccess: boolean
  isFetching: boolean
  /** La más antigua de las dos (0 = todavía sin datos). */
  dataUpdatedAt: number
  /** Recarga las dos y devuelve la lista junta (undefined si alguna no llega). */
  refetch: (opciones?: { throwOnError?: boolean }) => Promise<Pedido[] | undefined>
}

export function useLineasPedido(opciones: OpcionesConsulta): ConsultaLineas {
  const compras = useCompras(opciones)
  const otros = useComprasOtros(opciones)
  const data = useMemo(
    () => (compras.data === undefined || otros.data === undefined ? undefined : juntarLineas(compras.data, otros.data)),
    [compras.data, otros.data],
  )
  const refetchCompras = compras.refetch
  const refetchOtros = otros.refetch
  const refetch = useCallback(async (o?: { throwOnError?: boolean }) => {
    const [c, x] = await Promise.all([refetchCompras(o), refetchOtros(o)])
    return c.data === undefined || x.data === undefined ? undefined : juntarLineas(c.data, x.data)
  }, [refetchCompras, refetchOtros])
  return {
    data,
    isPending: compras.isPending || otros.isPending,
    isSuccess: compras.isSuccess && otros.isSuccess,
    isFetching: compras.isFetching || otros.isFetching,
    dataUpdatedAt: Math.min(compras.dataUpdatedAt, otros.dataUpdatedAt),
    refetch,
  }
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

/** Las ocho transiciones del menú de una fila. 0.9.15: piezas y otros van en la misma lista, así que la ruta la decide el
 *  tipo de la línea. El 409 (genérico o el de desrecibir) y el 422 de parcial/resto los traduce la página, así que silencia
 *  el diálogo global; recarga siempre, también con error (calco: el 409 "recarga los datos"). */
export function useTransicionPedido(): UseMutationResult<unknown, unknown, { accion: AccionTransicion; pedido: Pedido; cantidad?: number }> {
  const recargar = useRecargaPedidos()
  return useMutation({
    mutationFn: ({ accion, pedido, cantidad }: { accion: AccionTransicion; pedido: Pedido; cantidad?: number }) =>
      (esCompra(pedido) ? transicionCompra(accion, pedido, cantidad) : transicionOtro(accion, pedido, cantidad)),
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}

type CamposEditar = { idProv: number; cantidad: number; esUrgente: boolean; precioUnidad: number; divisa: string; updatedAt: string }
/** `destino` (0.9.9 en piezas, 0.9.15 en otros): solo cuando cambia el proveedor (`idBloque` null = bloque nuevo); null =
 *  regla por defecto del servidor. */
export type CuerpoEditarCompra = CamposEditar & { destino: { idBloque: number | null } | null }
export type CuerpoEditarOtro = CamposEditar & { concepto: string; destino: { idBloque: number | null } | null }

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

/** Un otro del lote (0.9.15): el concepto ya recortado; la divisa es la de su proveedor (el servidor calcula `precioEur`). */
export type LineaOtroLote = { idProv: number; concepto: string; cantidad: number; esUrgente: boolean; precioUnidad: number }

export type CuerpoLoteCompras = {
  lineas: { idCom: number; idProv: number; cantidad: number; esUrgente: boolean; precioUnidad: number }[]
  solicitudes: { urgentes: number[]; preventivas: number[] }
  /** 0.9.9 (spec «Pedidos por bloques» §5.2): bloque de cada proveedor (`idBloque` null = bloque nuevo); null = el
   *  servidor aplica su regla por defecto (abierto más reciente del proveedor o uno nuevo). */
  destinos: { idProv: number; idBloque: number | null }[] | null
  /** 0.9.15 (spec «Añadir otro» §5.2): los otros del pedido; van al mismo bloque que las piezas de su proveedor. */
  otros: LineaOtroLote[]
}

/** Alta por lotes (P5): una petición con `Idempotency-Key` (la da el formulario con crearClavesIdempotencia; la misma clave
 *  y el mismo cuerpo devuelven la respuesta guardada sin escribir). Recarga solo si sale bien. 0.9.15: devuelve también
 *  los ids de los otros creados. */
export function useGuardarLoteCompras(): UseMutationResult<{ idsCreados: number[]; idsOtrosCreados: number[] }, unknown, { cuerpo: CuerpoLoteCompras; clave: string }> {
  const recargar = useRecargaPedidos()
  return useMutation({
    mutationFn: async ({ cuerpo, clave }: { cuerpo: CuerpoLoteCompras; clave: string }) => {
      const r = (await api.POST('/api/compras/lote', { params: { header: { 'Idempotency-Key': clave } }, body: cuerpo })).data
      return { idsCreados: r?.idsCreados ?? [], idsOtrosCreados: r?.idsOtrosCreados ?? [] }
    },
    meta: { silenciarError: true },
    onSuccess: recargar,
  })
}

// ── 0.9.9: bloques de pedido (spec «Pedidos por bloques» §5.3); 0.9.15: con piezas y otros ──────────────────

/** Una línea tal como la ve la tabla: el servidor la comprueba antes de aplicar una acción de bloque (todo o nada).
 *  `idCompra` es el id en su tabla y `tipo` dice cuál (0.9.15: piezas y otros tienen numeración propia). */
export type LineaVista = { idCompra: number; updatedAt: string; tipo: TipoLinea }
export function vistaDe(p: Pedido): LineaVista {
  return { idCompra: idPedido(p), updatedAt: p.updatedAt, tipo: tipoLinea(p) }
}
export type AccionBloque = 'confirmar' | 'recibir' | 'cancelar' | 'borrar'

/** «Mover a bloque ▸»: `idBloque` null = bloque nuevo. Una pieza va por /api/compras y un otro por /api/compras-otros
 *  (0.9.15). La página traduce el 409 y el 422; recarga siempre. */
export function useMoverLinea(): UseMutationResult<unknown, unknown, { pedido: Pedido; idBloque: number | null }> {
  const recargar = useRecargaPedidos()
  return useMutation({
    mutationFn: ({ pedido, idBloque }: { pedido: Pedido; idBloque: number | null }) => {
      const body = { idBloque, updatedAt: pedido.updatedAt }
      return esCompra(pedido)
        ? api.PATCH('/api/compras/{idCompra}/bloque', { params: { path: { idCompra: pedido.idCompra } }, body })
        : api.PATCH('/api/compras-otros/{id}/bloque', { params: { path: { id: pedido.idCompraOtro } }, body })
    },
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}

/** Una llamada por ruta literal para que openapi-fetch tipe cada una. */
async function accionBloque(idBloque: number, accion: AccionBloque, lineas: LineaVista[]) {
  const params = { path: { idBloque } }
  const body = { lineas }
  switch (accion) {
    case 'confirmar':
      return api.POST('/api/bloques-compra/{idBloque}/confirmar', { params, body })
    case 'recibir':
      return api.POST('/api/bloques-compra/{idBloque}/recibir', { params, body })
    case 'cancelar':
      return api.POST('/api/bloques-compra/{idBloque}/cancelar', { params, body })
    case 'borrar':
      return api.POST('/api/bloques-compra/{idBloque}/borrar', { params, body })
  }
}

export function useAccionBloque(): UseMutationResult<unknown, unknown, { idBloque: number; accion: AccionBloque; lineas: LineaVista[] }> {
  const recargar = useRecargaPedidos()
  return useMutation({
    mutationFn: ({ idBloque, accion, lineas }: { idBloque: number; accion: AccionBloque; lineas: LineaVista[] }) => accionBloque(idBloque, accion, lineas),
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}

export function useSepararBloque(): UseMutationResult<{ idBloque: number } | undefined, unknown, { idBloque: number; lineas: LineaVista[] }> {
  const recargar = useRecargaPedidos()
  return useMutation({
    mutationFn: async ({ idBloque, lineas }: { idBloque: number; lineas: LineaVista[] }) =>
      (await api.POST('/api/bloques-compra/{idBloque}/separar', { params: { path: { idBloque } }, body: { lineas } })).data,
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}

export function useJuntarBloque(): UseMutationResult<unknown, unknown, { idBloque: number; destino: number; lineas: LineaVista[] }> {
  const recargar = useRecargaPedidos()
  return useMutation({
    mutationFn: ({ idBloque, destino, lineas }: { idBloque: number; destino: number; lineas: LineaVista[] }) =>
      api.POST('/api/bloques-compra/{idBloque}/juntar', { params: { path: { idBloque } }, body: { destino, lineas } }),
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}

export function useNotaBloque(): UseMutationResult<unknown, unknown, { idBloque: number; nota: string | null; updatedAt: string }> {
  const recargar = useRecargaPedidos()
  return useMutation({
    mutationFn: ({ idBloque, nota, updatedAt }: { idBloque: number; nota: string | null; updatedAt: string }) =>
      api.PATCH('/api/bloques-compra/{idBloque}/nota', { params: { path: { idBloque } }, body: { nota, updatedAt } }),
    meta: { silenciarError: true },
    onSettled: recargar,
  })
}
