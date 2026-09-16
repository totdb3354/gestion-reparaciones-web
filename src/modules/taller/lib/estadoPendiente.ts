import type { ReparacionResumen } from '@/shared/api/client'
import { textoBadgeEntrega, tooltipEntrega } from './entregaGlass'

export type BadgeEstado = { texto: string; clases: string; tooltip?: string; sub?: string }

const URGENTE = 'bg-urgente-bg text-fila-urgente-brd'
const POR_CERRAR = 'bg-tipo-glass-bg text-tipo-glass-text'
const ENTREGA = 'bg-entrega-bg text-entrega-text'
const INCIDENCIA = 'bg-fila-incidencia-bg text-fila-incidencia-brd'
const RECIBIDO = 'bg-recibido-bg text-recibido-text'
const EN_CAMINO = 'bg-tipo-reparacion-bg text-tipo-reparacion-text'
const SOLICITUD = 'bg-fila-solicitud-bg text-fila-solicitud-brd'
const NORMAL = 'bg-badge-neutro-bg text-azul-gris'

/** Calco de la celda Estado de PendientesTecnicoController: badges apilados de arriba abajo. */
export function badgesEstado(rep: ReparacionResumen, hoy: string | null): BadgeEstado[] {
  const badges: BadgeEstado[] = []
  if (rep.urgente) badges.push({ texto: 'Urgente', clases: URGENTE })
  if (rep.porCerrar) badges.push({ texto: 'Por cerrar', clases: POR_CERRAR })
  const entrega = textoBadgeEntrega(rep, hoy)
  if (entrega) badges.push({ texto: entrega, clases: ENTREGA, tooltip: tooltipEntrega(rep) ?? undefined })
  if (rep.esIncidencia) {
    badges.push({ texto: 'Incidencia', clases: INCIDENCIA })
  } else if (rep.esSolicitud > 0) {
    const recibido = rep.estadoSolicitud === 'GESTIONADA' && rep.stockSolicitud > 0
    const badge: BadgeEstado = recibido
      ? { texto: 'Recibido', clases: RECIBIDO }
      : rep.enCamino
        ? { texto: 'En camino', clases: EN_CAMINO }
        : { texto: 'Solicitud', clases: SOLICITUD }
    if (rep.tiposSolicitud) {
      badge.sub = rep.esSolicitud > 1 ? `${rep.esSolicitud} piezas` : rep.tiposSolicitud
      badge.tooltip = rep.tiposSolicitud
    }
    badges.push(badge)
  } else if (!rep.urgente) {
    badges.push({ texto: 'Normal', clases: NORMAL })
  }
  return badges
}
