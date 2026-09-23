import { actualizar, buscar, conEfecto, nuevaEntrada } from './base'
import { glassAbiertaBd, verdesParaPrediccion } from './derivados'
import type { Entrada, EstadoModal } from './tipos'

export const glassDe = (s: EstadoModal, imei: string): Entrada | undefined => s.glass.find((g) => g.imei === imei)

/** Al escanear (vincularGlass del JavaFX). Con glass abierta en BD la casilla está deshabilitada y no se marca nada. */
export function vincularGlass(s: EstadoModal, e: Entrada): { s: EstadoModal; e: Entrada } {
  if (glassAbiertaBd(s.tabla, e.imei) != null) return { s, e }
  if (e.tipo === 'REPARACION') return { s, e: { ...e, llevaGlass: glassDe(s, e.imei) != null } }
  return { s: { ...s, rep: s.rep.map((r) => (r.imei === e.imei ? { ...r, llevaGlass: true } : r)) }, e }
}

/** predecirGlass: una "auto" se resetea y se recalcula con la carga de ahora; asignada a mano o con técnicos no se toca.
 *  Las verdes se calculan DESPUÉS del reseteo, así que la propia glass no se cuenta. */
export function predecir(s: EstadoModal, seq: number): EstadoModal {
  let g = buscar(s, seq)
  if (!g || g.tipo !== 'GLASS') return s
  if (g.auto) {
    s = actualizar(s, seq, (x) => ({ ...x, tecnicos: [], asignada: false, auto: false }))
    g = buscar(s, seq)!
  }
  if (g.asignada || g.tecnicos.length > 0) return s
  const token = g.tokenPrediccion + 1
  s = actualizar(s, seq, (x) => ({ ...x, calculando: true, tokenPrediccion: token }))
  return conEfecto(s, { tipo: 'prediccion', seq, token, imei: g.imei, conCliente: g.idCli != null, verdes: verdesParaPrediccion(s) })
}

/** crearGlassDe: glass pendiente del IMEI de la reparación (si no la hay), con su modelo (o el vivo) y su cliente,
 *  sin comentario ni lookup. Si la reparación ya es verde y `predecirSiVerde`, la predice en el acto. */
export function crearGlassDe(s: EstadoModal, repSeq: number, predecirSiVerde = true): EstadoModal {
  const e = buscar(s, repSeq)
  if (!e || glassDe(s, e.imei)) return s
  const seq = s.seq + 1
  const g: Entrada = { ...nuevaEntrada(seq, e.imei, 'GLASS'), modelo: e.modelo ?? s.modeloPorImei[e.imei] ?? null,
    idCli: e.idCli, sinCliente: e.sinCliente, modeloBuscado: true }
  const r = { ...s, seq, glass: [...s.glass, g] }
  return e.asignada && predecirSiVerde ? predecir(r, seq) : r
}

export function quitarGlassDe(s: EstadoModal, imei: string): EstadoModal {
  const quitadas = new Set(s.glass.filter((g) => g.imei === imei).map((g) => g.seq))
  return { ...s, glass: s.glass.filter((g) => g.imei !== imei), actual: s.actual != null && quitadas.has(s.actual) ? null : s.actual }
}

/** Casilla "Lleva glass" (solo clic del usuario, solo Reparación). */
export function marcarLlevaGlass(s: EstadoModal, valor: boolean): EstadoModal {
  const e = buscar(s, s.actual)
  if (!e || e.tipo !== 'REPARACION') return s
  const r = actualizar(s, e.seq, (x) => ({ ...x, llevaGlass: valor }))
  if (!valor) return quitarGlassDe(r, e.imei)
  return e.asignada ? crearGlassDe(r, e.seq) : r
}

const vigente = (s: EstadoModal, seq: number, token: number) => {
  const g = buscar(s, seq)
  return !!g && g.calculando && g.tokenPrediccion === token
}

export function prediccionResuelta(s: EstadoModal, seq: number, token: number, idTec: number | null): EstadoModal {
  if (!vigente(s, seq, token)) return s
  return actualizar(s, seq, (x) => (idTec != null && !x.asignada && x.tecnicos.length === 0
    ? { ...x, calculando: false, tecnicos: [idTec], asignada: true, auto: true }
    : { ...x, calculando: false }))
}

export function prediccionFallida(s: EstadoModal, seq: number, token: number): EstadoModal {
  if (!vigente(s, seq, token)) return s
  return { ...actualizar(s, seq, (x) => ({ ...x, calculando: false })), avisoPrediccion: true }
}
