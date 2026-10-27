import { traducirModelo } from './modelos'

/** Piezas del espejo de NSYS (0.9.17, spec «Pieza 1 del módulo de teléfonos») que usan dos módulos: el stock de teléfonos
 *  y el detalle del IMEI del taller. */

/** Nombre de un modelo de NSYS: el código del ERP traducido o, si no está en el catálogo, el texto del maestro. */
export function nombreModeloNsys(modelo: string | null, modeloMaestro: string | null): string {
  if (modelo) return traducirModelo(modelo)
  if (modeloMaestro) return `iPhone ${modeloMaestro}`
  return 'Sin modelo en el maestro'
}

/** 0.9.21 (spec «Descripción completa donde pone «Modelo»» §2.1): «iPhone 13 128GB Azul», el nombre del modelo con la capacidad
 *  y el color detrás, separados por un espacio y sin los que falten. Sin nombre, nada: una lista del taller sin modelo dice lo de
 *  hoy (vacío) aunque NSYS sepa la capacidad. La usan las listas del taller y las copias de «modelo capacidad» de NSYS (ficha
 *  del IMEI, buscador, «Por pasar a NSYS» y «Pegar varios IMEIs», que pintan el color aparte). */
export function descripcionMovil(nombre: string | null | undefined, capacidad?: string | null, color?: string | null): string {
  if (!nombre) return ''
  return [nombre, capacidad, color].filter(Boolean).join(' ')
}

/** Colores de las ubicaciones del ERP (los nombres de Nsys_ubicacion); las que no están aquí, en gris. */
const CLASES_UBICACION: Record<string, string> = {
  'En revisión': 'bg-fila-solicitud-bg text-fila-solicitud-brd',
  Devolución: 'bg-fila-solicitud-bg text-notif-urgente-text',
  'Taller · Pulir': 'bg-tipo-pulido-bg text-tipo-pulido-text',
  'Taller · Glass': 'bg-tipo-glass-bg text-tipo-glass-text',
  'Taller · Reparación': 'bg-tipo-reparacion-bg text-tipo-reparacion-text',
  'Taller · Pantalla rota': 'bg-entrega-bg text-entrega-text',
  Listos: 'bg-fila-recibido-bg text-fila-recibido-brd',
}

export function clasesUbicacion(ubicacion: string | null | undefined): string {
  return (ubicacion && CLASES_UBICACION[ubicacion]) || 'bg-badge-neutro-bg text-azul-gris'
}

const TEXTO_ESTADO: Record<string, string> = {
  DE_PEDIDO: 'De pedido', NO_CUENTA: 'No cuenta como stock', VENDIDO: 'Vendido', BAJA: 'Baja en NSYS',
}

export function textoEstadoMovil(estado: string): string {
  return TEXTO_ESTADO[estado] ?? 'Libre'
}

/** «2023-05-02» (o «2023-05-02T13:01:00») → «02/05/2023». Las fechas del espejo ya son de Madrid: se cortan del texto,
 *  sin pasar por `formatear` de `fechas.ts`, que da por hecho UTC. */
export function diaNsys(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

/** «del 26/10 (R20261026_205)»: cuándo (hora de Madrid, sin zona) y en qué reparación se puso la batería recordada (0.9.22
 *  pieza 4). */
const deLaBateria = (en: string, idRep: string): string => `del ${en.slice(8, 10)}/${en.slice(5, 7)} (${idRep})`

/** «Batería nueva del 26/10 (R…)» / «Batería reutilizada del 26/10 (R…)» de la fila «Sin grado en NSYS». */
export const textoBateriaRecordada = (nueva: boolean, en: string, idRep: string): string =>
  `Batería ${nueva ? 'nueva' : 'reutilizada'} ${deLaBateria(en, idRep)}`

/** El recordatorio de «Corregir…» (0.9.22 pieza 4 §7): lo escrito manda, así que con la batería nueva que escriba él el 100. */
export const textoBateriaEnCorregir = (nueva: boolean, en: string, idRep: string): string =>
  nueva ? `Lleva batería nueva ${deLaBateria(en, idRep)}: si quieres el 100, escríbelo`
    : `Lleva batería reutilizada ${deLaBateria(en, idRep)}: sin el 100`

/** Grado de NSYS para leer: el «100» del final es la batería nueva (como `Normalizacion` del servidor), así que «A100» se
 *  lee «A · batería nueva». Sin grado, una raya. */
export function textoGrado(raw: string | null | undefined): string {
  if (!raw) return '—'
  if (raw.endsWith('100')) return `${raw.slice(0, -3) || '—'} · batería nueva`
  return raw
}

const DIA_MADRID = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
const aDiaUtc = (dia: string) => Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10)))

