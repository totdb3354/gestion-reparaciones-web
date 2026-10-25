import type { FilaAltaNsys, FilaColorNsys, FilaGradoNsys, FilaPorPasar, PorQueTaller, TarjetasPorPasar } from '@/shared/api/client'
import { descripcionMovil, diaNsys, nombreModeloNsys, SIN_SKU_MAESTRO, textoPoner } from '@/shared/lib/telefonoNsys'

/** Reglas de la lista «Por pasar a NSYS» (0.9.21, spec «SKU del taller» §2.4). */

const DATO: Record<string, string> = { COLOR: 'Color', GRADO: 'Grado' }

/** «Color: a mano · Técnico 1 · «motivo»»; el de una reparación (pieza 2), «Color: reparación R… · Técnico 2 · chasis chai13red
 *  nuevo» (la pieza, sin comillas). */
export function textoPorQue(p: PorQueTaller): string {
  const reparacion = p.origen === 'REPARACION'
  const como = reparacion ? `reparación ${p.idRep ?? '—'}` : 'a mano'
  const motivo = !p.motivo ? null : reparacion ? p.motivo : `«${p.motivo}»`
  return `${DATO[p.dato] ?? p.dato}: ${[como, p.usuario ?? '—', motivo].filter(Boolean).join(' · ')}`
}

/** «iPhone 13 128GB» de una fila con el modelo del espejo de NSYS. */
export const modeloDeFila = (f: { modelo: string | null; modeloMaestro: string | null; capacidad: string | null }): string =>
  descripcionMovil(nombreModeloNsys(f.modelo, f.modeloMaestro), f.capacidad)

/** Lo que dice NSYS hoy: «<producto> · grado <grado>». */
export const textoEnNsys = (f: FilaPorPasar): string => `${f.productoNsys || '—'} · grado ${f.gradoNsys || '—'}`

/** «20/10/2026 10:31»: la hora es de Madrid, sin zona; se corta del texto. */
export const textoDesde = (iso: string): string => `${diaNsys(iso)} ${iso.slice(11, 16)}`

const CABECERA = ['IMEI', 'Modelo', 'En NSYS hoy', 'Poner en NSYS', 'SKU nuevo', 'Por qué', 'Desde']
const celda = (t: string) => t.replace(/[\t\r\n]+/g, ' ')

/** La lista separada por tabuladores, para pegarla en Excel (como «Copiar el resultado» de «Pegar varios IMEIs»). */
export function paraExcel(filas: FilaPorPasar[]): string {
  const lineas = filas.map((f) => [f.imeiSn, modeloDeFila(f), textoEnNsys(f), textoPoner(f.ponerProducto, f.ponerGrado),
    f.sku ?? SIN_SKU_MAESTRO, f.porQue.map(textoPorQue).join(' / '), textoDesde(f.desde)])
  return [CABECERA, ...lineas].map((columnas) => columnas.map(celda).join('\t')).join('\n')
}

// ---------------------------------------------------------------- 0.9.22: cuatro tarjetas (spec «plantillas NSYS» §3)

export type Tarjeta = 'color' | 'grado' | 'altas' | 'revisar'
export const TARJETAS: readonly Tarjeta[] = ['color', 'grado', 'altas', 'revisar']
/** Cómo llama el servidor a las tarjetas que llevan «Hecho». */
export const TARJETA_HECHO = { color: 'COLOR', grado: 'GRADO', altas: 'ALTA' } as const
export type TarjetaConHecho = keyof typeof TARJETA_HECHO
/** La marca «Hecho» de una fila de Color, Grado o No está en NSYS. */
export type ConHecho = Pick<FilaColorNsys, 'hechoPor' | 'hechoEn' | 'hechoVolvio'>

export const NOMBRE: Record<Tarjeta, string> = {
  color: 'Cambio de color', grado: 'Cambio de grado', altas: 'No está en NSYS', revisar: 'Revisar a mano',
}

export const EXPLICACION: Record<Tarjeta, string> = {
  color: 'Cambia el producto: en NSYS, bórralo y súbelo otra vez con la plantilla (con el grado que tiene hoy en NSYS).',
  grado: 'Cambia el grado: se corrige aparte en NSYS, uno a uno. Si el móvil también cambia de color, primero el color.',
  altas: 'NSYS no lo conoce: dalo de alta con la plantilla (rellena lo que falta).',
  revisar: 'El ERP no supo calcularlo: mira el móvil y corrígelo en su ficha.',
}

export const AYUDA: Record<Tarjeta, string> = {
  color: 'Móviles a los que el taller ha cambiado el color. En NSYS: bórralos y súbelos otra vez con la plantilla, que lleva el grado que tienen hoy en NSYS (el grado nuevo, si lo hay, va por «Cambio de grado», después). Cada fila se va sola cuando la importación (cada 30 min) ve el color nuevo en NSYS.',
  grado: 'Todos los móviles a los que el taller ha cambiado el grado (chasis → A, batería nueva → 100…), también los que cambian de color: en esos, haz primero el color (si no, la plantilla de color le devolvería el grado de antes). En NSYS el grado se corrige aparte, sin borrar el móvil. Cada fila se va sola cuando la importación ve el grado nuevo.',
  altas: 'Móviles que han pasado por el taller y NSYS no conoce. La plantilla lleva lo que sabe el ERP; lo demás (capacidad, color, grado, precio, proveedor) va vacío para rellenarlo en el Excel. Cada fila se va sola cuando la importación los ve en NSYS.',
  revisar: 'Al guardar una reparación, el ERP no pudo calcular el color o el grado nuevo, o no pudo deshacer un cambio. Una persona mira el móvil y lo corrige en su ficha («Corregir…»); si NSYS tiene que cambiar, el móvil aparece después en Color o en Grado.',
}

