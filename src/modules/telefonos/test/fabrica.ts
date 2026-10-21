import type {
  EstadoNsys, FilaPorPasar, ImportacionNsys, ListaImportaciones, MovilBuscado, MovilComprobado, MovilStock, PorQueTaller, TrabajoAbierto,
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

/** Una fila de «Por pasar a NSYS»: un iPhone 13 128GB Azul que pasa de B a A100 desde el 20/10 a las 10:31 (Madrid). */
export function filaPorPasar(p: Partial<FilaPorPasar> = {}): FilaPorPasar {
  return {
    imeiSn: '350000000000001', modelo: '13', modeloMaestro: '13', capacidad: '128GB', productoNsys: 'Apple iPhone 13 128GB Blue',
    gradoNsys: 'B', ponerProducto: 'Apple iPhone 13 128GB Blue', ponerGrado: 'A100', sku: 'i13128AzulA100', porQue: [porQue()],
    desde: '2026-10-20T10:31:00', ...p,
  }
}
