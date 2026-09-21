import type { SolicitudResumen, SolicitudStock } from '@/shared/api/client'
import { formatear } from '@/shared/lib/fechas'

/** U = urgente (solicitud de pieza de una asignación, id = idRc); P = preventiva (solicitud de stock, id = idSol). */
export type TarjetaDatos =
  | { clase: 'U'; id: number; grupo: 'pendiente' | 'rechazada'; sol: SolicitudResumen }
  | { clase: 'P'; id: number; grupo: 'pendiente' | 'rechazada'; sol: SolicitudStock }

export type ListasSolicitudes = { pendientes: TarjetaDatos[]; rechazadas: TarjetaDatos[] }

const urgente = (grupo: 'pendiente' | 'rechazada') => (sol: SolicitudResumen): TarjetaDatos => ({ clase: 'U', id: sol.idRc, grupo, sol })
const preventiva = (grupo: 'pendiente' | 'rechazada') => (sol: SolicitudStock): TarjetaDatos => ({ clase: 'P', id: sol.idSol, grupo, sol })

/** En cada lista, primero todas las urgentes (orden del servidor) y después todas las preventivas; no se intercalan por fecha. */
export function componerListas(d: { urgPend: SolicitudResumen[]; prevPend: SolicitudStock[]; urgRech: SolicitudResumen[]; prevRech: SolicitudStock[] }): ListasSolicitudes {
  return {
    pendientes: [...d.urgPend.map(urgente('pendiente')), ...d.prevPend.map(preventiva('pendiente'))],
    rechazadas: [...d.urgRech.map(urgente('rechazada')), ...d.prevRech.map(preventiva('rechazada'))],
  }
}

const idsDe = (tarjetas: TarjetaDatos[]) => tarjetas.map((t) => `${t.clase}${t.id}`).sort().join(',')

/** Conjunto de identificadores con su grupo y clase: si no cambia, el panel conserva las tarjetas que ya pinta (así un
 *  sondeo no parpadea ni pierde el desplazamiento). Descripción, técnico y fecha no entran. */
export function firma(l: ListasSolicitudes): string {
  return `pendiente:${idsDe(l.pendientes)}|rechazada:${idsDe(l.rechazadas)}`
}

const SEPARADOR = '  ·  '
const FMT = 'dd/MM/yyyy HH:mm'

/** Línea de información de la tarjeta (calcos de la referencia): la urgente muestra `fechaSolicitud` (que el servidor rellena
 *  con la fecha de la asignación) y pierde la fecha al rechazarse; la preventiva la conserva y nunca lleva id de asignación. */
export function lineaInfo(t: TarjetaDatos): string {
  const partes =
    t.clase === 'U'
      ? t.grupo === 'pendiente'
        ? [t.sol.nombreTecnico, formatear(t.sol.fechaSolicitud, FMT), t.sol.idRep]
        : [t.sol.nombreTecnico, t.sol.idRep]
      : [t.sol.nombreUsuario, formatear(t.sol.fecha, FMT)]
  return partes.filter((p) => p !== '').join(SEPARADOR)
}
