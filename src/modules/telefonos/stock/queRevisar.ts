import { hoyMadrid } from '@/shared/lib/fechas'
import { nombreMovilNsys } from '@/shared/lib/telefonoNsys'
import { compararCapacidades, compararModelos, cuentaComoStock, SIN_DATO, textoCapacidad, type Movil } from './modelo'
import { palabraMoviles } from './porPasar'

/** «Qué revisar» (0.9.25, spec «Qué revisar» §2 y §10): de los móviles en stock, los modelos-color con móviles sin grado, lo más
 *  pedido primero («Revisar sin grado»), y los que tienen B que pueden subir a A con un chasis («Subir B a A»). Sustituye a la
 *  hoja PriorizarRevision del Apps Script. Es puro: la pantalla le pasa los móviles ya preparados (con «Quién lo tiene») y los
 *  vendidos de los últimos {@link DIAS_PEDIDOS} días. */

/** Como mucho tantos A en el modelo-color para salir en «Subir B a A» (spec §2.5; desde §10.1, ya no en «Revisar sin grado»). */
export const MAX_A = 1
/** «Pedidos 15 d» (spec §10.2): los vendidos de hoy y los 14 días anteriores, más los de pedido. */
export const DIAS_PEDIDOS = 15
/** «Solo con 3 o más sin revisar» (spec §10.1): los pendientes, sin los del técnico. */
export const MIN_PENDIENTES = 3

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

export type Motivo = 'NADA' | 'NINGUN_A' | 'UN_A' | 'CON_A'
export const TEXTO_MOTIVO: Record<Motivo, string> = { NADA: 'Nada con grado', NINGUN_A: 'Ningún A', UN_A: 'Solo 1 A', CON_A: 'Con A' }
const ORDEN_MOTIVO: Record<Motivo, number> = { NADA: 0, NINGUN_A: 1, UN_A: 2, CON_A: 3 }

/** Lo que hace falta de un móvil para saber su modelo-color: lo tienen los del stock y los vendidos de GET …/vendidos. */
type ConModeloColor = { modelo: string | null; modeloMaestro: string | null; esEsim: boolean; capacidad: string | null; color: string | null }
/** Un vendido de los últimos días (spec §10.2): `MovilVendido` de la API cumple este tipo. */
export type Vendido = ConModeloColor & { imeiSn: string }

/** La clave del modelo-color (spec §2.2): el modelo con « eSIM» si lo es, la capacidad y el color («—» si no se saben). */
const claveDe = (m: ConModeloColor): string => `${nombreMovilNsys(m)}|${m.capacidad || SIN_DATO}|${m.color || SIN_DATO}`

/** Lo común de un modelo-color de una lista: su clave, el nombre del modelo (con « eSIM»), la capacidad tal cual («128GB» o
 *  «—»), el color, cuántos A tiene en stock y cuáles, los móviles de esa lista, ordenados, y los SKU distintos de todos sus
 *  móviles (para buscar; un `n/a` casi nunca tiene). */
export type GrupoBase = {
  clave: string; modelo: string; capacidad: string; color: string; esEsim: boolean; a: number; gradosA: string[]; skus: string[]
  moviles: Movil[]
}
/** `vendidos` y `dePedido`, los de «Pedidos 15 d»; `pedidos`, su suma, que manda en el orden (spec §10.2). */
export type GrupoRevisar = GrupoBase & {
  motivo: Motivo; pendientes: number; conTecnico: number; conGrado: number; vendidos: number; dePedido: number; pedidos: number
}
export type GrupoSubir = GrupoBase & { b: number; bTecnico: number; b100: number; b100Tecnico: number }

type Grupo = { clave: string; modelo: string; capacidad: string; color: string; esEsim: boolean; todos: Movil[] }

