import type { ReparacionResumen, Tecnico } from '@/shared/api/client'

/** Fila completa con valores por defecto; cada test sobrescribe lo que le importa. */
export function resumen(parcial: Partial<ReparacionResumen> = {}): ReparacionResumen {
  return {
    idRep: 'A20260916_1', imei: '355400000000111', nombreTecnico: 'Técnico A', fechaAsig: '2026-09-16T07:02:00', fechaFin: null,
    tipoComponente: null, observaciones: null, esIncidencia: false, esResuelto: false, esReutilizado: false, incidencia: null,
    idRepAnterior: null, idTec: 4, esSolicitud: 0, descripcionSolicitud: null, estadoSolicitud: null, tipoSolicitud: null,
    stockSolicitud: 0, enCamino: false, tiposSolicitud: null, updatedAt: '2026-09-16T07:02:00', modelo: '14',
    comentarioAsignacion: null, observacionTelefono: null, urgente: false, esChasis: false, porCerrar: false,
    tieneAsignaciones: false, nombreTecnicoAsigna: 'Técnico F', telefonoUpdatedAt: '2026-09-16T07:02:00', cliente: 'AMAZON',
    entregadoAt: null, entregadoPorNombre: null, entregadoPor: null, glassAbierta: false, glassEntregadoAt: null,
    glassEntregadoPorNombre: null, glassEntregadoPor: null, glassTecnicoNombre: null, normalAbierta: false, normalTecnicoNombre: null,
    ...parcial,
  }
}

export function tecnico(parcial: Partial<Tecnico> = {}): Tecnico {
  return { idTec: 4, nombre: 'Técnico A', activo: true, esEstadistica: true, esGlass: false, ...parcial }
}

/** Fila de reparación normal (A…) con la glass del IMEI descrita por sus derivados (calco de EntregaGlassTest.normal). */
export function normal(glassAbierta: boolean, entregadoAt: string | null): ReparacionResumen {
  return resumen({
    idRep: 'A20260828_1', glassAbierta, glassEntregadoAt: entregadoAt,
    glassEntregadoPorNombre: entregadoAt ? 'Técnico J' : null, glassEntregadoPor: entregadoAt ? 7 : null,
    glassTecnicoNombre: glassAbierta ? 'Técnico H' : null,
  })
}

/** Fila de glass (AG…) con su propia entrega (calco de EntregaGlassTest.glass). */
export function glass(entregadoAt: string | null): ReparacionResumen {
  return resumen({ idRep: 'AG20260828_3', entregadoAt, entregadoPorNombre: entregadoAt ? 'Técnico J' : null, entregadoPor: entregadoAt ? 7 : null })
}
