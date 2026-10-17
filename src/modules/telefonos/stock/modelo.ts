import type { MovilBuscado, MovilStock } from '@/shared/api/client'
import { MODELOS_ORDENADOS } from '@/shared/lib/modelos'
import { diaNsys, nombreModeloNsys, textoEstadoMovil } from '@/shared/lib/telefonoNsys'

/** Reglas puras de «Stock de teléfonos» (0.9.17, spec «Pieza 1 del módulo de teléfonos» §9.2): grupos modelo + capacidad
 *  con sus totales y filtros de un clic por color, grado, batería, ubicación y estado. */

export type Dimension = 'color' | 'grado' | 'bateria' | 'ubicacion' | 'estado'
export type Filtros = Record<Dimension, ReadonlySet<string>>
export type Opcion = { valor: string; cuenta: number }
export type Totales = { total: number; libres: number; listos: number; taller: number; revision: number; noCuentan: number }
export type Grupo = { clave: string; sinModelo: boolean; moviles: MovilStock[]; totales: Totales }

export const FILTROS_VACIOS: Filtros = { color: new Set(), grado: new Set(), bateria: new Set(), ubicacion: new Set(), estado: new Set() }
export const BATERIA_NUEVA = 'Nueva (100 %)'
export const BATERIA_ORIGINAL = 'Original'
export const SIN_DATO = '—'
const ORDEN_GRADOS = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'MsA+', 'MsA', 'MsA-', 'MsB', 'MsC', 'Ms', 'ID', 'n/a']

/** Grupo de la lista de la izquierda: modelo + capacidad («iPhone 13 128GB»). */
export function grupoDe(m: MovilStock): string {
  return [nombreModeloNsys(m.modelo, m.modeloMaestro), m.capacidad].filter(Boolean).join(' ')
}

export function valor(dim: Dimension, m: MovilStock): string {
  switch (dim) {
    case 'color': return m.color || SIN_DATO
    case 'grado': return m.grado || SIN_DATO
    case 'bateria': return m.bateriaNueva ? BATERIA_NUEVA : BATERIA_ORIGINAL
    case 'ubicacion': return m.ubicacion ?? SIN_DATO
    case 'estado': return textoEstadoMovil(m.estado)
  }
}

/** Solo el stock vendible cuenta: lo que está de pedido (vendido y sin liberar en NSYS) y las cajas que no cuentan, no. */
export const cuentaComoStock = (m: MovilStock): boolean => m.estado === 'STOCK'

/** ¿Pasa los filtros? `salvo`: una dimensión que no se aplica (para contar las opciones de esa misma dimensión). */
export function pasa(m: MovilStock, f: Filtros, salvo?: Dimension): boolean {
  return (Object.keys(f) as Dimension[]).every((d) => d === salvo || f[d].size === 0 || f[d].has(valor(d, m)))
}

/** Las opciones de una dimensión y cuántos móviles quedarían con cada una, con los demás filtros puestos. */
export function opciones(moviles: MovilStock[], dim: Dimension, f: Filtros): Opcion[] {
  const cuentas = new Map<string, number>()
  for (const m of moviles) {
    const v = valor(dim, m)
    if (!cuentas.has(v)) cuentas.set(v, 0)
    if (pasa(m, f, dim)) cuentas.set(v, (cuentas.get(v) ?? 0) + 1)
  }
  const valores = [...cuentas.keys()]
  const indice = (g: string) => (ORDEN_GRADOS.includes(g) ? ORDEN_GRADOS.indexOf(g) : ORDEN_GRADOS.length)
  valores.sort(dim === 'grado' ? (a, b) => indice(a) - indice(b) || a.localeCompare(b, 'es') : (a, b) => a.localeCompare(b, 'es'))
  return valores.map((v) => ({ valor: v, cuenta: cuentas.get(v) ?? 0 }))
}

/** Totales de un grupo: solo cuentan los que cuentan como stock; los demás van aparte en `noCuentan`. */
export function totales(moviles: MovilStock[]): Totales {
  const t: Totales = { total: 0, libres: 0, listos: 0, taller: 0, revision: 0, noCuentan: 0 }
  for (const m of moviles) {
    if (!cuentaComoStock(m)) {
      t.noCuentan++
      continue
    }
    t.total++
    t.libres++
    const u = m.ubicacion ?? ''
    if (u === 'Listos') t.listos++
    else if (u.startsWith('Taller')) t.taller++
    else if (u === 'En revisión' || u === 'Devolución') t.revision++
  }
  return t
}

