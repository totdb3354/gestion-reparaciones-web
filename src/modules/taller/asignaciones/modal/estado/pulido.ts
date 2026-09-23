import { parsearPegadoImeis } from '@/shared/lib/pegadoImei'
import { conEfecto } from './base'
import { aplicarClienteBd, aplicarClienteDefault, propagarCliente, sembrarCliente } from './cliente'
import type { EstadoModal, FilaPulido, RefCliente } from './tipos'

/** Panel de Pulido (construirPulidoPane del JavaFX): sin modelo, sin chasis, sin "Lleva glass" y sin bloqueo del
 *  duplicado al seleccionar (D4). */
export const pulidoTecArriba = (s: EstadoModal, idTec: number | null): EstadoModal => ({ ...s, tecPulidoArriba: idTec })

function agregar(s: EstadoModal, imei: string): EstadoModal {
  const seq = s.seq + 1
  const f = aplicarClienteDefault(s, sembrarCliente(s, { seq, imei, idTec: s.tecPulidoArriba, comentario: '', idCli: null, sinCliente: false } as FilaPulido))
  return conEfecto({ ...s, seq, pulido: [...s.pulido, f], pulidoSel: seq }, { tipo: 'clientePulido', seq, imei })
}

export function pulidoEscanear(s: EstadoModal, imei: string): EstadoModal {
  if (s.pulido.some((f) => f.imei === imei)) return { ...s, mensajePulido: { texto: 'Ese IMEI ya está en la lista de pulido.', tono: 'error' } }
  return agregar({ ...s, mensajePulido: null }, imei)
}

export function pulidoPegar(s: EstadoModal, texto: string): EstadoModal {
  const p = parsearPegadoImeis(texto)
  if (p.tipo === 'CORRUPTO') return { ...s, mensajePulido: { texto: 'Algún IMEI del pegado está corrupto.', tono: 'error' } }
  let r = s
  let add = 0
  let dup = 0
  for (const imei of p.imeis) {
    if (r.pulido.some((f) => f.imei === imei)) { dup++; continue }
    r = agregar(r, imei)
    add++
  }
  return { ...r, mensajePulido: { texto: `${add} IMEIs añadidos` + (dup > 0 ? ` · ${dup} ya estaban.` : '.'), tono: 'ok' } }
}

const actualizarFila = (s: EstadoModal, seq: number | null, fn: (f: FilaPulido) => FilaPulido): EstadoModal =>
  seq == null ? s : { ...s, pulido: s.pulido.map((f) => (f.seq === seq ? fn(f) : f)) }

export function pulidoSeleccionar(s: EstadoModal, seq: number | null): EstadoModal {
  const f = s.pulido.find((x) => x.seq === seq)
  if (!f) return { ...s, pulidoSel: null }
  const r = f.idCli == null && !f.sinCliente && !(f.imei in s.clienteManual) ? actualizarFila(s, seq, (x) => aplicarClienteDefault(s, x)) : s
  return { ...r, pulidoSel: seq }
}

export const pulidoTecnico = (s: EstadoModal, idTec: number | null): EstadoModal => actualizarFila(s, s.pulidoSel, (f) => ({ ...f, idTec }))
export const pulidoComentario = (s: EstadoModal, texto: string): EstadoModal => actualizarFila(s, s.pulidoSel, (f) => ({ ...f, comentario: texto }))

export function pulidoCliente(s: EstadoModal, ref: RefCliente): EstadoModal {
  const f = s.pulido.find((x) => x.seq === s.pulidoSel)
  if (!f) return s
  return propagarCliente({ ...s, clienteManual: { ...s.clienteManual, [f.imei]: ref }, clienteDefault: ref }, f.imei, ref)
}

export function pulidoQuitar(s: EstadoModal, seq: number): EstadoModal {
  return { ...s, pulido: s.pulido.filter((f) => f.seq !== seq), pulidoSel: s.pulidoSel === seq ? null : s.pulidoSel }
}

export const pulidoClienteBd = (s: EstadoModal, seq: number, idCli: number | null): EstadoModal =>
  actualizarFila(s, seq, (f) => aplicarClienteBd(s, f, idCli))
