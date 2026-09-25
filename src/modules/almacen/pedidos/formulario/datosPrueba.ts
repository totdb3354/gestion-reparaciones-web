import type { Componente, CompraComponente, CompraOtro, Proveedor, SolicitudResumen, SolicitudStock } from '@/shared/api/client'

/** Datos SINTÉTICOS de los tests de los formularios de pedido (T14-T17). Nunca datos del taller. */
const base = { fechaRegistro: '2026-09-01T10:00:00', updatedAt: '2026-09-01T10:00:00', ultimoPedido: null, enCamino: 0, stock: 0, stockMinimo: 1 }

/** Orden del servidor (ORDER BY TIPO no importa aquí): un inactivo (4) y un slave de SKU compartido (5, master 2). */
export const COMPONENTES: Componente[] = [
  { ...base, idCom: 1, tipo: 'lcd-x-negro', activo: true, idComMaster: null },
  { ...base, idCom: 2, tipo: 'bat-x', activo: true, idComMaster: null },
  { ...base, idCom: 4, tipo: 'mc-x', activo: false, idComMaster: null },
  { ...base, idCom: 5, tipo: 'bat-y', activo: true, idComMaster: 2 },
]

export const PROVEEDORES: Proveedor[] = [
  { idProv: 1, nombre: 'ACME', activo: true, divisa: 'EUR', comentario: '', tipo: 'COMPONENTES' },
  { idProv: 2, nombre: 'Proveedor B', activo: true, divisa: 'USD', comentario: '', tipo: 'COMPONENTES' },
  { idProv: 3, nombre: 'Proveedor A', activo: false, divisa: 'EUR', comentario: '', tipo: 'COMPONENTES' },
]

export function urgente(idRc: number, idCom: number): SolicitudResumen {
  return { idRc, idRep: `R${idRc}`, imei: '111111111111111', nombreTecnico: 'tecnico1', idCom, tipoComponente: null, descripcion: null, estado: 'PENDIENTE', fechaSolicitud: '2026-09-20T10:00:00' }
}

export function preventiva(idSol: number, idCom: number): SolicitudStock {
  return { idSol, idCom, tipoComponente: `com-${idCom}`, idUsu: 7, nombreUsuario: 'tecnico1', descripcion: null, estado: 'PENDIENTE', fecha: '2026-09-20T10:00:00' }
}

export const COMPRA: CompraComponente = {
  idCompra: 7, idCom: 2, tipoComponente: 'bat-x', idProv: 1, nombreProveedor: 'ACME', cantidad: 3, cantidadRecibida: null,
  esUrgente: true, fechaPedido: '2026-09-20T10:00:00', fechaLlegada: null, precioUnidadPedido: 12.5, divisa: 'EUR',
  precioEur: 12.5, estado: 'pendiente', updatedAt: '2026-09-20T10:00:00',
}

export const OTRO: CompraOtro = {
  idCompraOtro: 9, idProv: 1, nombreProveedor: 'ACME', concepto: 'Cinta de embalar', cantidad: 4, cantidadRecibida: null,
  esUrgente: true, fechaPedido: '2026-09-20T10:00:00', fechaLlegada: null, precioUnidadPedido: 2, divisa: 'EUR',
  precioEur: 2, estado: 'pendiente', updatedAt: '2026-09-20T10:00:00',
}