export const VACIA: Record<Tarjeta, string> = {
  color: 'Ningún cambio de color pendiente.', grado: 'Ningún cambio de grado pendiente.',
  altas: 'Todos los móviles del taller están en NSYS.', revisar: 'Nada que revisar: todo lo del taller se pudo calcular.',
}

/** Marcada «Hecho» y sin volver: no cuenta ni va en las plantillas ni en «Copiar lista». Una que volvió cuenta otra vez. */
export const marcada = (f: ConHecho): boolean => f.hechoEn !== null && f.hechoVolvio === null
export const pendientes = <T extends ConHecho>(filas: readonly T[]): T[] => filas.filter((f) => !marcada(f))

/** Cuántas filas tiene una tarjeta, cuántas marcadas y cuántas pendientes («Revisar a mano» no lleva «Hecho»). */
export function cuentas(t: TarjetasPorPasar, cual: Tarjeta): { total: number; hechos: number; pendientes: number } {
  if (cual === 'revisar') return { total: t.revisar.length, hechos: 0, pendientes: t.revisar.length }
  const filas: readonly ConHecho[] = cual === 'color' ? t.color : cual === 'grado' ? t.grado : t.altas
  const hechos = filas.filter(marcada).length
  return { total: filas.length, hechos, pendientes: filas.length - hechos }
}

/** El número de la pestaña (spec §3.1): lo pendiente de las cuatro tarjetas. */
export function totalPendientes(t: TarjetasPorPasar | null | undefined): number {
  return t ? TARJETAS.reduce((n, cual) => n + cuentas(t, cual).pendientes, 0) : 0
}

export const palabraMoviles = (n: number): string => (n === 1 ? 'móvil' : 'móviles')
/** « · 1 hecho» o « · 2 hechos»; sin hechos, nada. */
export const textoHechos = (n: number): string => (n > 0 ? ` · ${n} ${n === 1 ? 'hecho' : 'hechos'}` : '')
/** «3 móviles · 1 hecho». */
export const textoNumero = (total: number, hechos: number): string => `${total} ${palabraMoviles(total)}${textoHechos(hechos)}`

/** Lo que lleva la plantilla de color (spec §4): lo pendiente con producto. */
export const paraPlantillaColor = (filas: readonly FilaColorNsys[]): FilaColorNsys[] =>
  pendientes(filas).filter((f) => f.ponerProducto !== null)

/** «12:31»: la hora de una fecha de Madrid sin zona. */
export const horaDe = (iso: string): string => iso.slice(11, 16)

/** «Marcado «Hecho» a las 12:32, pero NSYS sigue igual»: la importación vio NSYS sin cambiar y la fila cuenta otra vez. */
export function textoVolvio(f: ConHecho): string | null {
  return f.hechoVolvio && f.hechoEn ? `Marcado «Hecho» a las ${horaDe(f.hechoEn)}, pero NSYS sigue igual` : null
}

/** «Copiar lista» de «Cambio de grado» (spec §3.3): IMEI, producto, grado en NSYS y grado nuevo de lo pendiente, separado por
 *  tabuladores para pegarlo en Excel. */
export function listaGrado(filas: readonly FilaGradoNsys[]): string {
  const lineas = pendientes(filas).map((f) => [f.imeiSn, f.productoNsys ?? '—', f.gradoDe ?? '—', f.gradoA ?? '—'])
  return [['IMEI', 'Producto', 'Grado en NSYS', 'Poner grado'], ...lineas].map((c) => c.map(celda).join('\t')).join('\n')
}

/** El aviso de la plantilla de color (spec §4: «el número de móviles y lo que haya que revisar»): los que no van por no tener
 *  producto y los que llevan «compruébalo» (en amarillo en el Excel). */
export function avisoPlantillaColor(nombre: string, n: number, sinProducto: number, compruebalo = 0): string {
  const partes = [`Descargado «${nombre}» · ${n} ${palabraMoviles(n)} (los marcados «Hecho» no van)`]
  if (sinProducto > 0) partes.push(`${sinProducto} sin producto en NSYS no ${sinProducto === 1 ? 'va' : 'van'}: búscalo a mano`)
  if (compruebalo > 0) partes.push(`${compruebalo} con «compruébalo» (en amarillo): míralo antes de subirlo`)
  return partes.join('. ')
}

export const avisoPlantillaAltas = (nombre: string, n: number): string =>
  `Descargado «${nombre}» · ${n} ${palabraMoviles(n)}. Rellena en el Excel lo que va en rojo antes de subirlo`

export const avisoCopiado = (n: number): string =>
  `Copiado: ${n} ${palabraMoviles(n)} con su grado nuevo. Cuando los cambies en NSYS, márcalos «Hecho»`

const CATEGORIA: Record<string, string> = { REPARACION: 'Reparación', GLASS: 'Glass', PULIDO: 'Pulido' }

/** «R20261006_57 · Reparación», con « · asignado» si es una asignación sin terminar. */
export const textoUltimoTrabajo = (f: FilaAltaNsys): string =>
  `${f.ultimoTrabajo} · ${CATEGORIA[f.categoria] ?? f.categoria}${f.abierto ? ' · asignado' : ''}`

/** El modelo del taller de «No está en NSYS» («iPhone 14»): el código del ERP traducido. */
export const modeloDelTaller = (f: FilaAltaNsys): string => (f.modelo ? nombreModeloNsys(f.modelo, null) : '—')
