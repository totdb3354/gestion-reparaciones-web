import type {
  EstadoNsys, FilaAltaNsys, FilaDescartadaNsys, FilaColorNsys, FilaGradoNsys, FilaRevisarNsys, ImportacionNsys, ListaImportaciones, MovilBuscado, MovilComprobado, MovilStock, PorQueTaller, TarjetasPorPasar, TrabajoAbierto,
} from '@/shared/api/client'
import { preparar, type Movil } from '../stock/modelo'

/** Datos inventados del stock de teléfonos (repos públicos). */
export function movil(p: Partial<MovilStock> = {}): MovilStock {
  return {
    imeiSn: '350000000000001', lote: 'BT-9001', modelo: '13', modeloMaestro: '13', capacidad: '128GB', color: 'Azul',
    grado: 'A', bateriaNueva: false, esEsim: false, sku: 'i13128AzulA', ubicacion: 'Listos', estado: 'STOCK', dias: 6,
    trabajos: [], colorNsys: null, gradoNsys: null, skuNsys: null, ...p,
  }
}

/** 16/10/2026 13:43 en Madrid (CEST, UTC+2), en milisegundos: la «hora de la carga» de los tests de reglas. */
export const AHORA = Date.parse('2026-10-16T11:43:00Z')

/** Un móvil ya preparado para las reglas, con «Quién lo tiene» calculado a las 13:43 del 16/10. */
export function visto(p: Partial<MovilStock> = {}, ahora: number = AHORA): Movil {
  return preparar([movil(p)], ahora)[0]
}

/** Un trabajo abierto: por defecto, una reparación de «Técnico 1» asignada el 16/10 a las 09:00 (Madrid). */
export function trabajo(p: Partial<TrabajoAbierto> = {}): TrabajoAbierto {
  return { categoria: 'REPARACION', tecnico: 'Técnico 1', desde: '2026-10-16T09:00:00', entregado: null, ...p }
}

export function estadoNsys(p: Partial<EstadoNsys> = {}): EstadoNsys {
  return { ultimaExportacion: '2026-10-16T13:31:00', nivel: 'OK', ultimoFallo: null, motivoFallo: null, ...p }
}

export function movilBuscado(p: Partial<MovilBuscado> = {}): MovilBuscado {
  return {
    imeiSn: '350000000000001', modelo: '13', modeloMaestro: '13', capacidad: '128GB', color: 'Azul', estado: 'STOCK',
    ubicacion: 'Listos', fechaVenta: null, colorNsys: null, ...p,
  }
}

export function movilComprobado(p: Partial<MovilComprobado> = {}): MovilComprobado {
  return {
    imei: '350000000000001', encontrado: true, modelo: '13', modeloMaestro: '13', capacidad: '128GB', color: 'Azul',
    grado: 'A', bateriaNueva: false, ubicacion: 'Listos', estado: 'STOCK', fechaVenta: null, trabajos: [], colorNsys: null, gradoNsys: null, ...p,
  }
}

/** Lo que responde el servidor por un IMEI que no está en el espejo. */
export function noEncontrado(imei: string): MovilComprobado {
  return movilComprobado({
    imei, encontrado: false, modelo: null, modeloMaestro: null, capacidad: null, color: null, grado: null, ubicacion: null,
    estado: null,
  })
}

export function importacion(p: Partial<ImportacionNsys> = {}): ImportacionNsys {
  return {
    fichero: 'Items_2026.10.16_13.31.xlsx', fechaExportacion: '2026-10-16T13:31:00', resultado: 'OK', filas: 70000,
    cambios: 12, segundos: 17, motivo: null, ...p,
  }
}

export function listaImportaciones(p: Partial<ListaImportaciones> = {}): ListaImportaciones {
  return { importaciones: [importacion()], historico: { total: 0, hechos: 0, ultimo: null, hasta: null }, ...p }
}

/** 0.9.21: por qué un dato está por pasar a NSYS; por defecto, el grado a mano de «Técnico 1». */
export function porQue(p: Partial<PorQueTaller> = {}): PorQueTaller {
  return { dato: 'GRADO', origen: 'MANO', usuario: 'Técnico 1', motivo: 'batería nueva', idRep: null, ...p }
}

