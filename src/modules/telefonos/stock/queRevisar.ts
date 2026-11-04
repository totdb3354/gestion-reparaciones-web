import { nombreMovilNsys } from '@/shared/lib/telefonoNsys'
import { capacidadDe, compararCapacidades, compararModelos, cuentaComoStock, SIN_DATO, textoCapacidad, type Movil } from './modelo'
import { palabraMoviles } from './porPasar'

/** «Qué revisar» (0.9.25, spec «Qué revisar» §2): de los móviles en stock, los modelos-color con móviles sin grado y pocos A
 *  («Revisar sin grado») y los que tienen B que pueden subir a A con un chasis («Subir B a A»). Sustituye a la hoja
 *  PriorizarRevision del Apps Script. Es puro: la pantalla le pasa los móviles ya preparados (con «Quién lo tiene»). */

/** Como mucho tantos A en el modelo-color para salir en las listas (spec §2.4). */
export const MAX_A = 1

// Con grado (spec §2.3): A+, A, A-, B+, B, B-, C con o sin Ms delante; Ms solo; ID, F, FD y RMA. Sin mirar mayúsculas.
const CON_GRADO = /^(?:ms(?:a\+|a-|a|b\+|b-|b|c)?|a\+|a-|a|b\+|b-|b|c|id|f|fd|rma)$/i
const GRADO_A = /^(?:a\+|a-|a)$/i
const GRADO_B = /^b$/i
const limpio = (grado: string | null | undefined): string => (grado ?? '').trim()

/** ¿Tiene grado? Lo demás (`n/a`, vacío o un código que no es un grado) está sin revisar. */
export const tieneGrado = (grado: string | null | undefined): boolean => CON_GRADO.test(limpio(grado))
/** A+, A o A-, sin Ms (la batería va aparte). */
export const esA = (grado: string | null | undefined): boolean => GRADO_A.test(limpio(grado))
/** Exactamente B, sin Ms: el que sube a A con un chasis. */
export const esB = (grado: string | null | undefined): boolean => GRADO_B.test(limpio(grado))
/** Un móvil con algún trabajo abierto: sale en gris y no cuenta como pendiente (spec §2.6). */
export const conTecnico = (m: Movil): boolean => (m.trabajos ?? []).length > 0

export type Motivo = 'NADA' | 'NINGUN_A' | 'UN_A'
export const TEXTO_MOTIVO: Record<Motivo, string> = { NADA: 'Nada con grado', NINGUN_A: 'Ningún A', UN_A: 'Solo 1 A' }
const ORDEN_MOTIVO: Record<Motivo, number> = { NADA: 0, NINGUN_A: 1, UN_A: 2 }

/** Lo común de un modelo-color de una lista: su clave, el nombre del modelo (con « eSIM»), la capacidad tal cual («128GB» o
 *  «—»), el color, cuántos A tiene en stock y cuáles, los móviles de esa lista, ordenados, y los SKU distintos de todos sus
 *  móviles (para buscar; un `n/a` casi nunca tiene). */
export type GrupoBase = {
  clave: string; modelo: string; capacidad: string; color: string; esEsim: boolean; a: number; gradosA: string[]; skus: string[]
  moviles: Movil[]
}
export type GrupoRevisar = GrupoBase & { motivo: Motivo; pendientes: number; conTecnico: number; conGrado: number }
export type GrupoSubir = GrupoBase & { b: number; bTecnico: number; b100: number; b100Tecnico: number }

type Grupo = { clave: string; modelo: string; capacidad: string; color: string; esEsim: boolean; todos: Movil[] }

/** Los modelos-color del stock (spec §2.1 y §2.2): modelo con « eSIM» si lo es, capacidad y color, con todos sus móviles. */
function grupos(moviles: readonly Movil[]): Grupo[] {
  const mapa = new Map<string, Grupo>()
  for (const m of moviles) {
    if (!cuentaComoStock(m)) continue
    const modelo = nombreMovilNsys(m)
    const capacidad = capacidadDe(m)
    const color = m.color || SIN_DATO
    const clave = `${modelo}|${capacidad}|${color}`
    const g = mapa.get(clave)
    if (g) g.todos.push(m)
    else mapa.set(clave, { clave, modelo, capacidad, color, esEsim: m.esEsim, todos: [m] })
  }
  return [...mapa.values()]
}

/** Los de más días en stock primero (sin días, al final); a igualdad, por IMEI (spec §2.7). */
function ordenarMoviles(moviles: Movil[]): Movil[] {
  const dias = (m: Movil) => m.dias ?? -1
  return [...moviles].sort((x, y) => dias(y) - dias(x) || x.imeiSn.localeCompare(y.imeiSn))
}

/** El orden de los modelos-color (spec §2.7): modelo como la columna lateral, el físico antes que el eSIM, la capacidad como
 *  número y el color por orden alfabético. */
