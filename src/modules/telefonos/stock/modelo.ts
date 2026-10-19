import type { MovilBuscado, MovilStock } from '@/shared/api/client'
import { MODELOS_ORDENADOS } from '@/shared/lib/modelos'
import { diaNsys, nombreModeloNsys } from '@/shared/lib/telefonoNsys'
import { CON_DESCUADRE, quienLoTiene, SIN_ASIGNAR, type Quien } from './quien'

/** Reglas puras de «Stock de teléfonos» (0.9.17, spec «Pieza 1 del módulo de teléfonos» §9.2; 0.9.18, spec «Columna
 *  compacta, SKU, Quién lo tiene y Revisado» §4): una fila por modelo con sus capacidades, pestañas de capacidad, filtros
 *  por color, grado, batería, ubicación y técnico, y el orden de la tabla. */

/** Un móvil del stock con «Quién lo tiene» ya calculado a la hora de la carga. */
export type Movil = MovilStock & { quien: Quien }
export type Dimension = 'color' | 'grado' | 'bateria' | 'ubicacion' | 'tecnico'
export type Filtros = Record<Dimension, ReadonlySet<string>>
export type Opcion = { valor: string; cuenta: number }
export type Reparto = { listos: number; taller: number; revision: number }
export type Capacidad = { capacidad: string; stock: number }
/** Una fila de la columna lateral (spec §4.1): un modelo con su total en stock, sus capacidades y el reparto listos /
 *  taller / revisión. `moviles`: los que se ven del modelo (con el interruptor apagado, solo el stock). */
export type ModeloLista = { clave: string; total: number; capacidades: Capacidad[]; reparto: Reparto; moviles: Movil[] }
/** Una pestaña de capacidad de la cabecera del modelo (spec §4.3): `capacidad` null es «Todas»; `activa`, que tiene algo
 *  que enseñar. */
export type Pestana = { capacidad: string | null; stock: number; activa: boolean }

export const FILTROS_VACIOS: Filtros = { color: new Set(), grado: new Set(), bateria: new Set(), ubicacion: new Set(), tecnico: new Set() }
export const BATERIA_NUEVA = 'Nueva (100 %)'
export const BATERIA_ORIGINAL = 'Original'
export const SIN_DATO = '—'
export const ORDEN_GRADOS: readonly string[] = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'MsA+', 'MsA', 'MsA-', 'MsB', 'MsC', 'Ms', 'ID', 'n/a']
/** Las opciones del filtro «Técnico» que no son un técnico: van al final, tras una línea. */
const ESPECIALES_TECNICO: readonly string[] = [SIN_ASIGNAR, CON_DESCUADRE]

/** Añade «Quién lo tiene» a cada móvil. `ahora`: milisegundos de la carga (`dataUpdatedAt`), para el límite del descuadre. */
export function preparar(moviles: MovilStock[], ahora: number): Movil[] {
  return moviles.map((m) => ({ ...m, quien: quienLoTiene(m, ahora) }))
}

/** El modelo de la columna lateral («iPhone 13 Pro»): el código del ERP traducido o, si no, el del maestro. */
export const modeloDe = (m: MovilStock): string => nombreModeloNsys(m.modelo, m.modeloMaestro)
/** La capacidad de un móvil («128GB»), o una raya si NSYS no la sabe. */
export const capacidadDe = (m: MovilStock): string => m.capacidad || SIN_DATO

/** «128GB» → «128 GB» y «1TB» → «1 TB»: pestañas y columna «Cap.». Lo que no entiende, tal cual. */
export function textoCapacidad(c: string): string {
  return c.replace(/^(\d+(?:[.,]\d+)?)\s*(GB|TB)$/i, '$1 $2')
}

/** «128GB» → «128»; «1TB» se queda: las pastillas de la columna lateral. */
export function capacidadCorta(c: string): string {
  return c.replace(/\s*GB$/i, '')
}

/** Los valores de un móvil en una dimensión: uno, salvo en «Técnico», donde puede tener varios (reparación de uno y glass
 *  de otro) o ninguno. */
