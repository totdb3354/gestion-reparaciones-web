import { traducirModelo } from './modelos'

/** Piezas del espejo de NSYS (0.9.17, spec «Pieza 1 del módulo de teléfonos») que usan dos módulos: el stock de teléfonos
 *  y el detalle del IMEI del taller. */

/** Nombre de un modelo de NSYS: el código del ERP traducido o, si no está en el catálogo, el texto del maestro. */
export function nombreModeloNsys(modelo: string | null, modeloMaestro: string | null): string {
  if (modelo) return traducirModelo(modelo)
  if (modeloMaestro) return `iPhone ${modeloMaestro}`
  return 'Sin modelo en el maestro'
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

/** «<producto> · grado <grado>»: lo que hay que poner en NSYS (la ficha, el diálogo «Corregir…» y la lista «Por pasar a
 *  NSYS»). Sin producto, el aviso de buscarlo a mano. */
export function textoPoner(producto: string | null | undefined, grado: string | null | undefined): string {
  return `${producto || SIN_PRODUCTO_NSYS} · grado ${grado || '—'}`
}
