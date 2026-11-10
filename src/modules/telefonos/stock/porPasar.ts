import type {
  FilaAltaNsys, FilaColorNsys, FilaDescartadaNsys, FilaGradoNsys, FilaIgnoradaNsys, FilaSinGradoNsys, PeticionExcel, PorQueTaller, TarjetasPorPasar,
} from '@/shared/api/client'
import { hoyMadrid } from '@/shared/lib/fechas'
import { descripcionMovil, diaNsys, nombreModeloNsys, nombreMovilNsys, textoBateriaRecordada } from '@/shared/lib/telefonoNsys'

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

type FilaConModelo = { modelo: string | null; modeloMaestro: string | null; capacidad: string | null; esEsim?: boolean }

/** «iPhone 13 128GB» de una fila con el modelo del espejo de NSYS; desde la 0.9.24, «iPhone 14 eSIM 256GB» si es eSIM. */
export const modeloDeFila = (f: FilaConModelo): string => descripcionMovil(nombreMovilNsys(f), f.capacidad)

/** «20/10/2026 10:31»: la hora es de Madrid, sin zona; se corta del texto. */
export const textoDesde = (iso: string): string => `${diaNsys(iso)} ${iso.slice(11, 16)}`

const celda = (t: string) => t.replace(/[\t\r\n]+/g, ' ')

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
  revisar: 'Sin grado en NSYS o lo que el ERP no supo calcular: corrígelo en su ficha.',
}

/** 0.9.27 (spec «ignorar» §5.4): la frase que ganan las ayudas de Color, Grado y Revisar. */
const IGNORAR_AYUDA = ' Un vendido o de baja que sale en ámbar tiene trabajo del taller después de la venta o de la baja: si es una devolución, apúntala en NSYS; si no ha vuelto, «ignorar» lo quita de las tres listas hasta que NSYS lo tenga otra vez en la empresa o el taller le haga un trabajo nuevo.'

export const AYUDA: Record<Tarjeta, string> = {
  color: 'Móviles a los que el taller ha cambiado el color. Antes de tocarlos en NSYS, descarga las cajas: la plantilla no lleva la caja y NSYS los deja sin ella. En NSYS: bórralos (se pueden borrar todos de una vez), súbelos otra vez con la plantilla, que lleva el grado que tienen hoy en NSYS (el grado nuevo, si lo hay, va por «Cambio de grado», después), y devuélvelos a su caja con «Location». Cada fila se va sola cuando la importación (cada 30 min) ve el color nuevo en NSYS.' + IGNORAR_AYUDA,
  grado: 'Todos los móviles a los que el taller ha cambiado el grado (chasis → A, batería nueva → 100…), también los que cambian de color: en esos, haz primero el color (si no, la plantilla de color le devolvería el grado de antes). En NSYS el grado se corrige aparte, sin borrar el móvil. Cada fila se va sola cuando la importación ve el grado nuevo.' + IGNORAR_AYUDA,
  altas: 'Móviles que han pasado por el taller y NSYS no conoce. La plantilla lleva lo que sabe el ERP; lo demás (capacidad, color, grado, precio, proveedor) va vacío para rellenarlo en el Excel. Cada fila se va sola cuando la importación los ve en NSYS. Si una fila no debería estar aquí (no es un móvil, es de un cliente…), «descartar» la quita con un motivo; solo vuelve si el taller le hace un trabajo nuevo.',
  revisar: 'Sin grado en NSYS: móviles sin grado que han pasado por el taller desde el 22/10; se van solos cuando NSYS los gradúa o con «Corregir…». Los avisos de color y de deshacer se van con «Revisado» o al corregirlos.' + IGNORAR_AYUDA,
}

export const VACIA: Record<Tarjeta, string> = {
  color: 'Ningún cambio de color pendiente.', grado: 'Ningún cambio de grado pendiente.',
  altas: 'Todos los móviles del taller están en NSYS.', revisar: 'Nada que revisar: todo lo del taller se pudo calcular.',
}

/** Marcada «Hecho» y sin volver: no cuenta ni va en las plantillas ni en «Copiar lista». Una que volvió cuenta otra vez. */
export const marcada = (f: ConHecho): boolean => f.hechoEn !== null && f.hechoVolvio === null
export const pendientes = <T extends ConHecho>(filas: readonly T[]): T[] => filas.filter((f) => !marcada(f))

/** Cuántas filas tiene una tarjeta, cuántas marcadas y cuántas pendientes («Revisar a mano» no lleva «Hecho» y cuenta los
 *  avisos y las filas «Sin grado en NSYS»). */