export function valores(dim: Dimension, m: Movil): string[] {
  switch (dim) {
    case 'color': return [m.color || SIN_DATO]
    case 'grado': return [m.grado || SIN_DATO]
    case 'bateria': return [m.bateriaNueva ? BATERIA_NUEVA : BATERIA_ORIGINAL]
    case 'ubicacion': return [m.ubicacion ?? SIN_DATO]
    case 'tecnico': return m.quien.etiquetas
  }
}

/** Solo el stock vendible cuenta: lo que está de pedido (vendido y sin liberar en NSYS) y las cajas que no cuentan, no. */
export const cuentaComoStock = (m: MovilStock): boolean => m.estado === 'STOCK'

/** ¿Pasa los filtros? Entre filtros, Y; dentro de uno, O: basta con que coincida uno de los valores del móvil. `salvo`: las
 *  dimensiones que no se aplican (para contar las opciones de esa misma dimensión). */
export function pasa(m: Movil, f: Filtros, salvo: readonly Dimension[] = []): boolean {
  return (Object.keys(f) as Dimension[]).every((d) => salvo.includes(d) || f[d].size === 0 || valores(d, m).some((v) => f[d].has(v)))
}

export const esEspecialTecnico = (v: string): boolean => ESPECIALES_TECNICO.includes(v)

const indiceGrado = (g: string) => (ORDEN_GRADOS.includes(g) ? ORDEN_GRADOS.indexOf(g) : ORDEN_GRADOS.length)
export const compararGrados = (a: string, b: string): number => indiceGrado(a) - indiceGrado(b) || a.localeCompare(b, 'es')

function orden(dim: Dimension): (a: string, b: string) => number {
  if (dim === 'grado') return compararGrados
  // Los técnicos por nombre; «Sin asignar» y «Con descuadre», al final y en ese orden.
  if (dim === 'tecnico') return (a, b) => ESPECIALES_TECNICO.indexOf(a) - ESPECIALES_TECNICO.indexOf(b) || a.localeCompare(b, 'es')
  return (a, b) => a.localeCompare(b, 'es')
}

/** Las opciones de una dimensión y cuántos móviles quedarían con cada una, con los demás filtros puestos. */
export function opciones(moviles: Movil[], dim: Dimension, f: Filtros): Opcion[] {
  const cuentas = new Map<string, number>()
  for (const m of moviles) {
    const pasaLosDemas = pasa(m, f, [dim])
    for (const v of valores(dim, m)) cuentas.set(v, (cuentas.get(v) ?? 0) + (pasaLosDemas ? 1 : 0))
  }
  return [...cuentas.keys()].sort(orden(dim)).map((v) => ({ valor: v, cuenta: cuentas.get(v) ?? 0 }))
}

/** Reparto listos / taller / revisión del stock; lo que no cuenta, fuera. */
export function reparto(moviles: MovilStock[]): Reparto {
  const r: Reparto = { listos: 0, taller: 0, revision: 0 }
  for (const m of moviles) {
    if (!cuentaComoStock(m)) continue
    const u = m.ubicacion ?? ''
    if (u === 'Listos') r.listos++
    else if (u.startsWith('Taller')) r.taller++
    else if (u === 'En revisión' || u === 'Devolución') r.revision++
  }
  return r
}

/** Capacidad en GB («64GB» → 64, «1TB» → 1024); null si no se entiende. */
export function capacidadGb(capacidad: string | null | undefined): number | null {
  const r = /^\s*(\d+(?:[.,]\d+)?)\s*(GB|TB)\s*$/i.exec(capacidad ?? '')
  if (!r) return null
  return Number(r[1].replace(',', '.')) * (r[2].toUpperCase() === 'TB' ? 1024 : 1)
}

function compararCapacidades(a: string, b: string): number {
  const ga = capacidadGb(a)
  const gb = capacidadGb(b)
  if (ga !== gb) return ga === null ? 1 : gb === null ? -1 : ga - gb
  return a.localeCompare(b, 'es', { numeric: true })
}

/** Las capacidades de unos móviles, de menor a mayor (las que no se entienden, al final), con cuántas hay en stock. */
export function capacidades(moviles: MovilStock[]): Capacidad[] {
  const mapa = new Map<string, number>()
  for (const m of moviles) mapa.set(capacidadDe(m), (mapa.get(capacidadDe(m)) ?? 0) + (cuentaComoStock(m) ? 1 : 0))
  return [...mapa.keys()].sort(compararCapacidades).map((c) => ({ capacidad: c, stock: mapa.get(c) ?? 0 }))
}

