import { componenteDe, reducir, type ControlesFila, type EstadoFormulario, type FilaEstado, type OtraAccion } from './estado'

/** Borrador del formulario con el MISMO JSON que escribe el cliente de escritorio (BorradorContenido, campo a campo): los dos
 *  clientes leen y escriben el mismo borrador de una asignación. El servidor lo guarda opaco. */
export type BorradorFila = {
  prefijo: string
  idCom: number                        // -1 sin elegir
  cantidad: number
  reutilizado: boolean
  observacion?: string
  solicitudNueva: boolean              // siempre false: se conserva solo por compatibilidad
  descripcionSolicitud?: string
  agotadoConfirmado: boolean
  descripcionAgotado?: string
  guardada: boolean
  idRepGenerado?: string
  fechaGuardado?: string
}
export type BorradorAccion = { descripcion: string; guardada: boolean; idRepGenerado?: string; fechaGuardado?: string }
export type BorradorContenido = { modelo?: string; filas: BorradorFila[]; otros: BorradorAccion[] }

// Las claves van en el orden de declaración del cliente de escritorio: así la cadena serializada es idéntica a la suya.
// Booleanos y números siempre presentes; las cadenas sin valor quedan a undefined y JSON.stringify las descarta.
function capturarFila(fila: FilaEstado): BorradorFila | null {
  if (fila.guardada !== null) {
    return {
      prefijo: fila.prefijo, idCom: fila.idCom ?? -1, cantidad: fila.cantidad, reutilizado: fila.reutilizado, observacion: undefined,
      solicitudNueva: false, descripcionSolicitud: undefined, agotadoConfirmado: false, descripcionAgotado: undefined, guardada: true,
      idRepGenerado: fila.guardada.idRep, fechaGuardado: fila.guardada.fecha,
    }
  }
  const agotadoNuevo = fila.agotado !== null
  if (fila.cantidad === 0 && !fila.reutilizado && fila.observacion === null && !agotadoNuevo) return null
  return {
    prefijo: fila.prefijo, idCom: fila.idCom ?? -1, cantidad: fila.cantidad, reutilizado: fila.reutilizado,
    observacion: fila.observacion ?? undefined, solicitudNueva: false, descripcionSolicitud: undefined, agotadoConfirmado: agotadoNuevo,
    descripcionAgotado: fila.agotado?.descripcion ?? undefined, guardada: false, idRepGenerado: undefined, fechaGuardado: undefined,
  }
}

function capturarAccion(a: OtraAccion): BorradorAccion | null {
  const texto = a.texto.trim()
  if (texto === '' && a.guardada === null) return null
  return { descripcion: texto, guardada: a.guardada !== null, idRepGenerado: a.guardada?.idRep, fechaGuardado: a.guardada?.fecha }
}

export function capturar(e: EstadoFormulario): BorradorContenido {
  return {
    modelo: e.modelo ?? undefined,
    filas: e.filas.map(capturarFila).filter((f): f is BorradorFila => f !== null),
    otros: e.otros.map(capturarAccion).filter((a): a is BorradorAccion => a !== null),
  }
}

/** Vacío = sin filas y sin acciones; el modelo solo no cuenta (se autorrellena al abrir). */
export function borradorVacio(b: BorradorContenido): boolean {
  return b.filas.length === 0 && b.otros.length === 0
}

/** Cadena para PUT …/borrador, o null si el borrador está vacío (entonces toca DELETE). */
export function serializar(e: EstadoFormulario): string | null {
  const b = capturar(e)
  return borradorVacio(b) ? null : JSON.stringify(b)
}

const cadena = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const entero = (v: unknown, porDefecto: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : porDefecto)
const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function leerFila(v: unknown): BorradorFila | null {
  if (!esObjeto(v) || typeof v.prefijo !== 'string') return null
  return {
    prefijo: v.prefijo, idCom: entero(v.idCom, -1), cantidad: entero(v.cantidad, 0), reutilizado: v.reutilizado === true,
    observacion: cadena(v.observacion), solicitudNueva: false, descripcionSolicitud: cadena(v.descripcionSolicitud),
    agotadoConfirmado: v.agotadoConfirmado === true, descripcionAgotado: cadena(v.descripcionAgotado), guardada: v.guardada === true,
    idRepGenerado: cadena(v.idRepGenerado), fechaGuardado: cadena(v.fechaGuardado),
  }
}

function leerAccion(v: unknown): BorradorAccion | null {
  if (!esObjeto(v)) return null
  return { descripcion: cadena(v.descripcion) ?? '', guardada: v.guardada === true, idRepGenerado: cadena(v.idRepGenerado), fechaGuardado: cadena(v.fechaGuardado) }
}

/** null si json es null o vacío, no es JSON, no es un objeto con listas o el borrador está vacío: en todos esos casos el
 *  formulario abre limpio, sin error y sin banda. Tolera claves ausentes (el cliente de escritorio omite los nulos). */
