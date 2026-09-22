import type { DesgloseCarga, FilaCarga } from '@/shared/api/client'

/**
 * Lo puro de la ventana "Carga de técnicos" (spec 3a §11): nivel, orden, formato y texto del tooltip. El CÁLCULO
 * de la carga no vive aquí: lo hace el servidor y llega ya masticado (D3). Esto solo decide cómo se pinta.
 */

/** Los dos alcances que vienen en la misma respuesta: "Pedidos" solo cuenta el trabajo de cliente; "Total", todo. */
export type Alcance = 'pedidos' | 'total'

export type NivelCarga = 'alta' | 'media' | 'baja'

/** Lo comprometido del día: lo ya hecho más lo que queda. Puede pasar de 100 (día sobrecargado): la barra se
 *  satura, la cifra no, que es justo el aviso que el supertécnico necesita ver. */
export function pctTotal(f: FilaCarga): number {
  return f.pctHecho + f.pctPendiente
}

/** Calco de colorNivelVivo: 90 y 70 son los dos cortes. */
export function nivelCarga(pct: number): NivelCarga {
  if (pct >= 90) return 'alta'
  if (pct >= 70) return 'media'
  return 'baja'
}

/** Tono vivo del nivel, para la barra de total. */
export const CLASE_BARRA_NIVEL: Record<NivelCarga, string> = {
  alta: 'bg-carga-alta',
  media: 'bg-carga-media',
  baja: 'bg-carga-baja',
}

/** Tono oscuro del nivel, reservado al texto de la cifra. */
export const CLASE_TEXTO_NIVEL: Record<NivelCarga, string> = {
  alta: 'text-carga-alta-texto',
  media: 'text-carga-media-texto',
  baja: 'text-carga-baja-texto',
}

/** Calco de CargaTecnicos.formatearPct: el porcentaje se muestra redondeado a entero. */
export function formatearPct(pct: number): string {
  return `${Math.round(pct)}%`
}

/** Ancho de barra en porcentaje del carril, saturado al 100 %. Sin jornada no se pinta nada: el fin de semana
 *  no se mide carga, así que una barra a medias sería una cifra inventada. */
export function anchoBarra(pct: number, sinJornada: boolean): number {
  if (sinJornada) return 0
  return Math.max(0, Math.min(pct, 100))
}

/**
 * De mayor a menor carga del día. El criterio es `pctTotal` (lo comprometido), no lo pendiente: la ventana
 * responde a "¿a quién le cabe más trabajo hoy?", y a quien ya ha hecho su día no le cabe.
 *
 * El desempate por nombre no es cosmético: el fin de semana TODOS los técnicos están a 0 y empatan, y sin un
 * segundo criterio la lista se reordenaría sola en cada refresco según el orden que trajera el servidor.
 * `idTec` cierra el caso de dos técnicos con el mismo nombre. Devuelve una lista nueva: la de la caché de
 * TanStack no se toca.
 */
export function ordenarPorCarga(filas: FilaCarga[]): FilaCarga[] {
  return [...filas].sort(
    (a, b) => pctTotal(b) - pctTotal(a) || a.nombre.localeCompare(b.nombre, 'es') || a.idTec - b.idTec,
  )
}

/** Orden y etiquetas del desglose, calco de textoTramoDesglose (el plural es fijo, como en el JavaFX). */
const ETIQUETAS: [keyof DesgloseCarga, string][] = [
  ['normales', 'normales'],
  ['chasis', 'chasis'],
  ['porCerrar', 'por cerrar'],
  ['glass', 'glass'],
  ['enEsperaPieza', 'en espera de pieza'],
]

/** "3 normales · 1 chasis · 2 en espera de pieza"; los ceros no se nombran, y un tramo vacío es "". */
export function textoTramo(d: DesgloseCarga): string {
  return ETIQUETAS.filter(([clave]) => d[clave] > 0)
    .map(([clave, etiqueta]) => `${d[clave]} ${etiqueta}`)
    .join(' · ')
}

/** Tooltip de la fila: los dos tramos unidos con raya, omitiendo el que esté vacío. Sin ninguno de los dos, el
 *  texto depende del alcance, porque "sin carga" a secas sería mentira estando en Pedidos (puede tener trabajo
 *  que no es de cliente). */
export function textoDesglose(f: FilaCarga, alcance: Alcance): string {
  const pendiente = textoTramo(f.pendiente)
  const hecho = textoTramo(f.hecho)
  const tramos: string[] = []
  if (pendiente !== '') tramos.push(`Pendiente: ${pendiente}`)
  if (hecho !== '') tramos.push(`Hecho hoy: ${hecho}`)
  if (tramos.length === 0) return alcance === 'pedidos' ? 'sin carga de cliente' : 'sin carga'
  return tramos.join(' — ')
}