/** Capacidad en GB («64GB» → 64, «1TB» → 1024); null si no se entiende. */
export function capacidadGb(capacidad: string | null | undefined): number | null {
  const r = /^\s*(\d+(?:[.,]\d+)?)\s*(GB|TB)\s*$/i.exec(capacidad ?? '')
  if (!r) return null
  return Number(r[1].replace(',', '.')) * (r[2].toUpperCase() === 'TB' ? 1024 : 1)
}

/** Rango del grupo: 0 con modelo del catálogo, 1 solo con modelo del maestro, 2 sin modelo. */
function rango(m: MovilStock): number {
  if (m.modelo) return 0
  return m.modeloMaestro ? 1 : 2
}

/** Grupos modelo + capacidad en el orden de la tienda: modelos del catálogo del más nuevo al más antiguo, después los que
 *  solo tienen modelo del maestro y al final los que no tienen modelo; dentro de un modelo, capacidad de menor a mayor. */
export function agrupar(moviles: MovilStock[], verNoCuenta: boolean): Grupo[] {
  const mapa = new Map<string, MovilStock[]>()
  for (const m of moviles) {
    if (!verNoCuenta && !cuentaComoStock(m)) continue
    const clave = grupoDe(m)
    const lista = mapa.get(clave)
    if (lista) lista.push(m)
    else mapa.set(clave, [m])
  }
  const indice = (m: MovilStock) => MODELOS_ORDENADOS.indexOf(m.modelo ?? '')
  return [...mapa.entries()]
    .map(([clave, lista]) => ({ clave, sinModelo: !lista[0].modelo && !lista[0].modeloMaestro, moviles: lista, totales: totales(lista) }))
    .sort((a, b) => {
      const ma = a.moviles[0]
      const mb = b.moviles[0]
      const porRango = rango(ma) - rango(mb)
      if (porRango) return porRango
      if (rango(ma) === 0 && indice(ma) !== indice(mb)) return indice(mb) - indice(ma)
      if (rango(ma) === 1 && ma.modeloMaestro !== mb.modeloMaestro) return (mb.modeloMaestro ?? '').localeCompare(ma.modeloMaestro ?? '', 'es', { numeric: true })
      const ga = capacidadGb(ma.capacidad)
      const gb = capacidadGb(mb.capacidad)
      if (ga !== gb) return ga === null ? 1 : gb === null ? -1 : ga - gb
      return a.clave.localeCompare(b.clave, 'es', { numeric: true })
    })
}

export function contarFiltros(f: Filtros): number {
  return Object.values(f).reduce((n, s) => n + s.size, 0)
}

/** Orden de la tabla: por color y los que llevan más días arriba. */
export function ordenarTabla(moviles: MovilStock[]): MovilStock[] {
  return [...moviles].sort((a, b) => (a.color ?? '').localeCompare(b.color ?? '', 'es') || (b.dias ?? 0) - (a.dias ?? 0))
}

/** Lo que se dice de un móvil encontrado por el buscador de IMEI. */
export function textoBuscado(m: MovilBuscado): string {
  if (m.estado === 'VENDIDO') return m.fechaVenta ? `Vendido el ${diaNsys(m.fechaVenta)}` : 'Vendido'
  if (m.estado === 'BAJA') return 'Baja en NSYS'
  if (m.estado === 'DE_PEDIDO') return `De pedido · ${m.ubicacion ?? SIN_DATO}`
  if (m.estado === 'NO_CUENTA') return `${m.ubicacion ?? SIN_DATO} · no cuenta como stock`
  return m.ubicacion ?? SIN_DATO
}

/** Muestra de color de los chips y de la tabla (las del prototipo, en español y en inglés). Las que no están, en gris. */
const MUESTRAS: Record<string, string> = {
  azul: '#3b6fd1', blue: '#3b6fd1', medianoche: '#1d2533', midnight: '#1d2533', blanco: '#f4f4f4', white: '#f4f4f4',
  'blanco estelar': '#f4f1ea', starlight: '#f4f1ea', rosa: '#f3b6c7', pink: '#f3b6c7', morado: '#b9a6dc', purple: '#b9a6dc',
  verde: '#9cc9a6', green: '#9cc9a6', rojo: '#c8323a', red: '#c8323a', negro: '#222222', black: '#222222',
  lavanda: '#cdbfe8', lavender: '#cdbfe8', amarillo: '#f2d46b', yellow: '#f2d46b', plata: '#d8d8d8', silver: '#d8d8d8',
  oro: '#e6cfa1', gold: '#e6cfa1', grafito: '#4a4a4c', graphite: '#4a4a4c', 'gris espacial': '#5b5d61', 'space gray': '#5b5d61',
}

export function muestraColor(color: string | null | undefined): string {
  return (color && MUESTRAS[color.trim().toLowerCase()]) || '#cccccc'
}