/** 0.9.22: una fila de «Cambio de color»: un iPhone 13 128GB Blue que pasa a (PRODUCT)RED por un chasis de la reparación
 *  R20261024_12 (24/10 10:12, Madrid), sin marca «Hecho». */
export function filaColor(p: Partial<FilaColorNsys> = {}): FilaColorNsys {
  return {
    imeiSn: '350000000000011', modelo: '13', modeloMaestro: '13', capacidad: '128GB', colorDe: 'Blue', colorA: '(PRODUCT)RED',
    productoNsys: 'Apple iPhone 13 128GB Blue', gradoNsys: 'B', ponerProducto: 'Apple iPhone 13 128GB (PRODUCT)RED',
    compruebalo: false, tambienGrado: false,
    porQue: [porQue({ dato: 'COLOR', origen: 'REPARACION', idRep: 'R20261024_12', usuario: 'Técnico 2', motivo: 'chasis chai13red nuevo' })],
    desde: '2026-10-24T10:12:00', hechoPor: null, hechoEn: null, hechoVolvio: null, ...p,
  }
}

/** Una fila de «Cambio de grado»: un iPhone 14 eSIM 256GB Midnight que pasa de A a A100 por una batería (24/10 12:40). */
export function filaGrado(p: Partial<FilaGradoNsys> = {}): FilaGradoNsys {
  return {
    imeiSn: '350000000000022', modelo: '14', modeloMaestro: '14', capacidad: '256GB', gradoDe: 'A', gradoA: 'A100',
    productoNsys: 'Apple iPhone 14 eSIM 256GB Midnight', conColor: false,
    porQue: [porQue({ origen: 'REPARACION', idRep: 'R20261024_31', usuario: 'Técnico 2', motivo: 'batería bati14 nueva' })],
    desde: '2026-10-24T12:40:00', hechoPor: null, hechoEn: null, hechoVolvio: null, ...p,
  }
}

/** Una fila de «No está en NSYS»: un iPhone 14 del taller con dos trabajos, el último una reparación de «Técnico 2» para AMAZON. */
export function filaAlta(p: Partial<FilaAltaNsys> = {}): FilaAltaNsys {
  return {
    imeiSn: '350000000000088', modelo: '14', ultimoTrabajo: 'R20261006_57', categoria: 'REPARACION', abierto: false,
    tecnico: 'Técnico 2', cliente: 'AMAZON', trabajos: 2, desde: '2026-10-06T09:00:00', hechoPor: null, hechoEn: null,
    hechoVolvio: null, descartadoAntesPor: null, descartadoAntesEn: null, descartadoAntesMotivo: null, ...p,
  }
}

/** Un IMEI descartado de «No está en NSYS»: una cámara sin IMEI, descartada por «Supertécnico 1» con su motivo. */
export function filaDescartada(p: Partial<FilaDescartadaNsys> = {}): FilaDescartadaNsys {
  return {
    imeiSn: 'SIN-IMEI-CAM', modelo: null, ultimoTrabajo: 'R20260803_14', categoria: 'REPARACION', descartadoPor: 'Supertécnico 1',
    descartadoEn: '2026-10-26T12:31:00', motivo: 'no es un móvil, es una cámara', ...p,
  }
}

/** Una fila de «Revisar a mano»: el color del chasis chai14yellowesim no se pudo deducir (R20261022_2, «Técnico 3»). */
export function filaRevisar(p: Partial<FilaRevisarNsys> = {}): FilaRevisarNsys {
  return {
    idAviso: 1, imeiSn: '350000000000101', modelo: '14', modeloMaestro: '14', capacidad: '512GB', tipo: 'SIN_COLOR', causa: null,
    dato: 'COLOR', de: 'chai14yellowesim', a: null, motivo: 'chasis chai14yellowesim nuevo', idRep: 'R20261022_2',
    usuario: 'Técnico 3', fecha: '2026-10-22T11:14:00', ...p,
  }
}

/** Las cuatro tarjetas, vacías salvo lo que se pase. */
export function tarjetas(p: Partial<TarjetasPorPasar> = {}): TarjetasPorPasar {
  return { color: [], grado: [], altas: [], revisar: [], descartadas: [], ...p }
}
