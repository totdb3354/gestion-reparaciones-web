import type { Atributos, MovilUnidad, PedidoVista, UnidadVista } from '@/shared/api/client'

/** Reglas puras de «Pedidos» (0.9.26, spec pieza 2 §9.2). */

export type GrupoEstado = 'sin' | 'nocuadra' | 'aviso' | 'taller' | 'cuadra'

export const GRUPOS: { clave: GrupoEstado; texto: string }[] = [
  { clave: 'sin', texto: 'Sin móvil' }, { clave: 'nocuadra', texto: 'No cuadra' }, { clave: 'aviso', texto: 'Con aviso' },
  { clave: 'taller', texto: 'En el taller' }, { clave: 'cuadra', texto: 'Cuadra' },
]

export function grupoDe(estado: string): GrupoEstado {
  switch (estado) {
    case 'SIN_MOVIL': return 'sin'
    case 'EN_TALLER': return 'taller'
    case 'CUADRA': return 'cuadra'
    case 'CON_AVISO': return 'aviso'
    default: return 'nocuadra'
  }
}

export const CANALES: { clave: string; texto: string }[] = [
  { clave: 'AMAZON', texto: 'Amazon' }, { clave: 'AMAZON_STOCKROOM', texto: 'Amazon Stockroom' },
  { clave: 'DISTRIBUIDORES', texto: 'Distribuidores' }, { clave: 'PARTICULARES', texto: 'Particulares' },
  { clave: 'BACKIPHONE', texto: 'BackiPhone' }, { clave: 'SIMULADOR', texto: 'Simulador' },
]

export const textoCanal = (canal: string): string => CANALES.find((c) => c.clave === canal)?.texto ?? canal
export const dondeTeclear = (canal: string): string => (canal === 'SIMULADOR' ? 'el Simulador' : 'PEDIDOS 2026')

export type Filtros = { canales: Set<string>; grupos: Set<GrupoEstado>; texto: string }

/** Los pedidos con solo sus unidades que pasan los filtros; un pedido sin unidades no sale. */
export function filtrar(pedidos: PedidoVista[], f: Filtros): PedidoVista[] {
  const q = f.texto.trim().toLowerCase()
  return pedidos
    .filter((p) => f.canales.size === 0 || f.canales.has(p.canal))
    .map((p) => ({
      ...p,
      unidades: p.unidades.filter((u) => {
        if (f.grupos.size > 0 && !f.grupos.has(grupoDe(u.estado))) return false
        if (!q) return true
        return [p.numero, u.otroOrderId, p.cliente, u.sku, u.imei].some((t) => t?.toLowerCase().includes(q))
      }),
    }))
    .filter((p) => p.unidades.length > 0)
}

/** Unidades por canal (de todos los pedidos) y por grupo de estado (dentro de los canales elegidos). */
export function recuentos(pedidos: PedidoVista[], canales: Set<string>) {
  const porCanal: Record<string, number> = {}
  const porGrupo: Record<GrupoEstado, number> = { sin: 0, nocuadra: 0, aviso: 0, taller: 0, cuadra: 0 }
  for (const p of pedidos) {
    porCanal[p.canal] = (porCanal[p.canal] ?? 0) + p.unidades.length
    if (canales.size > 0 && !canales.has(p.canal)) continue
    for (const u of p.unidades) porGrupo[grupoDe(u.estado)]++
  }
  return { porCanal, porGrupo }
}

/** Con 3 o más unidades que cuadran, se pliegan en una línea salvo que el pedido esté desplegado. */
export function plegar(unidades: UnidadVista[], expandido: boolean) {
  const cuadran = unidades.filter((u) => u.estado === 'CUADRA')
  const plegable = cuadran.length >= 3
  if (!plegable || expandido) return { visibles: unidades, plegadas: 0, plegable }
  return { visibles: unidades.filter((u) => u.estado !== 'CUADRA'), plegadas: cuadran.length, plegable }
}

export type Diferencia = { dato: string; pide: string; es: string; distinto: boolean; taller: string }

const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** `motivo`: el de la unidad; con «grado que no se vende» el taller no puede arreglarlo (hay que cambiar el IMEI). */
export function diferencias(pide: Atributos, m: MovilUnidad, motivo?: string | null): Diferencia[] {
  const filas: [string, string, string, string][] = [
    ['Modelo', `iPhone ${pide.modelo ?? '—'}`, `iPhone ${m.modeloMaestro ?? m.modelo ?? '—'}`, 'nunca'],
    ['Capacidad', pide.capacidad ?? '—', m.capacidad ?? '—', 'nunca'],
    ['eSIM', pide.esEsim ? 'sí' : 'no', m.esEsim ? 'sí' : 'no', 'nunca'],
    ['Color', pide.color ?? '—', m.color ?? '—', 'sí (chasis)'],
    ['Grado', pide.grado ?? '—', m.grado ?? '—', motivo === 'GRADO_NO_VENDIBLE' ? 'no' : 'sí'],
  ]
  return filas.map(([dato, a, b, taller]) => ({ dato, pide: a, es: b, distinto: !igual(a, b), taller }))
}