/** Los modelos-color del stock (spec §2.1 y §2.2): modelo con « eSIM» si lo es, capacidad y color, con todos sus móviles. */
function grupos(moviles: readonly Movil[]): Grupo[] {
  const mapa = new Map<string, Grupo>()
  for (const m of moviles) {
    if (!cuentaComoStock(m)) continue
    const clave = claveDe(m)
    const g = mapa.get(clave)
    if (g) g.todos.push(m)
    else mapa.set(clave, { clave, modelo: nombreMovilNsys(m), capacidad: m.capacidad || SIN_DATO, color: m.color || SIN_DATO, esEsim: m.esEsim, todos: [m] })
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

/** Un IMEI para cruzar, como `NsysDAO.claveCruce` del servidor: sin espacios de más y en mayúsculas. */
const claveImei = (imeiSn: string): string => imeiSn.trim().toUpperCase()

const sumar = (mapa: Map<string, number>, clave: string) => mapa.set(clave, (mapa.get(clave) ?? 0) + 1)

/** «Revisar sin grado» (spec §10.1): todos los modelos-color con algún móvil sin grado, lo más pedido primero («Pedidos 15 d»:
 *  los `vendidos` y los de pedido de su modelo-color) y, a igualdad, lo que más queda sin revisar; después, por motivo y en el
 *  orden de §2.7. En las cuentas de A y de «con grado» entran todos los móviles del grupo, los tenga un técnico o no. Un vendido
 *  que hoy está de pedido cuenta una vez, como de pedido. */
export function listaRevisar(moviles: readonly Movil[], vendidos: readonly Vendido[] = []): GrupoRevisar[] {
  const dePedido = new Map<string, number>()
  const imeisDePedido = new Set<string>()
  for (const m of moviles) {
    if (m.estado !== 'DE_PEDIDO') continue
    sumar(dePedido, claveDe(m))
    imeisDePedido.add(claveImei(m.imeiSn))
  }
  const vendidosPorClave = new Map<string, number>()
  for (const v of vendidos) if (!imeisDePedido.has(claveImei(v.imeiSn))) sumar(vendidosPorClave, claveDe(v))
  return grupos(moviles).flatMap((g): GrupoRevisar[] => {
    const sinGrado = g.todos.filter((m) => !tieneGrado(m.grado))
    if (sinGrado.length === 0) return []
    const base = comun(g, sinGrado)
    const conGrado = g.todos.length - sinGrado.length
    const tecnico = sinGrado.filter(conTecnico).length
    const motivo: Motivo = conGrado === 0 ? 'NADA' : base.a === 0 ? 'NINGUN_A' : base.a === 1 ? 'UN_A' : 'CON_A'
    const v = vendidosPorClave.get(g.clave) ?? 0
    const p = dePedido.get(g.clave) ?? 0
    return [{ ...base, motivo, pendientes: sinGrado.length - tecnico, conTecnico: tecnico, conGrado, vendidos: v, dePedido: p, pedidos: v + p }]
  }).sort((x, y) => y.pedidos - x.pedidos || y.pendientes - x.pendientes || ORDEN_MOTIVO[x.motivo] - ORDEN_MOTIVO[y.motivo]
    || compararGrupos(x, y))
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

/** «Solo con 3 o más sin revisar» (spec §10.1): encendido, solo los modelos-color con {@link MIN_PENDIENTES} pendientes o más;
 *  apagado, todos. En el mismo orden. */
export const soloTres = (lista: readonly GrupoRevisar[], encendido: boolean): GrupoRevisar[] =>
  encendido ? lista.filter((g) => g.pendientes >= MIN_PENDIENTES) : [...lista]

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

/** La cabecera de «Pedidos 15 d»; si no se pudieron leer las ventas, lo dice (spec §10.2). */
export const cabeceraPedidos = (sinVentas: boolean): string => (sinVentas ? 'Pedidos 15 d (sin ventas)' : 'Pedidos 15 d')
export const TITULO_SIN_VENTAS = 'No se pudieron leer las ventas: solo cuentan los de pedido'
/** Al pasar el ratón por «Pedidos 15 d»: «9 vendidos + 3 de pedido»; sin ventas, solo los de pedido. */
export const tituloPedidos = (g: GrupoRevisar, sinVentas: boolean): string =>
  sinVentas ? `${g.dePedido} de pedido (sin ventas)` : `${g.vendidos} ${g.vendidos === 1 ? 'vendido' : 'vendidos'} + ${g.dePedido} de pedido`

export type TarjetaQR = 'revisar' | 'subir'
export const TARJETAS_QR: readonly TarjetaQR[] = ['revisar', 'subir']
export const NOMBRE_QR: Record<TarjetaQR, string> = { revisar: 'Revisar sin grado', subir: 'Subir B a A' }
export const SUBTITULO_QR: Record<TarjetaQR, string> = {
  revisar: 'n/a en stock, lo más pedido primero', subir: 'B y B100 de modelos con 0 o 1 A',
}
export const AYUDA_QR: Record<TarjetaQR, string> = {
  revisar: 'Los modelos-color con móviles sin grado (n/a). Primero lo que más se pide (vendidos en los últimos 15 días y de pedido ahora) y, a igualdad, lo que más queda sin revisar. Un móvil sale de la lista cuando NSYS o el taller le ponen grado.',
  subir: 'Los modelos-color con móviles B y como mucho un A en stock: candidatos a chasis (B → A; con batería nueva, B100 → A100). Un móvil sale de la lista cuando su grado pasa a A.',
}
export const VACIA_QR: Record<TarjetaQR, string> = {
  revisar: 'Nada que revisar: ningún móvil sin grado en stock.', subir: 'Ningún B que subir.',
}
export const PIE_QR = 'Solo cuenta lo que es stock. Un móvil con un trabajo abierto sale en gris y no cuenta ni va en el Excel. «A» es A+, A o A-, con o sin batería nueva.'
export const SIN_PENDIENTE = 'No hay nada pendiente'
export const TEXTO_SOLO_TRES = 'Solo con 3 o más sin revisar'
export const NINGUNO_TRES = 'Ningún modelo-color con 3 o más sin revisar: apaga «Solo con 3 o más sin revisar» para verlos todos.'

export const palabraGrupos = (n: number): string => (n === 1 ? 'modelo-color' : 'modelos-color')
/** Lo que va junto a la cifra grande de la tarjeta: «modelos-color · 19 móviles». */
export const textoCifra = (c: Cifra): string => `${palabraGrupos(c.grupos)} · ${c.moviles} ${palabraMoviles(c.moviles)}`

// ---------------------------------------------------------------- «⬇ Descargar Excel» (spec §10.3)

/** Lo que se manda a POST /api/stock-telefonos/que-revisar/excel: `PeticionExcel` de la API cumple este tipo. */
export type HojaExcel = { hoja: string; columnas: string[]; filas: string[][] }

/** Los móviles que van en el Excel: los de la lista, sin los del técnico, en el orden de la tabla. */
const delExcel = (g: GrupoBase): Movil[] => g.moviles.filter((m) => !conTecnico(m))

/** Cuántos móviles irán en el Excel (el N del botón). */
export const movilesExcel = (lista: readonly GrupoBase[]): number => lista.reduce((n, g) => n + delExcel(g).length, 0)

const dias = (m: Movil): string => (m.dias === null ? SIN_DATO : String(m.dias))

/** «Revisar sin grado» en el Excel: una fila por móvil, con «Revisado» vacía para marcar a boli. */
export function excelRevisar(lista: readonly GrupoRevisar[], sinVentas: boolean): HojaExcel {
  return {
    hoja: NOMBRE_QR.revisar,
    columnas: ['Modelo', 'Capacidad', 'Color', 'IMEI', 'Ubicación', 'Días en stock', cabeceraPedidos(sinVentas), 'Revisado'],
    filas: lista.flatMap((g) => delExcel(g).map((m) => [
      g.modelo, textoCapacidad(g.capacidad), g.color, m.imeiSn, m.ubicacion ?? SIN_DATO, dias(m), String(g.pedidos), '',
    ])),
  }
}

/** «Subir B a A» en el Excel: una fila por móvil, con su paso y «Hecho» vacía. */
export function excelSubir(lista: readonly GrupoSubir[]): HojaExcel {
  return {
    hoja: NOMBRE_QR.subir,
    columnas: ['Modelo', 'Capacidad', 'Color', 'IMEI', 'Paso', 'Ubicación', 'Días en stock', 'Hecho'],
    filas: lista.flatMap((g) => delExcel(g).map((m) => [
      g.modelo, textoCapacidad(g.capacidad), g.color, m.imeiSn, pasoSubir(m), m.ubicacion ?? SIN_DATO, dias(m), '',
    ])),
  }
}

/** El nombre que propone «Guardar como»: `Que_revisar_sin_grado_2026-11-04.xlsx` (fecha de Madrid). */
export const nombreExcel = (t: TarjetaQR, ahora: Date = new Date()): string =>
  `Que_revisar_${t === 'revisar' ? 'sin_grado' : 'subir_B_a_A'}_${hoyMadrid(ahora)}.xlsx`

/** El aviso al guardar: «Descargado: 12 móviles». */
export const avisoDescargado = (n: number): string => `Descargado: ${n} ${palabraMoviles(n)}`

// ---------------------------------------------------------------- buscar por palabras clave (spec §3.6)

/** Con tantos caracteres o más, una palabra también busca en el IMEI: así «13» o «128» no encuentran IMEIs. */
export const MIN_IMEI = 6

/** Para comparar: sin acentos, sin mayúsculas y sin espacios. */
const plano = (texto: string): string => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '')

/** Las palabras clave de lo escrito en la caja, ya planas; ninguna si está vacía. */
export const palabrasClave = (texto: string): string[] => texto.split(/\s+/).map(plano).filter(Boolean)

const enImei = (palabra: string, imeiSn: string): boolean => palabra.length >= MIN_IMEI && plano(imeiSn).includes(palabra)

/** ¿Busca alguna palabra este móvil por su IMEI? Su modelo-color se abre solo y la fila sale resaltada. */
export const imeiBuscado = (m: Movil, palabras: readonly string[]): boolean => palabras.some((p) => enImei(p, m.imeiSn))

/** Las piezas de la descripción con las que se busca: cada palabra del modelo, la capacidad y el color, y cada uno de los tres
 *  entero y sin espacios («iphone12pro», «128gb», «titanionegro»). */
function piezas(g: GrupoBase): string[] {
  const partes = [g.modelo, g.capacidad === SIN_DATO ? '' : textoCapacidad(g.capacidad), g.color === SIN_DATO ? '' : g.color]
  const codigos = [g.moviles[0]?.modelo ?? '', g.moviles[0]?.modeloMaestro ?? ''].map(plano)
  return [...partes.flatMap((p) => [...p.split(/\s+/).map(plano), plano(p)]), ...codigos].filter(Boolean)
}

/** Una palabra encaja con una pieza: si es un número, la pieza tiene que ser ese número («12» no encuentra «128» ni «512»); si
 *  no, la pieza tiene que empezar por ella («tit» encuentra «titanio»). */
const encaja = (palabra: string, pieza: string): boolean => (/^\d+$/.test(palabra) ? pieza === palabra : pieza.startsWith(palabra))

/** ¿Coincide el modelo-color? Cada palabra tiene que encajar con una pieza de su descripción, ser el principio del SKU de alguno
 *  de sus móviles o (con {@link MIN_IMEI} caracteres o más) estar en el IMEI de uno de los móviles de la lista. */
export function coincide(g: GrupoBase, palabras: readonly string[]): boolean {
  const ps = piezas(g)
  const skus = g.skus.map(plano)
  return palabras.every((p) => ps.some((x) => encaja(p, x)) || skus.some((s) => s.startsWith(p)) || g.moviles.some((m) => enImei(p, m.imeiSn)))
}

/** Los modelos-color que coinciden, en el mismo orden; sin palabras, todos. */
export const filtrar = <G extends GrupoBase>(lista: readonly G[], palabras: readonly string[]): G[] =>
  palabras.length === 0 ? [...lista] : lista.filter((g) => coincide(g, palabras))

export const sinCoincidencias = (texto: string): string => `Ningún modelo-color con «${texto.trim()}».`
