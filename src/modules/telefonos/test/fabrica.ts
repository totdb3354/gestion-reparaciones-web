import type {
  EstadoNsys, ImportacionNsys, ListaImportaciones, MovilBuscado, MovilComprobado, MovilStock, TrabajoAbierto,
} from '@/shared/api/client'

/** Datos inventados del stock de teléfonos (repos públicos). */
export function movil(p: Partial<MovilStock> = {}): MovilStock {
  return {
    imeiSn: '350000000000001', lote: 'BT-9001', modelo: '13', modeloMaestro: '13', capacidad: '128GB', color: 'Azul',
    grado: 'A', bateriaNueva: false, esEsim: false, sku: 'i13128AzulA', ubicacion: 'Listos', estado: 'STOCK', dias: 6,
    trabajos: [], ...p,
  }
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
    ubicacion: 'Listos', fechaVenta: null, ...p,
  }
}

export function movilComprobado(p: Partial<MovilComprobado> = {}): MovilComprobado {
  return {
    imei: '350000000000001', encontrado: true, modelo: '13', modeloMaestro: '13', capacidad: '128GB', color: 'Azul',
    grado: 'A', bateriaNueva: false, ubicacion: 'Listos', estado: 'STOCK', fechaVenta: null, trabajos: [], ...p,
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