export function leerBorrador(json: string | null): BorradorContenido | null {
  if (json === null || json.trim() === '') return null
  let crudo: unknown
  try {
    crudo = JSON.parse(json)
  } catch {
    return null
  }
  if (!esObjeto(crudo)) return null
  const filas = crudo.filas ?? []
  const otros = crudo.otros ?? []
  if (!Array.isArray(filas) || !Array.isArray(otros)) return null
  const b: BorradorContenido = {
    modelo: cadena(crudo.modelo),
    filas: filas.map(leerFila).filter((f): f is BorradorFila => f !== null),
    otros: otros.map(leerAccion).filter((a): a is BorradorAccion => a !== null),
  }
  return borradorVacio(b) ? null : b
}

export function tieneGuardadas(b: BorradorContenido): boolean {
  return b.filas.some((f) => f.guardada) || b.otros.some((a) => a.guardada)
}

const CONTROLES_BLOQUEADOS: ControlesFila = { mas: false, menos: false, reutilizado: false, sku: false, observacion: false }

/** Una fila del borrador sobre la fila del formulario (calco de FilaUI.aplicarBorrador). */
function aplicarFila(fila: FilaEstado, f: BorradorFila): FilaEstado {
  // Una solicitud ya guardada en el servidor manda sobre el borrador; sin SKU para el modelo no hay nada que restaurar.
  if (fila.solicitud !== null || fila.idCom === null) return fila
  // El SKU solo se preselecciona si está entre las opciones actuales; si no, queda el SKU por defecto.
  const elegido = f.idCom > 0 ? fila.opciones.find((c) => c.idCom === f.idCom) : undefined
  const base: FilaEstado = elegido ? { ...fila, idCom: elegido.idCom, controles: { ...fila.controles, mas: elegido.stock > 0 } } : fila
  if (f.guardada) {
    return {
      ...base, cantidad: f.cantidad > 0 ? f.cantidad : base.cantidad, reutilizado: f.reutilizado || base.reutilizado, controles: CONTROLES_BLOQUEADOS,
      guardada: { idRep: f.idRepGenerado ?? '?', fecha: f.fechaGuardado ?? '' }, confirmandoGuardar: false, guardando: false, agotado: null,
      recibidoPendienteUso: false,
    }
  }
  if (f.agotadoConfirmado) {
    // Variante según el stock ACTUAL: lo que se descontará nunca supera lo que hay ahora (0 si el SKU se quedó sin stock).
    const stock = componenteDe(base)?.stock ?? 0
    return {
      ...base, cantidad: Math.min(Math.max(0, f.cantidad), Math.max(0, stock)), reutilizado: false, observacion: null, controles: CONTROLES_BLOQUEADOS,
      agotado: { descripcion: f.descripcionAgotado ?? null, registrado: false }, confirmandoGuardar: false, recibidoPendienteUso: false,
    }
  }
  // Normal: "Reutilizado", cantidad (mínimo 0, SIN revalidar contra el stock) y observación. De los controles solo se
  // recalcula "-", como en la referencia.
  const cantidad = Math.max(0, f.cantidad)
  const observacion = f.observacion !== undefined && f.observacion.trim() !== '' ? f.observacion : base.observacion
  return {
    ...base, reutilizado: f.reutilizado, cantidad, observacion, controles: { ...base.controles, menos: cantidad > 0 }, confirmandoGuardar: false,
    recibidoPendienteUso: base.recibidoPendienteUso && cantidad === 0 && !f.reutilizado,
  }
}

/** Devuelve el estado con el borrador aplicado y borradorRecuperado = true; no toca revision ni volcados (aplicar un borrador
 *  recuperado no debe reprogramar el autoguardado). Orden de la referencia: modelo, filas, acciones. */
export function aplicarBorrador(e: EstadoFormulario, b: BorradorContenido): EstadoFormulario {
  let estado = e
  // El borrador solo fija el modelo si el combo no está deshabilitado y el modelo existe entre las opciones.
  if (b.modelo !== undefined && b.modelo !== estado.modelo && !estado.modeloBloqueado && estado.modelos.includes(b.modelo)) {
    estado = reducir(estado, { tipo: 'CAMBIAR_MODELO', modelo: b.modelo })
  }
  const filas = [...estado.filas]
  for (const f of b.filas) {
    const i = filas.findIndex((fila) => fila.prefijo === f.prefijo) // la PRIMERA fila de ese prefijo
    if (i >= 0) filas[i] = aplicarFila(filas[i], f)
  }
  let siguienteIdAccion = estado.siguienteIdAccion
  const recuperadas: OtraAccion[] = []
  for (const a of b.otros) {
    const descripcion = a.descripcion.trim()
    if (descripcion === '') continue
    recuperadas.push({
      id: siguienteIdAccion++, texto: descripcion, origen: 'nueva',
      guardada: a.guardada ? { idRep: a.idRepGenerado ?? '?', fecha: a.fechaGuardado ?? '' } : null, confirmando: false, guardando: false,
    })
  }
  return {
    ...estado, filas, otros: [...estado.otros, ...recuperadas], siguienteIdAccion, borradorRecuperado: true, revision: e.revision,
    volcados: e.volcados,
  }
}
