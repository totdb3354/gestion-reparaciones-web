import type { EstadoNsys, MovilBuscado, MovilStock } from '@/shared/api/client'

/** Datos inventados del stock de teléfonos (repos públicos). */
export function movil(p: Partial<MovilStock> = {}): MovilStock {
  return {
    imeiSn: '350000000000001', lote: 'BT-9001', modelo: '13', modeloMaestro: '13', capacidad: '128GB', color: 'Azul',
    grado: 'A', bateriaNueva: false, esEsim: false, sku: 'i13128AzulA', ubicacion: 'Listos', estado: 'STOCK', dias: 6, ...p,
  }
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