function compararGrupos(x: GrupoBase, y: GrupoBase): number {
  return compararModelos(x.moviles[0], y.moviles[0]) || Number(x.esEsim) - Number(y.esEsim)
    || compararCapacidades(x.capacidad, y.capacidad) || x.color.localeCompare(y.color, 'es')
}

function comun(g: Grupo, deLaLista: Movil[]): GrupoBase {
  const conA = g.todos.filter((m) => esA(m.grado))
  return {
    clave: g.clave, modelo: g.modelo, capacidad: g.capacidad, color: g.color, esEsim: g.esEsim, a: conA.length,
    gradosA: conA.map((m) => limpio(m.grado)),
    skus: [...new Set(g.todos.flatMap((m) => (m.sku ? [m.sku] : [])))],
    moviles: ordenarMoviles(deLaLista),
  }
}

/** «Revisar sin grado» (spec §2.4): los modelos-color con algún móvil sin grado y como mucho {@link MAX_A} A, por motivo y en el
 *  orden de §2.7. En las cuentas de A y de «con grado» entran todos los móviles del grupo, los tenga un técnico o no. */
export function listaRevisar(moviles: readonly Movil[]): GrupoRevisar[] {
  return grupos(moviles).flatMap((g): GrupoRevisar[] => {
    const sinGrado = g.todos.filter((m) => !tieneGrado(m.grado))
    const base = comun(g, sinGrado)
    if (sinGrado.length === 0 || base.a > MAX_A) return []
    const conGrado = g.todos.length - sinGrado.length
    const tecnico = sinGrado.filter(conTecnico).length
    const motivo: Motivo = conGrado === 0 ? 'NADA' : base.a === 0 ? 'NINGUN_A' : 'UN_A'
    return [{ ...base, motivo, pendientes: sinGrado.length - tecnico, conTecnico: tecnico, conGrado }]
  }).sort((x, y) => ORDEN_MOTIVO[x.motivo] - ORDEN_MOTIVO[y.motivo] || compararGrupos(x, y))
}

/** «Subir B a A» (spec §2.5): los modelos-color con algún B y como mucho {@link MAX_A} A, en el orden de §2.7. */
export function listaSubir(moviles: readonly Movil[]): GrupoSubir[] {
  return grupos(moviles).flatMap((g): GrupoSubir[] => {
    const bs = g.todos.filter((m) => esB(m.grado))
    const base = comun(g, bs)
    if (bs.length === 0 || base.a > MAX_A) return []
    const cuantos = (bateria: boolean, tecnico: boolean) => bs.filter((m) => Boolean(m.bateriaNueva) === bateria && conTecnico(m) === tecnico).length
    return [{ ...base, b: cuantos(false, false), bTecnico: cuantos(false, true), b100: cuantos(true, false), b100Tecnico: cuantos(true, true) }]
  }).sort(compararGrupos)
}

export const pendienteRevisar = (g: GrupoRevisar): boolean => g.pendientes > 0
export const pendienteSubir = (g: GrupoSubir): boolean => g.b + g.b100 > 0

/** La cifra de una tarjeta (spec §3.2): modelos-color con algo pendiente y cuántos móviles pendientes suman. */
export type Cifra = { grupos: number; moviles: number }

export function cifraRevisar(lista: readonly GrupoRevisar[]): Cifra {
  const p = lista.filter(pendienteRevisar)
  return { grupos: p.length, moviles: p.reduce((n, g) => n + g.pendientes, 0) }
}

export function cifraSubir(lista: readonly GrupoSubir[]): Cifra {
  const p = lista.filter(pendienteSubir)
  return { grupos: p.length, moviles: p.reduce((n, g) => n + g.b + g.b100, 0) }
}

/** El número de la pestaña (spec §3.1): la suma de las cifras de las dos tarjetas. */
export const totalQueRevisar = (revisar: readonly GrupoRevisar[], subir: readonly GrupoSubir[]): number =>
  cifraRevisar(revisar).grupos + cifraSubir(subir).grupos

/** «iPhone 13 128 GB Azul», sin la capacidad o el color que no se sepan. */
export function descripcion(g: GrupoBase): string {
  return [g.modelo, g.capacidad === SIN_DATO ? null : textoCapacidad(g.capacidad), g.color === SIN_DATO ? null : g.color]
    .filter(Boolean).join(' ')
}

/** El título de «A en stock»: «1 A+», o «Ningún A». */
export const tituloA = (g: GrupoBase): string => (g.a === 0 ? 'Ningún A' : `${g.a} ${g.gradosA.join(', ')}`)

/** El paso de un B en «Subir B a A»: con batería nueva, B100 → A100. */
export const pasoSubir = (m: Movil): string => (m.bateriaNueva ? 'B100 → A100' : 'B → A')