/** Rango del modelo: 0 con modelo del catálogo, 1 solo con modelo del maestro, 2 sin modelo. */
function rango(m: MovilStock): number {
  if (m.modelo) return 0
  return m.modeloMaestro ? 1 : 2
}

/** La columna lateral: una fila por modelo con algo que enseñar (con el interruptor apagado, con stock), en el orden de la
 *  tienda: catálogo del más nuevo al más antiguo, después los que solo tienen modelo del maestro y al final los sin
 *  modelo. El total y las capacidades cuentan solo el stock, también con el interruptor encendido. */
export function modelosLista(moviles: Movil[], verNoCuenta: boolean): ModeloLista[] {
  const mapa = new Map<string, Movil[]>()
  for (const m of moviles) {
    if (!verNoCuenta && !cuentaComoStock(m)) continue
    const clave = modeloDe(m)
    const lista = mapa.get(clave)
    if (lista) lista.push(m)
    else mapa.set(clave, [m])
  }
  const indice = (m: MovilStock) => MODELOS_ORDENADOS.indexOf(m.modelo ?? '')
  return [...mapa.entries()]
    .map(([clave, lista]) => ({ clave, total: lista.filter(cuentaComoStock).length, capacidades: capacidades(lista), reparto: reparto(lista), moviles: lista }))
    .sort((a, b) => {
      const ma = a.moviles[0]
      const mb = b.moviles[0]
      const porRango = rango(ma) - rango(mb)
      if (porRango) return porRango
      if (rango(ma) === 0) return indice(mb) - indice(ma)
      return b.clave.localeCompare(a.clave, 'es', { numeric: true })
    })
}

/** Las pestañas de la cabecera del modelo: «Todas» y una por capacidad que el espejo tiene del modelo, con su número de
 *  stock. La web no tiene un catálogo de capacidades: salen de todos los móviles del modelo que llegan al stock, cuenten o
 *  no. Sin stock, apagada; con el interruptor encendido se puede abrir si tiene algo que no cuenta. */
export function pestanasCapacidad(todos: Movil[], verNoCuenta: boolean): Pestana[] {
  const stock = todos.filter(cuentaComoStock).length
  return [
    { capacidad: null, stock, activa: stock > 0 || (verNoCuenta && todos.length > 0) },
    ...capacidades(todos).map((c) => ({ capacidad: c.capacidad, stock: c.stock, activa: c.stock > 0 || verNoCuenta })),
  ]
}

export function contarFiltros(f: Filtros): number {
  return Object.values(f).reduce((n, s) => n + s.size, 0)
}

/** Orden de la tabla (spec 0.9.18 §4.6): primero lo que cuenta; dentro de eso, los descuadres y los «en caja, sin
 *  asignar»; luego por días, de menos a más (sin días, al final). */
export function ordenarTabla(moviles: Movil[]): Movil[] {
  const aviso = (m: Movil) => (m.quien.descuadre ? 0 : m.quien.enCaja ? 1 : 2)
  const dias = (m: Movil) => m.dias ?? Number.MAX_SAFE_INTEGER
  return [...moviles].sort((a, b) => Number(cuentaComoStock(b)) - Number(cuentaComoStock(a)) || aviso(a) - aviso(b) || dias(a) - dias(b))
}

/** Lo que se dice de un móvil encontrado por el buscador de IMEI. */
export function textoBuscado(m: MovilBuscado): string {
  if (m.estado === 'VENDIDO') return m.fechaVenta ? `Vendido el ${diaNsys(m.fechaVenta)}` : 'Vendido'
  if (m.estado === 'BAJA') return 'Baja en NSYS'
  if (m.estado === 'DE_PEDIDO') return `De pedido · ${m.ubicacion ?? SIN_DATO}`
  if (m.estado === 'NO_CUENTA') return `${m.ubicacion ?? SIN_DATO} · no cuenta como stock`
  return m.ubicacion ?? SIN_DATO
}

/** Muestra de color de la tabla (las del prototipo, en español y en inglés). Las que no están, en gris. */
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