/** Días desde un día de NSYS («2026-10-15», hora de Madrid) hasta hoy en Madrid, sea cual sea la zona del navegador; 0 si
 *  es hoy o después (0.9.18: «Pendiente de revisar desde hace N días»). */
export function diasDesdeNsys(dia: string, ahora: Date = new Date()): number {
  return Math.max(0, Math.round((aDiaUtc(DIA_MADRID.format(ahora)) - aDiaUtc(dia)) / 86_400_000))
}

/** 0.9.21 (spec «SKU del taller» §2.1): un SKU que el maestro no da para el color y el grado que valen. */
export const SIN_SKU_MAESTRO = 'sin SKU en el maestro'
/** 0.9.21 (§2.4): el producto que poner en NSYS cuando ningún móvil del espejo tiene ese color. */
export const SIN_PRODUCTO_NSYS = '(ningún móvil de ese color en NSYS: búscalo a mano)'

/** 0.9.22 (spec §2.1, paso 4): el producto sale del nombre del maestro tal cual porque NSYS nunca ha escrito ese color. */
export const COMPRUEBALO = 'compruébalo: NSYS nunca ha escrito ese color'

/** «<producto> · grado <grado>»: lo que hay que poner en NSYS (la ficha, el diálogo «Corregir…» y «Por pasar a NSYS»). Sin
 *  producto, el aviso de buscarlo a mano; desde la 0.9.22, con « (compruébalo: …)» detrás si sale del maestro tal cual. */
export function textoPoner(producto: string | null | undefined, grado: string | null | undefined, compruebalo = false): string {
  const queProducto = producto ? `${producto}${compruebalo ? ` (${COMPRUEBALO})` : ''}` : SIN_PRODUCTO_NSYS
  return `${queProducto} · grado ${grado || '—'}`
}

/** 0.9.22 (spec §3.5): un aviso del taller (pieza 2 de la 0.9.21) como lo cuentan el rastro del IMEI y «Revisar a mano».
 *  `tipo` SIN_COLOR, SIN_GRADO o SIN_DESHACER; `causa` BORRADA o EDITADA en SIN_DESHACER; `usuario`: quién guardó la reparación;
 *  `motivo`: la pieza. */
export type AvisoTallerTexto = {
  tipo: string; causa: string | null; dato: string | null; de: string | null; idRep: string | null; usuario: string | null; motivo: string | null
}

const DATO_AVISO: Record<string, string> = { COLOR: 'color', GRADO: 'grado' }
/** «del chasis chai13xxx» o «de la tapa tapai13xxx», por el prefijo del SKU. */
const delaPieza = (sku: string | null) => ((sku ?? '').toLowerCase().startsWith('tapa') ? `de la tapa ${sku}` : `del chasis ${sku ?? '—'}`)

/** El texto del aviso, el mismo del rastro desde la 0.9.21. */
export function textoAvisoTaller(a: AvisoTallerTexto): string {
  const quien = a.usuario ?? '—'
  switch (a.tipo) {
    case 'SIN_COLOR':
      return `Taller: el color ${delaPieza(a.de)} no se puede deducir: lo corregirá un supertécnico (reparación ${a.idRep ?? '—'} · ${quien})`
    case 'SIN_GRADO':
      return `Taller: el grado (${a.de ?? '—'}) aún no se puede calcular: se resuelve solo cuando el móvil tenga grado (${[`reparación ${a.idRep ?? '—'}`, quien, a.motivo].filter(Boolean).join(' · ')})`
    case 'SIN_DESHACER':
      return `Se ${a.causa === 'BORRADA' ? 'borró' : 'editó'} la reparación ${a.idRep ?? '—'} que cambió el ${DATO_AVISO[a.dato ?? ''] ?? 'dato'}; corrígelo a mano si hace falta (${quien})`
    default:
      return a.tipo
  }
}

/** La etiqueta de cada aviso de «Revisar a mano». */
export const ETIQUETA_AVISO: Record<string, string> = {
  SIN_COLOR: 'Color sin deducir', SIN_GRADO: 'Grado sin calcular', SIN_DESHACER: 'No se pudo deshacer',
}

/** «Qué hacer» con cada aviso de «Revisar a mano» (spec §3.5; el de SIN_DESHACER dice su dato, Ajuste 7 del plan). */
export function queHacerAviso(tipo: string, dato: string | null): string {
  if (tipo === 'SIN_COLOR') return 'Mira de qué color quedó y corrígelo en su ficha'
  if (tipo === 'SIN_GRADO') return 'Decide el grado que le toca y corrígelo en su ficha'
  return `Mira si el móvil tiene de verdad ese ${dato === 'GRADO' ? 'grado' : 'color'}; si no, corrígelo en su ficha`
}