/** «Copiar lista» de «Revisar sin grado» (spec §3.4): lo pendiente, en el orden de la tabla. */
export function textoRevisar(lista: readonly GrupoRevisar[]): string {
  return lista.filter(pendienteRevisar)
    .map((g) => `🔍 REVISAR PRIORITARIO\n${descripcion(g)}\nSin grado: ${g.pendientes} · ${TEXTO_MOTIVO[g.motivo]}`)
    .join('\n\n')
}

/** «Copiar lista» de «Subir B a A»: lo pendiente, sin la parte que valga 0. */
export function textoSubir(lista: readonly GrupoSubir[]): string {
  return lista.filter(pendienteSubir).map((g) => {
    const pasos = [g.b > 0 ? `B → A: ${g.b}` : null, g.b100 > 0 ? `B100 → A100: ${g.b100}` : null].filter(Boolean).join(' · ')
    return `⬆️ SUBIR DE GRADO\n${descripcion(g)}\n${pasos}`
  }).join('\n\n')
}

export type TarjetaQR = 'revisar' | 'subir'
export const TARJETAS_QR: readonly TarjetaQR[] = ['revisar', 'subir']
export const NOMBRE_QR: Record<TarjetaQR, string> = { revisar: 'Revisar sin grado', subir: 'Subir B a A' }
export const SUBTITULO_QR: Record<TarjetaQR, string> = {
  revisar: 'n/a de modelos con 0 o 1 A', subir: 'B y B100 de modelos con 0 o 1 A',
}
export const AYUDA_QR: Record<TarjetaQR, string> = {
  revisar: 'Los modelos-color con móviles sin grado (n/a) y como mucho un A en stock. Primero los que no tienen nada con grado, después los que no tienen ningún A y al final los que solo tienen uno. Un móvil sale de la lista cuando NSYS o el taller le ponen grado.',
  subir: 'Los modelos-color con móviles B y como mucho un A en stock: candidatos a chasis (B → A; con batería nueva, B100 → A100). Un móvil sale de la lista cuando su grado pasa a A.',
}
export const VACIA_QR: Record<TarjetaQR, string> = {
  revisar: 'Nada que revisar: todos los modelos-color con móviles sin grado tienen 2 A o más.', subir: 'Ningún B que subir.',
}
export const PIE_QR = 'Solo cuenta lo que es stock. Un móvil con un trabajo abierto sale en gris y no cuenta ni se copia. «A» es A+, A o A-, con o sin batería nueva.'
export const SIN_PENDIENTE = 'No hay nada pendiente'

export const palabraGrupos = (n: number): string => (n === 1 ? 'modelo-color' : 'modelos-color')
/** Lo que va junto a la cifra grande de la tarjeta: «modelos-color · 19 móviles». */
export const textoCifra = (c: Cifra): string => `${palabraGrupos(c.grupos)} · ${c.moviles} ${palabraMoviles(c.moviles)}`
export const avisoCopiadoLista = (n: number): string => `Copiada la lista: ${n} ${palabraGrupos(n)}`

// ---------------------------------------------------------------- buscar por palabras clave (spec §3.6)

/** Con tantos caracteres o más, una palabra también busca en el IMEI: así «13» o «128» no encuentran IMEIs. */
export const MIN_IMEI = 6

/** Para comparar: sin acentos, sin mayúsculas y sin espacios. */
const plano = (texto: string): string => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '')

/** Las palabras clave de lo escrito en la caja, ya planas; ninguna si está vacía. */
export const palabrasClave = (texto: string): string[] => texto.split(/\s+/).map(plano).filter(Boolean)

const enImei = (palabra: string, imeiSn: string): boolean => palabra.length >= MIN_IMEI && plano(imeiSn).includes(palabra)

/** ¿Busca alguna palabra este móvil por su IMEI? Su modelo-color se abre solo y la fila sale resaltada. */
export const imeiBuscado = (m: Movil, palabras: readonly string[]): boolean => palabras.some((p) => enImei(p, m.imeiSn))

/** ¿Coincide el modelo-color? Cada palabra tiene que estar en su descripción, en el SKU de alguno de sus móviles o (con
 *  {@link MIN_IMEI} caracteres o más) en el IMEI de uno de los móviles de la lista. */
export function coincide(g: GrupoBase, palabras: readonly string[]): boolean {
  const desc = plano(descripcion(g))
  const skus = g.skus.map(plano)
  return palabras.every((p) => desc.includes(p) || skus.some((s) => s.includes(p)) || g.moviles.some((m) => enImei(p, m.imeiSn)))
}

/** Los modelos-color que coinciden, en el mismo orden; sin palabras, todos. */
export const filtrar = <G extends GrupoBase>(lista: readonly G[], palabras: readonly string[]): G[] =>
  palabras.length === 0 ? [...lista] : lista.filter((g) => coincide(g, palabras))

export const sinCoincidencias = (texto: string): string => `Ningún modelo-color con «${texto.trim()}».`
