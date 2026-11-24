import type { MovilStock, TrabajoAbierto } from '@/shared/api/client'
import { CAJA_LISTOS, esCajaDeTaller } from '@/shared/lib/telefonoNsys'
import { diaDeHoyEnMadrid, minutosDesde } from './nsys'

/** «Quién lo tiene» (0.9.18, spec «Columna compacta, SKU, Quién lo tiene y Revisado» §4.7): las asignaciones abiertas del
 *  ERP cruzadas con la caja de NSYS. Los trabajos son del momento; la caja, de la última exportación (hasta ~35 min de
 *  retraso), por eso el descuadre espera 60 minutos. Las horas son de Madrid, sin zona: se cortan del texto.
 *  0.9.18.1 (spec «El descuadre no cuenta los móviles de pedido»): un móvil de pedido tiene dueño, pero se repara ahí hasta
 *  que NSYS lo pone Released, así que solo da descuadre un móvil en stock en «Listos». */

export const MINUTOS_DESCUADRE = 60
export const SIN_ASIGNAR = 'Sin asignar (en caja de taller)'
export const CON_DESCUADRE = 'Con descuadre'

/** Un trozo de la celda: «glass» + **técnico** + «(pulido)» + la entrega de la glass. */
export type ParteQuien = { prefijo: string | null; tecnico: string; sufijo: string | null; entrega: { texto: string; llego: boolean } | null }
export type Quien = {
  partes: ParteQuien[]
  enCaja: boolean
  descuadre: boolean
  /** Lo que el móvil aporta al filtro «Técnico»: sus técnicos y, si toca, «Sin asignar» y «Con descuadre». */
  etiquetas: string[]
  /** Lo que se lee en la celda; también va en el diálogo de varios IMEIs y al copiar para Excel. */
  texto: string
  /** El detalle al pasar el ratón. */
  titulo: string
}

type Datos = Pick<MovilStock, 'ubicacion' | 'estado' | 'trabajos'>

const ORDEN_CATEGORIA: Record<string, number> = { REPARACION: 0, GLASS: 1, PULIDO: 2 }
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const hora = (iso: string) => iso.slice(11, 16)

function entrega(t: TrabajoAbierto, hoy: string): { texto: string; llego: boolean } {
  if (!t.entregado) return { texto: 'sin entregar', llego: false }
  return { texto: `llegó ${t.entregado.slice(0, 10) === hoy ? hora(t.entregado) : diaMes(t.entregado)}`, llego: true }
}

function detalle(t: TrabajoAbierto, hoy: string): string {
  const desde = `desde el ${diaMes(t.desde)}`
  if (t.categoria === 'GLASS') {
    const llegada = !t.entregado ? 'el móvil aún no le ha llegado'
      : t.entregado.slice(0, 10) === hoy ? `el móvil le llegó a las ${hora(t.entregado)}`
        : `el móvil le llegó el ${diaMes(t.entregado)} a las ${hora(t.entregado)}`
    return `Glass de ${t.tecnico} ${desde}: ${llegada}`
  }
  return `${t.categoria === 'PULIDO' ? 'Pulido' : 'Reparación'} de ${t.tecnico} ${desde}`
}

/** Las partes de los trabajos, ordenados (reparación, glass, pulido). Sin `hoy`, sin la entrega de la glass. */
function partesDe(trabajos: TrabajoAbierto[], hoy: string | null): ParteQuien[] {
  const hayReparacion = trabajos.some((t) => t.categoria === 'REPARACION')
  return trabajos.map((t): ParteQuien => {
    if (t.categoria === 'GLASS') {
      return { prefijo: hayReparacion ? 'glass' : null, tecnico: t.tecnico, sufijo: hayReparacion ? null : '(glass)', entrega: hoy === null ? null : entrega(t, hoy) }
    }
    return { prefijo: null, tecnico: t.tecnico, sufijo: t.categoria === 'PULIDO' ? '(pulido)' : null, entrega: null }
  })
}

const ordenados = (trabajos: TrabajoAbierto[]) =>
  [...trabajos].sort((a, b) => (ORDEN_CATEGORIA[a.categoria] ?? 9) - (ORDEN_CATEGORIA[b.categoria] ?? 9))

/** Quién lo está reparando, como «Quién lo tiene» sin la entrega: lo usa la celda del IMEI de Pedidos («reparándose · …»). */
export function textoReparandose(trabajos: TrabajoAbierto[]): string {
  return partesDe(ordenados(trabajos), null).map((p) => [p.prefijo, p.tecnico, p.sufijo].filter(Boolean).join(' ')).join(' · ')
}

/** «Quién lo tiene» de un móvil. `ahora`: milisegundos de la hora de la carga del stock, para el límite del descuadre. */
export function quienLoTiene(m: Datos, ahora: number): Quien {
  const fecha = new Date(ahora)
  const hoy = diaDeHoyEnMadrid(fecha)
  // `?? []`: una respuesta sin trabajos (servidor 0.9.17 en una vuelta atrás a medias) no rompe la pantalla.
  const trabajos = ordenados(m.trabajos ?? [])
  const partes = partesDe(trabajos, hoy)
  const tecnicos = [...new Set(trabajos.map((t) => t.tecnico))]
  // Un móvil de pedido no da «en caja»: al pasar a «Pedidos realizados» su última caja se congela, y ya reparado, esperando
  // el Released, seguiría pareciendo en el taller.
  const enCaja = m.estado !== 'DE_PEDIDO' && esCajaDeTaller(m.ubicacion) && trabajos.length === 0
  // Solo un móvil en stock: la ubicación de uno de pedido es su última caja, y puede ser «Listos».
  const enListos = m.estado !== 'DE_PEDIDO' && m.ubicacion === CAJA_LISTOS
  // El texto del descuadre nombra solo a quien lleva el trabajo más de 60 minutos; las etiquetas, a todos.
  const tarde = enListos ? [...new Set(trabajos.filter((t) => minutosDesde(t.desde, fecha) > MINUTOS_DESCUADRE).map((t) => t.tecnico))] : []
  const descuadre = tarde.length > 0
  const texto = descuadre ? `⚠ ${tarde.join(' · ')}: trabajo abierto`
    : enCaja ? '⚠ En caja, sin asignar'
      : partes.length === 0 ? '—'
        : partes.map((p) => [p.prefijo, p.tecnico, p.sufijo, p.entrega?.texto].filter(Boolean).join(' ')).join(' · ')
  const titulo = [
    ...trabajos.map((t) => detalle(t, hoy)),
    ...(descuadre ? ['NSYS dice "Caja · Listos", pero hay un trabajo abierto. ¿Falta cerrarlo o mover la caja?'] : []),
    ...(enCaja ? ['Está en una caja de taller y nadie lo tiene asignado'] : []),
  ].join(' · ')
  const etiquetas = [...tecnicos, ...(enCaja ? [SIN_ASIGNAR] : []), ...(descuadre ? [CON_DESCUADRE] : [])]
  return { partes, enCaja, descuadre, etiquetas, texto, titulo }
}