export function cuentas(t: TarjetasPorPasar, cual: Tarjeta): { total: number; hechos: number; pendientes: number } {
  if (cual === 'revisar') {
    // `?? []`: un servidor anterior a la pieza 4 (vuelta atrás) no manda `sinGrado`.
    const n = t.revisar.length + (t.sinGrado ?? []).length
    return { total: n, hechos: 0, pendientes: n }
  }
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

/** Lo que lleva la plantilla de color (spec §4): lo pendiente con producto, sin los que han vuelto (pieza 4 §6: antes, la
 *  devolución en NSYS). `!f.vueltoDesde`, no `=== null`: un servidor anterior a la pieza 4 (vuelta atrás) no manda el campo
 *  (undefined) y esas filas deben seguir yendo en la plantilla. */
export const paraPlantillaColor = (filas: readonly FilaColorNsys[]): FilaColorNsys[] =>
  pendientes(filas).filter((f) => f.ponerProducto !== null && !f.vueltoDesde)

/** Los que irían en la plantilla de color pero han vuelto (pieza 4 §6). */
export const vueltosFueraDePlantilla = (filas: readonly FilaColorNsys[]): number =>
  pendientes(filas).filter((f) => f.ponerProducto !== null && Boolean(f.vueltoDesde)).length

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
 *  producto, los que llevan «compruébalo» (en amarillo en el Excel) y, desde la pieza 4, los que han vuelto y no van. */
export function avisoPlantillaColor(nombre: string, n: number, sinProducto: number, compruebalo = 0, vueltos = 0): string {
  const partes = [`Descargado «${nombre}» · ${n} ${palabraMoviles(n)} (los marcados «Hecho» no van)`]
  if (sinProducto > 0) partes.push(`${sinProducto} sin producto en NSYS no ${sinProducto === 1 ? 'va' : 'van'}: búscalo a mano`)
  if (compruebalo > 0) partes.push(`${compruebalo} con «compruébalo» (en amarillo): míralo antes de subirlo`)
  if (vueltos > 0) partes.push(`${vueltos} ${vueltos === 1 ? 'ha vuelto y no va' : 'han vuelto y no van'}: haz antes la devolución en NSYS`)
  return partes.join('. ')
}

export const avisoPlantillaAltas = (nombre: string, n: number): string =>
  `Descargado «${nombre}» · ${n} ${palabraMoviles(n)}. Rellena en el Excel lo que va en rojo antes de subirlo`

export const avisoCopiado = (n: number): string =>
  `Copiado: ${n} ${palabraMoviles(n)} con su grado nuevo. Cuando los cambies en NSYS, márcalos «Hecho»`

const CATEGORIA: Record<string, string> = { REPARACION: 'Reparación', GLASS: 'Glass', PULIDO: 'Pulido' }

/** «R20261006_57 · Reparación», con « · asignado» si es una asignación sin terminar (las descartadas no lo dicen). */
export const textoUltimoTrabajo = (f: { ultimoTrabajo: string; categoria: string; abierto?: boolean }): string =>
  `${f.ultimoTrabajo} · ${CATEGORIA[f.categoria] ?? f.categoria}${f.abierto ? ' · asignado' : ''}`

/** El modelo del taller de «No está en NSYS» («iPhone 14»): el código del ERP traducido. */
export const modeloDelTaller = (f: { modelo: string | null }): string => (f.modelo ? nombreModeloNsys(f.modelo, null) : '—')

// ---------------------------------------------------------------- 0.9.22 pieza 3: «descartar» en «No está en NSYS»

export const TITULO_DESCARTAR = 'Descartar de «No está en NSYS»'
/** Lo que va tras el IMEI (en negrita) en la ventana. */
export const EXPLICA_DESCARTAR =
  'deja de salir aquí y no va en la plantilla de altas. Las importaciones de NSYS no lo devuelven; solo sale otra vez si el taller le hace un trabajo nuevo.'
export const EJEMPLOS_MOTIVO = 'Ejemplos: «no es un móvil, es una cámara», «móvil de un cliente, no es stock».'
/** El largo de Taller_descarte.MOTIVO (el servidor da 400 por encima). */
export const MAX_MOTIVO = 500

export const avisoDescartado = (imei: string): string => `Descartado «${imei}»`
export const avisoVuelve = (imei: string): string => `«${imei}» vuelve a la lista`
export const textoVerDescartados = (n: number, abierto: boolean): string => (abierto ? 'Ocultar descartados' : `Ver descartados (${n})`)

/** «Salió otra vez: trabajo nuevo después de que Supertécnico 1 lo descartara el 26/10/2026 12:31 («no es un móvil»)»; sin un
 *  descarte superado, null. */
export function textoDescartadoAntes(f: FilaAltaNsys): string | null {
  if (!f.descartadoAntesEn) return null
  return `Salió otra vez: trabajo nuevo después de que ${f.descartadoAntesPor ?? '—'} lo descartara el ${textoDesde(f.descartadoAntesEn)} («${f.descartadoAntesMotivo ?? ''}»)`
}

/** «Supertécnico 1 · 26/10/2026 12:31» de «Ver descartados». */
export const textoDescartado = (f: FilaDescartadaNsys): string => `${f.descartadoPor ?? '—'} · ${textoDesde(f.descartadoEn)}`

// ---------------------------------------------------------------- 0.9.22 pieza 4: «Sin grado en NSYS» y los que han vuelto

export const ETIQUETA_SIN_GRADO = 'Sin grado en NSYS'
export const QUE_HACER_SIN_GRADO = 'Ponle grado en NSYS: la fila se va sola al importarlo (o «Corregir…» si ya lo sabes)'

/** «NSYS: n/a» (el grado de NSYS tal cual; «NSYS: —» si está vacío). */
export const textoGradoNsys = (f: Pick<FilaSinGradoNsys, 'gradoNsys'>): string =>
  `NSYS: ${f.gradoNsys && f.gradoNsys.trim() !== '' ? f.gradoNsys : '—'}`

/** «Último trabajo: 26/10/2026 · Reparación (R20261026_205)». */
export const textoUltimoTrabajoSinGrado = (f: Pick<FilaSinGradoNsys, 'ultimoTrabajo' | 'ultimoTrabajoEn' | 'categoria'>): string =>
  `Último trabajo: ${diaNsys(f.ultimoTrabajoEn)} · ${CATEGORIA[f.categoria] ?? f.categoria} (${f.ultimoTrabajo})`

/** La batería recordada de la fila («Batería nueva del 26/10 (R…)»); null sin ninguna. */
export const textoBateriaDeFila = (f: Pick<FilaSinGradoNsys, 'bateriaIdRep' | 'bateriaNueva' | 'bateriaEn'>): string | null =>
  f.bateriaIdRep && f.bateriaEn ? textoBateriaRecordada(f.bateriaNueva === true, f.bateriaEn, f.bateriaIdRep) : null

/** La línea ámbar de un vendido o de baja que ha vuelto (pieza 4 §7); null en un móvil en la empresa. */
export function textoVuelta(f: { vendidoEn: string | null; bajaEn: string | null; vueltoDesde: string | null }): string | null {
  if (!f.vueltoDesde) return null
  const desde = diaNsys(f.vueltoDesde)
  if (f.vendidoEn) return `Vendido en NSYS el ${diaNsys(f.vendidoEn)} · el taller lo tiene desde el ${desde}: haz antes la devolución en NSYS`
  return `De baja en NSYS desde el ${diaNsys(f.bajaEn ?? f.vueltoDesde)} · el taller lo tiene desde el ${desde}: míralo antes en NSYS`
}

// ---------------------------------------------------------------- 0.9.26: las cajas del cambio de color

/** Lo que dice la columna «Caja» y el Excel de un móvil que NSYS tiene sin caja. */
export const SIN_CAJA = 'sin caja'

/** La caja de NSYS de una fila de «Cambio de color» (spec «cajas del cambio de color» §3.1): tal cual; sin caja, «sin caja»; con
 *  un servidor anterior a la 0.9.26, que no manda el campo, «—». */
export function textoCaja(caja: string | null | undefined): string {
  if (caja === undefined) return '—'
  return caja !== null && caja.trim() !== '' ? caja : SIN_CAJA
}

/** Los móviles de «⬇ Descargar cajas» (spec §4): los de la plantilla de color (con producto, sin los que han vuelto) también si
 *  están marcados «Hecho»: se marcan al subir la plantilla, que es cuando hacen falta las cajas. */
export const paraCajasColor = (filas: readonly FilaColorNsys[]): FilaColorNsys[] =>
  filas.filter((f) => f.ponerProducto !== null && !f.vueltoDesde)

export const HOJA_CAJAS = 'Cajas cambio de color'

/** Por caja, de la A a la Z sin mirar mayúsculas, y «sin caja» al final. */
function compararCajas(a: string, b: string): number {
  if (a === b) return 0
  if (a === SIN_CAJA) return 1
  if (b === SIN_CAJA) return -1
  return a.localeCompare(b, 'es', { sensitivity: 'base' }) || a.localeCompare(b, 'es')
}

/** La hoja del Excel de las cajas (spec §3.3): IMEI, caja, modelo («iPhone 14 eSIM 256GB») y color nuevo como lo escribe NSYS,
 *  por caja y, dentro, por IMEI; así cada caja es un bloque seguido, como se seleccionan en NSYS. */
export function excelCajasColor(filas: readonly FilaColorNsys[]): PeticionExcel {
  const lineas = paraCajasColor(filas).map((f) => ({ f, caja: textoCaja(f.caja) }))
  lineas.sort((x, y) => compararCajas(x.caja, y.caja) || x.f.imeiSn.localeCompare(y.f.imeiSn))
  return {
    hoja: HOJA_CAJAS,
    columnas: ['IMEI', 'Caja', 'Modelo', 'Color nuevo'],
    filas: lineas.map(({ f, caja }) => [f.imeiSn, caja, modeloDeFila(f), f.colorA ?? '']),
  }
}

/** El nombre que propone «Guardar como»: `Cajas_color_2026-11-06.xlsx`, con el día de Madrid. */
export const nombreCajas = (ahora: Date = new Date()): string => `Cajas_color_${hoyMadrid(ahora)}.xlsx`

/** «Descargado «Cajas_color_2026-11-06.xlsx» · 12 móviles en 3 cajas», de la hoja que se bajó («sin caja» cuenta como una). */
export function avisoCajas(nombre: string, hoja: PeticionExcel): string {
  const n = hoja.filas.length
  const cajas = new Set(hoja.filas.map((fila) => fila[1])).size
  return `Descargado «${nombre}» · ${n} ${palabraMoviles(n)} en ${cajas} ${cajas === 1 ? 'caja' : 'cajas'}`
}

// ---------------------------------------------------------------- 0.9.27: «ignorar» en los vendidos y de baja que salen en ámbar

/** Las tarjetas que pueden tener ignorados y su nombre en `FilaIgnoradaNsys.tarjetas`. */
export const TARJETA_IGNORADO = { color: 'COLOR', grado: 'GRADO', revisar: 'REVISAR' } as const
export type TarjetaConIgnorados = keyof typeof TARJETA_IGNORADO

export const TITULO_IGNORAR = 'No ha vuelto: quitarlo de las listas hasta que NSYS lo tenga otra vez en la empresa (o el taller le haga un trabajo nuevo)'
export const avisoIgnorado = (imei: string): string => `Ignorado «${imei}»: sale en «Ver ignorados» hasta que vuelva`
export const avisoVuelveALasListas = (imei: string): string => `«${imei}» vuelve a las listas`
export const textoVerIgnorados = (n: number, abierto: boolean): string => (abierto ? 'Ocultar ignorados' : `Ver ignorados (${n})`)

/** Los ignorados que saldrían en esta tarjeta. `?? []`: un servidor anterior a la 0.9.27 no manda `ignorados`. */
export const ignoradosDe = (t: TarjetasPorPasar, cual: TarjetaConIgnorados): FilaIgnoradaNsys[] =>
  (t.ignorados ?? []).filter((f) => f.tarjetas.includes(TARJETA_IGNORADO[cual]))

/** «Vendido en NSYS el 26/10/2026» o «De baja en NSYS desde el 15/10/2026». */
export const textoEnNsys = (f: Pick<FilaIgnoradaNsys, 'vendidoEn' | 'bajaEn'>): string =>
  f.vendidoEn ? `Vendido en NSYS el ${diaNsys(f.vendidoEn)}` : `De baja en NSYS desde el ${f.bajaEn ? diaNsys(f.bajaEn) : '—'}`

/** «Supertécnico 1 · 06/11/2026 12:31». */
export const textoIgnorado = (f: Pick<FilaIgnoradaNsys, 'ignoradoPor' | 'ignoradoEn'>): string =>
  `${f.ignoradoPor ?? '—'} · ${textoDesde(f.ignoradoEn)}`

/** «Salió otra vez: trabajo nuevo después de que Supertécnico 1 lo ignorara el 06/11/2026 12:31»; sin un ignorado superado, null.
 *  `!f.ignoradoAntesEn`: un servidor anterior a la 0.9.27 no manda el campo. */
export function textoIgnoradoAntes(f: { ignoradoAntesPor: string | null; ignoradoAntesEn: string | null }): string | null {
  if (!f.ignoradoAntesEn) return null
  return `Salió otra vez: trabajo nuevo después de que ${f.ignoradoAntesPor ?? '—'} lo ignorara el ${textoDesde(f.ignoradoAntesEn)}`
}
