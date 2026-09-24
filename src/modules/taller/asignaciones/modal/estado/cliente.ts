import { actualizarTodas, buscar } from './base'
import type { EstadoModal, RefCliente } from './tipos'

type ConCliente = { imei: string; idCli: number | null; sinCliente: boolean }

const conRef = <T extends ConCliente>(x: T, ref: RefCliente): T => ({ ...x, idCli: ref.sin ? null : ref.idCli, sinCliente: ref.sin })

/** Hereda la última decisión MANUAL del modal para ese IMEI (sembrarClienteEntrada / sembrarClientePulido). */
export function sembrarCliente<T extends ConCliente>(s: EstadoModal, x: T): T {
  const m = s.clienteManual[x.imei]
  return m ? conRef(x, m) : x
}

/** Cliente "pegajoso" del modal (uno para todo el modal), solo si la entrada sigue sin decisión. */
export function aplicarClienteDefault<T extends ConCliente>(s: EstadoModal, x: T): T {
  if (x.idCli != null || x.sinCliente || !s.clienteDefault) return x
  return conRef(x, s.clienteDefault)
}

/** Cliente que el IMEI ya tenía en BD: manda siempre, salvo decisión manual para ese IMEI. */
export function aplicarClienteBd<T extends ConCliente>(s: EstadoModal, x: T, idCli: number | null): T {
  if (idCli == null || x.imei in s.clienteManual) return x
  return { ...x, idCli, sinCliente: false }
}

/** Copia el cliente (o "sin cliente") a todas las entradas y filas del IMEI en las tres colas. */
export function propagarCliente(s: EstadoModal, imei: string, ref: RefCliente): EstadoModal {
  const t = actualizarTodas(s, (e) => e.imei === imei, (e) => conRef(e, ref))
  return { ...t, pulido: t.pulido.map((f) => (f.imei === imei ? conRef(f, ref) : f)) }
}

/** Elegir cliente en el detalle de Reparación/Glass (confirmarCliente del JavaFX). */
export function elegirCliente(s: EstadoModal, ref: RefCliente): EstadoModal {
  const r = { ...s, clienteDefault: ref }
  const e = buscar(r, r.actual)
  if (!e) return r
  return propagarCliente({ ...r, clienteManual: { ...r.clienteManual, [e.imei]: ref } }, e.imei, ref)
}
