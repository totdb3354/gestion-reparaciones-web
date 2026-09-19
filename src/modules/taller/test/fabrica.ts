import type {
  AsignacionActiva, Componente, ComponentesAgrupados, DetalleEdicion, Reparacion, ReparacionResumen, SolicitudAsignacion, SolicitudResumen,
  SolicitudStock, Tecnico,
} from '@/shared/api/client'

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

// ── Formulario de reparación y campana (sub-proyecto 2) ──────────────────────────────────────────────────────────────

export function componente(parcial: Partial<Componente> = {}): Componente {
  return {
    idCom: 101, tipo: 'bati13', fechaRegistro: '2026-09-01T08:00:00', stock: 5, stockMinimo: 2, activo: true,
    updatedAt: '2026-09-01T08:00:00', enCamino: 0, ultimoPedido: null, idComMaster: null,
    ...parcial,
  }
}

const sku = (idCom: number, tipo: string, stock: number, stockMinimo: number, activo = true) => componente({ idCom, tipo, stock, stockMinimo, activo })

/** Catálogo sintético canónico, en el orden de claves del servidor (bat, cha, g, mc, lcd, cam, otro). No hay `cam`, `cha` ni
 *  `mc` para el modelo 14: sirve para "tipo sin SKU para el modelo". `bati12` está inactivo. Cada llamada crea objetos nuevos. */
export function agrupados(): ComponentesAgrupados {
  return {
    bat: [sku(101, 'bati13', 5, 2), sku(102, 'bati14', 0, 2), sku(103, 'bati13promax', 1, 2), sku(104, 'bati12', 3, 1, false)],
    cha: [sku(131, 'chai13negro', 2, 1)],
    g: [sku(141, 'gi13', 6, 2), sku(142, 'gi14', 0, 2)],
    mc: [sku(151, 'mci13', 2, 1)],
    lcd: [sku(111, 'lcdi13', 1, 1), sku(112, 'lcdi14', 3, 1)],
    cam: [sku(121, 'cami13', 4, 1)],
    otro: [sku(161, 'otroi13', 0, 0), sku(162, 'otroi14', 0, 0)],
  }
}

/** Una solicitud de pieza tal como llega de GET …/asignaciones/{idAsignacion}/solicitudes (por defecto, pendiente de `bati14`). */
export function solicitudAsignacion(parcial: Partial<SolicitudAsignacion> = {}): SolicitudAsignacion {
  return {
    idCom: 102, cantidad: 1, reutilizado: false, observacion: null, prefijo: null, esSolicitud: true, descripcionSolicitud: null,
    estadoSolicitud: 'PENDIENTE', enCamino: false,
    ...parcial,
  }
}

export function detalleEdicion(parcial: Partial<DetalleEdicion> = {}): DetalleEdicion {
  return { imei: '355400000000111', idTec: 4, idCom: 101, esReutilizado: false, observacion: null, cantidad: 1, updatedAt: '2026-09-16T07:02:00', ...parcial }
}

export function asignacionActiva(parcial: Partial<AsignacionActiva> = {}): AsignacionActiva {
  return { idRep: 'AG20260916_2', nombreTecnico: 'Técnico H', idTec: 6, ...parcial }
}

export function solicitudUrgente(parcial: Partial<SolicitudResumen> = {}): SolicitudResumen {
  return {
    idRc: 501, idRep: 'A20260916_1', imei: '355400000000111', nombreTecnico: 'Técnico A', idCom: 102, tipoComponente: 'bati14',
    descripcion: null, estado: 'PENDIENTE', fechaSolicitud: '2026-09-16T07:02:00',
    ...parcial,
  }
}

export function solicitudPreventiva(parcial: Partial<SolicitudStock> = {}): SolicitudStock {
  return {
    idSol: 701, idCom: 111, tipoComponente: 'lcdi13', idUsu: 8, nombreUsuario: 'tecnico_n', descripcion: null, estado: 'PENDIENTE',
    fecha: '2026-09-16T09:30:00',
    ...parcial,
  }
}

export function reparacion(parcial: Partial<Reparacion> = {}): Reparacion {
  return {
    idRep: 'R20260916_5', fechaAsig: '2026-09-16T07:02:00', fechaFin: '2026-09-16T09:15:00', imei: '355400000000111', idTec: 4,
    updatedAt: '2026-09-16T09:15:00',
    ...parcial,
  }
}

/** Borrador tal cual lo escribe el cliente de escritorio (Gson: primitivos siempre, cadenas nulas omitidas, claves en el orden de
 *  declaración): modelo 13, batería guardada, pantalla normal con cantidad 1 y observación, cámara con agotado confirmado en el
 *  límite (cantidad = stock de `cami13`) y descripción, una acción guardada y otra pendiente. Es una cadena: la fábrica no
 *  importa nada de formulario/. */
export const BORRADOR_JAVAFX: string = JSON.stringify({
  modelo: '13',
  filas: [
    {
      prefijo: 'bat', idCom: 101, cantidad: 1, reutilizado: false, solicitudNueva: false, agotadoConfirmado: false, guardada: true,
      idRepGenerado: 'R20260916_5', fechaGuardado: '16/09 09:15',
    },
    {
      prefijo: 'lcd', idCom: 111, cantidad: 1, reutilizado: false, observacion: 'Pantalla con líneas verticales', solicitudNueva: false,
      agotadoConfirmado: false, guardada: false,
    },
    {
      prefijo: 'cam', idCom: 121, cantidad: 4, reutilizado: false, solicitudNueva: false, agotadoConfirmado: true,
      descripcionAgotado: 'Cámara trasera completa', guardada: false,
    },
  ],
  otros: [
    { descripcion: 'Limpieza del conector de carga', guardada: true, idRepGenerado: 'R20260916_6', fechaGuardado: '16/09 09:20' },
    { descripcion: 'Ajuste de tornillería', guardada: false },
  ],
})
