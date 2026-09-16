import type { ReparacionResumen } from '@/shared/api/client'
import { fechaLocal, formatear } from '@/shared/lib/fechas'
import { tipoDe } from '@/shared/lib/tipoTrabajo'

/** Calco de EntregaGlass (spec entrega-glass 2026-08-28): textos de badge, tooltip, menú, píldoras y CSV de la entrega
 *  del teléfono al técnico de glass. Fila A… (arriba): usa los derivados glass*; fila AG… (glass): entregadoAt/Por. */

type Rep = ReparacionResumen | null | undefined

const nombre = (n: string | null | undefined) => (n && n.trim() !== '' ? n : 'glass')
const nombreRep = (n: string | null | undefined) => (n && n.trim() !== '' ? n : 'técnico')

/** Badge: fila A → "→ <técnico de glass>" (sin hora: no cabía en 100 px); fila AG → "Llegó HH:mm" hoy o "Llegó dd/MM" otro día. */
export function textoBadgeEntrega(rep: Rep, hoy: string | null): string | null {
  if (!rep) return null
  switch (tipoDe(rep.idRep)) {
    case 'GLASS': {
      if (!rep.entregadoAt) return null
      const esHoy = hoy !== null && hoy === fechaLocal(rep.entregadoAt)
      return `Llegó ${formatear(rep.entregadoAt, esHoy ? 'HH:mm' : 'dd/MM')}`
    }
    case 'REPARACION':
      return rep.glassEntregadoAt ? `→ ${nombre(rep.glassTecnicoNombre)}` : null
    default:
      return null
  }
}

export function tooltipEntrega(rep: Rep): string | null {
  if (!rep) return null
  switch (tipoDe(rep.idRep)) {
    case 'GLASS':
      return rep.entregadoAt ? `Bajado por ${nombre(rep.entregadoPorNombre)}, ${formatear(rep.entregadoAt, 'dd/MM HH:mm')}` : null
    case 'REPARACION':
      return rep.glassEntregadoAt
        ? `Entregado a ${nombre(rep.glassTecnicoNombre)} por ${nombre(rep.glassEntregadoPorNombre)}, ${formatear(rep.glassEntregadoAt, 'dd/MM HH:mm')}`
        : null
    default:
      return null
  }
}

/** Pestaña Reparaciones, fila A con glass abierta: "Entregar a X" o "Deshacer entrega" (solo el firmante). */
export function opcionMenuEntrega(rep: Rep, pestanaGlass: boolean, idTecSesion: number | null): string | null {
  if (!rep || pestanaGlass || tipoDe(rep.idRep) !== 'REPARACION' || !rep.glassAbierta) return null
  if (!rep.glassEntregadoAt) return `Entregar a ${nombre(rep.glassTecnicoNombre)}`
  return idTecSesion !== null && idTecSesion === rep.glassEntregadoPor ? 'Deshacer entrega' : null
}

/** Pestaña Glass, fila AG con entrega firmada por el propio técnico. */
export function opcionDeshacerLlegada(rep: Rep, pestanaGlass: boolean, idTecSesion: number | null): string | null {
  if (!rep || !pestanaGlass || tipoDe(rep.idRep) !== 'GLASS' || !rep.entregadoAt) return null
  return idTecSesion !== null && idTecSesion === rep.entregadoPor ? 'Deshacer llegada' : null
}

/** Sin teléfono no hay glass: se oculta "Añadir glass" con reparación normal abierta y sin entrega. */
export function ocultarAnadirGlass(rep: Rep): boolean {
  if (!rep || tipoDe(rep.idRep) !== 'GLASS') return false
  return rep.normalAbierta && !rep.entregadoAt
}

export function mostrarMarcarLlegada(rep: Rep, pestanaGlass: boolean): boolean {
  return pestanaGlass && ocultarAnadirGlass(rep)
}

/** Columna "Entregado" del CSV (A: derivada; AG: real; pulido: vacío). */
export function textoCsvEntrega(rep: Rep): string {
  if (!rep) return ''
  const tipo = tipoDe(rep.idRep)
  if (tipo === 'PULIDO') return ''
  return formatear(tipo === 'GLASS' ? rep.entregadoAt : rep.glassEntregadoAt, 'dd/MM/yyyy HH:mm')
}

/** Bajo el reparador en Historial/IMEIs: solo glass con entrega, siempre con día y hora. */
export function subEtiquetaHistorial(rep: Rep): string | null {
  if (!rep || !rep.entregadoAt || tipoDe(rep.idRep) !== 'GLASS') return null
  return `Llegó ${formatear(rep.entregadoAt, 'dd/MM HH:mm')}`
}

/** Píldora bajo el IMEI de la reparación mientras su glass no tenga entrega. */
export function etiquetaGlassPendiente(rep: Rep): string | null {
  if (!rep || tipoDe(rep.idRep) !== 'REPARACION' || !rep.glassAbierta || rep.glassEntregadoAt) return null
  return `Glass: ${nombre(rep.glassTecnicoNombre)}`
}

export function tooltipGlassPendiente(rep: Rep): string | null {
  return etiquetaGlassPendiente(rep) === null ? null : `Glass abierta de ${nombre(rep!.glassTecnicoNombre)} — entrega sin registrar`
}

/** Píldora bajo el IMEI de la glass mientras la reparación normal siga abierta (se mantiene tras "Llegó"). */
export function etiquetaRepAbierta(rep: Rep): string | null {
  if (!rep || tipoDe(rep.idRep) !== 'GLASS' || !rep.normalAbierta) return null
  return `Rep: ${nombreRep(rep.normalTecnicoNombre)}`
}

export function tooltipRepAbierta(rep: Rep): string | null {
  return etiquetaRepAbierta(rep) === null ? null : `Reparación abierta de ${nombreRep(rep!.normalTecnicoNombre)}`
}
