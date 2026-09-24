import { tipoDe } from '@/shared/lib/tipoTrabajo'
import { buscar, colaDe } from './base'
import type { Cola, Entrada, EstadoModal, FilaTabla, Pestana, VerdeEnModal } from './tipos'

/** Técnicos con una asignación abierta de ese IMEI en esa categoría (tecnicosOcupados del JavaFX). */
export function tecnicosOcupados(tabla: FilaTabla[], imei: string, tipo: Cola): Set<number> {
  const ids = new Set<number>()
  for (const r of tabla) if (r.imei === imei && tipoDe(r.idRep) === tipo) ids.add(r.idTec)
  return ids
}

/** Técnico de la primera glass abierta del IMEI en la tabla, o null (tecnicoGlassAbierta del JavaFX). */
export function glassAbiertaBd(tabla: FilaTabla[], imei: string): string | null {
  const r = tabla.find((x) => x.imei === imei && tipoDe(x.idRep) === 'GLASS')
  return r ? r.nombreTecnico : null
}

export function verdesParaPrediccion(s: EstadoModal): VerdeEnModal[] {
  const out: VerdeEnModal[] = []
  for (const e of [...s.rep, ...s.glass])
    if (e.asignada)
      for (const idTec of e.tecnicos)
        out.push({ imei: e.imei, idTec, tipo: e.tipo, esChasis: e.esChasis, conCliente: e.idCli != null })
  return out
}

const porSeqDesc = (a: Entrada, b: Entrada) => b.seq - a.seq

export function filasCola(s: EstadoModal, cola: Cola): { rojas: Entrada[]; verdes: Entrada[] } {
  const xs = colaDe(s, cola)
  return { rojas: xs.filter((e) => !e.asignada).sort(porSeqDesc), verdes: xs.filter((e) => e.asignada).sort(porSeqDesc) }
}

export function contadorPestana(s: EstadoModal, p: Pestana): { total: number; pendientes: number } {
  if (p === 'PULIDO') return { total: s.pulido.length, pendientes: s.pulido.filter((f) => f.idTec == null).length }
  const xs = colaDe(s, p)
  return { total: xs.length, pendientes: xs.filter((e) => !e.asignada).length }
}

export function resumenBarra(s: EstadoModal): { texto: string; n: number; guardarHabilitado: boolean } {
  const todas = [...s.rep, ...s.glass]
  const verdes = todas.filter((e) => e.asignada).length
  const rojas = todas.length - verdes
  const sinModelo = todas.filter((e) => !e.asignada && !e.modelo).length
  const nPul = s.pulido.length
  const pulSinTec = s.pulido.filter((f) => f.idTec == null).length
  // Una verde sin modelo (p.ej. tras borrarlo) solo se puede guardar si le queda el modelo vivo del IMEI de
  // respaldo (construirLote lo usa); si tampoco hay modelo vivo, el servidor rechazaría el lote entero (fix A).
  const verdeSinModeloNiVivo = todas.some((e) => e.asignada && !e.modelo && !s.modeloPorImei[e.imei])
  const texto = `${verdes} configurados · ${rojas} pendientes` + (nPul > 0 ? ` · ${nPul} pulido` : '')
    + (sinModelo > 0 ? ` · ${sinModelo} sin modelo` : '')
  const n = verdes + nPul
  return { texto, n, guardarHabilitado: rojas === 0 && pulSinTec === 0 && !verdeSinModeloNiVivo && n > 0 }
}

export const entradaActual = (s: EstadoModal): Entrada | undefined => buscar(s, s.actual)

export function asignarHabilitado(s: EstadoModal): boolean {
  const e = entradaActual(s)
  if (!e || !e.modelo) return false
  const ocup = tecnicosOcupados(s.tabla, e.imei, e.tipo)
  return s.borrador.tecnicos.some((t) => !ocup.has(t))
}

export const totalEscaneados = (s: EstadoModal): number => s.rep.length + s.glass.length + s.pulido.length

export function promptModelo(e: Entrada): string {
  if (e.buscando) return 'Buscando...'
  if (e.modeloNoEncontrado) return 'No encontrado — selecciona manualmente'
  return 'Escribe modelo...'
}

export function imeiEnColaActiva(s: EstadoModal, imei: string): boolean {
  if (s.pestana === 'PULIDO') return s.pulido.some((f) => f.imei === imei)
  return colaDe(s, s.pestana).some((e) => e.imei === imei)
}
