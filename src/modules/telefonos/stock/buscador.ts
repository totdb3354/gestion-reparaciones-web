import { capacidadDe, cuentaComoStock, modeloDe, normalizar, type FiltroSku, type ModeloLista, type Movil } from './modelo'

/** El buscador de la columna lateral (0.9.18, spec «Columna compacta, SKU, Quién lo tiene y Revisado» §4.2): acepta un
 *  modelo («13 pro») o un SKU, entero o el principio, sin mayúsculas ni espacios. Los SKU que cuentan son los del stock. */

export const MAX_SUGERENCIAS = 7
export type SugerenciaSku = { sku: string; modelo: string; capacidad: string; cuenta: number }
/** Adónde lleva el buscador: un modelo, su pestaña de capacidad (null = «Todas») y el filtro de SKU. */
export type Destino = { modelo: string; capacidad: string | null; sku: FiltroSku | null }
export type Resultado = { destino: Destino } | { aviso: string }

const enStockConSku = (m: Movil): m is Movil & { sku: string } => cuentaComoStock(m) && !!m.sku

/** Los SKU en stock que empiezan por lo escrito, a partir de 2 caracteres: los más cortos primero, después los que más
 *  hay y por último por orden alfabético. */
export function sugerenciasSku(moviles: Movil[], texto: string): SugerenciaSku[] {
  const q = normalizar(texto)
  if (q.length < 2) return []
  const mapa = new Map<string, SugerenciaSku>()
  for (const m of moviles.filter(enStockConSku)) {
    if (!normalizar(m.sku).startsWith(q)) continue
    const s = mapa.get(m.sku) ?? { sku: m.sku, modelo: modeloDe(m), capacidad: capacidadDe(m), cuenta: 0 }
    s.cuenta++
    mapa.set(m.sku, s)
  }
  return [...mapa.values()].sort((a, b) => a.sku.length - b.sku.length || b.cuenta - a.cuenta || a.sku.localeCompare(b.sku))
}

/** La lista de modelos con lo escrito: los que lo llevan en el nombre y los que tienen alguno de los SKU sugeridos. */
export function filtrarModelos(lista: ModeloLista[], texto: string, sugerencias: SugerenciaSku[]): ModeloLista[] {
  const q = normalizar(texto)
  if (!q) return lista
  const conSku = new Set(sugerencias.map((s) => s.modelo))
  return lista.filter((g) => normalizar(g.clave).includes(q) || conSku.has(g.clave))
}

/** El modelo que es exactamente lo escrito, con «iPhone» delante o sin él («13 pro» → iPhone 13 Pro). */
export function modeloExacto(lista: ModeloLista[], texto: string): ModeloLista | null {
  const sinIphone = (t: string) => normalizar(t).replace(/^iphone/, '')
  const q = sinIphone(texto)
  if (!q) return null
  return lista.find((g) => sinIphone(g.clave) === q) ?? null
}

/** Filtrar por SKU: los móviles en stock con ese SKU (exacto) o que empiezan por lo escrito. Si son de un modelo, lo abre;
 *  si además son de una capacidad, también la elige. Si algún SKU es igual a lo escrito, el filtro es ese SKU exacto. */
export function aplicarSku(moviles: Movil[], texto: string, exacto: boolean): Resultado {
  const q = normalizar(texto)
  const xs = moviles.filter(enStockConSku).filter((m) => (exacto ? normalizar(m.sku) === q : normalizar(m.sku).startsWith(q)))
  if (xs.length === 0) return { aviso: 'Ningún móvil en stock tiene un SKU que empiece así' }
  const modelos = new Set(xs.map(modeloDe))
  if (modelos.size > 1) return { aviso: `Hay SKU de ${modelos.size} modelos que empiezan así: elige uno o escribe más` }
  const capacidades = new Set(xs.map(capacidadDe))
  const igual = xs.find((m) => normalizar(m.sku) === q)
  return {
    destino: {
      modelo: modeloDe(xs[0]),
      capacidad: capacidades.size === 1 ? [...capacidades][0] : null,
      sku: igual ? { texto: igual.sku, exacto: true } : { texto: texto.trim(), exacto: false },
    },
  }
}

/** Enter sin elegir ningún SKU: si lo escrito es exactamente un modelo y ningún SKU empieza así, abre ese modelo con
 *  «Todas»; si no, filtra por los SKU que empiezan por lo escrito. */
export function resolverEnter(lista: ModeloLista[], moviles: Movil[], texto: string): Resultado {
  const exacto = modeloExacto(lista, texto)
  const q = normalizar(texto)
  const algunSku = moviles.filter(enStockConSku).some((m) => normalizar(m.sku).startsWith(q))
  if (exacto && !algunSku) return { destino: { modelo: exacto.clave, capacidad: null, sku: null } }
  return aplicarSku(moviles, texto, false)
}