const TEXTOS: Record<string, string> = {
  NO_EN_NSYS: 'No cuadra: no está en NSYS',
  'NO_CUADRA:MODELO': 'No cuadra: el modelo, la capacidad o el eSIM no son los del pedido',
  'NO_CUADRA:GRADO_NO_VENDIBLE': 'No cuadra: ese grado no se vende así',
  'NO_CUADRA:SKU_DESCONOCIDO': 'No cuadra: el maestro no conoce el SKU del pedido',
  'NECESITA_TALLER:C_SIN_REPARAR': 'No cuadra, necesita taller: un C no se vende sin reparar',
  'NECESITA_TALLER:COLOR_O_GRADO': 'No cuadra, necesita taller: el color o el grado no son los del pedido',
  'CON_AVISO:MS': 'Cuadra, con aviso: es Ms (con marcas); míralo antes',
  'CON_AVISO:B_POR_A': 'Cuadra, con aviso: B por A (en Amazon un B puede ir por A; míralo antes)',
}

export function textoEstado(u: UnidadVista): string {
  if (u.estado === 'SIN_MOVIL') return 'Sin móvil'
  if (u.estado === 'CUADRA') return `Cuadra${u.movil.ubicacion ? ` · ${u.movil.ubicacion}` : ''}`
  if (u.estado === 'EN_TALLER') {
    const quien = [...new Set(u.movil.trabajos.map((t) => t.tecnico))].join(', ')
    return `En el taller${quien ? ` con ${quien}` : ''} · tiene que acabar en ${u.sku}`
  }
  return TEXTOS[`${u.estado}:${u.motivo}`] ?? TEXTOS[u.estado] ?? u.estado
}

export function queHacer(u: UnidadVista, canal: string): string | null {
  if (u.estado === 'SIN_MOVIL') return `Tecléalo en ${dondeTeclear(canal)}, como hoy. El ERP lo lee en unos minutos.`
  if (u.estado === 'NO_EN_NSYS') return `Revisa el IMEI en ${dondeTeclear(canal)}: NSYS no lo tiene (mal tecleado o sin dar de alta).`
  if (u.estado === 'NO_CUADRA' && u.motivo === 'GRADO_NO_VENDIBLE') return `Hay que cambiar el IMEI en ${dondeTeclear(canal)}: ese grado no se vende.`
  if (u.estado === 'NO_CUADRA' && u.motivo === 'MODELO')
    return `Hay que cambiar el IMEI en ${dondeTeclear(canal)}: el taller no cambia eso.`
  if (u.estado === 'NECESITA_TALLER') return 'Hay que asignarle el trabajo en Asignaciones.'
  if (u.estado === 'EN_TALLER') return 'Es lo normal: se vende mientras se repara. No es un error.'
  return null
}

const corto = (imei: string) => `${imei.slice(0, 4)}…${imei.slice(-4)}`

export function resumenMovil(u: UnidadVista): string {
  if (!u.imei) return 'sin móvil'
  if (u.estado === 'EN_TALLER') {
    const quien = u.movil.trabajos[0]?.tecnico
    return `${corto(u.imei)}${quien ? ` · con ${quien}` : ''}`
  }
  return `${corto(u.imei)}${u.movil.ubicacion ? ` · ${u.movil.ubicacion}` : ''}`
}

/** «hoy», «ayer» o «hace N días» entre la fecha del pedido (hora de Madrid, del servidor) y hoy en Madrid («AAAA-MM-DD»). */
export function hace(fecha: string, hoy: string): string {
  const dia = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)))
  const n = Math.round((dia(hoy) - dia(fecha)) / 86_400_000)
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`
}

/** Las filas de PEDIDOS 2026 de cada Amazon (spec pieza 2, ajuste 19): cada canal se reparte solo con las suyas. */
const FILAS_AMAZON: Record<string, string> = { AMAZON: '«AMZ»', AMAZON_STOCKROOM: '«FNSK» o «FSNK»' }

/** Por qué una unidad de Amazon lleva «sin pedido concreto» (decisión del 04/11). Cuenta solo las unidades de su canal
 *  (`canal`, el del pedido de la unidad), porque Amazon y Stockroom se reparten cada uno con sus filas (ajuste 19). */
export function textoSinPedidoConcreto(u: UnidadVista, canal: string, pedidos: PedidoVista[]): string {
  const delSku = pedidos.filter((p) => p.canal === canal)
    .flatMap((p) => p.unidades).filter((x) => x.sku.toLowerCase() === u.sku.toLowerCase())
  const n = delSku.filter((x) => x.sinPedidoConcreto && x.imei).length
  return `En PEDIDOS 2026 hay ${n} IMEI${n === 1 ? '' : 's'} tecleado${n === 1 ? '' : 's'} para ${u.sku} en filas `
    + `${FILAS_AMAZON[canal] ?? '«AMZ»'} sin «Pedido Amazon». El ERP se ${n === 1 ? 'lo da al pedido más antiguo' : `los da a los ${n} pedidos más antiguos`} `
    + `de ese SKU (hay ${delSku.length} pendiente${delSku.length === 1 ? '' : 's'}): el móvil más avanzado va al pedido más `
    + 'antiguo, como hoy al preparar el envío.'
}
