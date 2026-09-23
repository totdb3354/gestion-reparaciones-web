import { parsearPegadoImeis } from '@/shared/lib/pegadoImei'
import { TIPO_TRABAJO } from '@/shared/lib/tipoTrabajo'
import { actualizar, buscar, colaDe, conEfecto, nuevaEntrada, setCola } from './base'
import { aplicarClienteBd, aplicarClienteDefault, propagarCliente, sembrarCliente } from './cliente'
import { glassAbiertaBd, tecnicosOcupados } from './derivados'
import { crearGlassDe, glassDe, predecir, quitarGlassDe, vincularGlass } from './glass'
import type { Cola, Entrada, EstadoModal, Pestana, RefCliente } from './tipos'

export const cambiarPestana = (s: EstadoModal, pestana: Pestana): EstadoModal => ({ ...s, pestana, actual: null })

/** Alta de una entrada en `cola`: decisión manual de cliente → pegajoso → modelo vivo → vínculo con la glass. */
function alta(s: EstadoModal, imei: string, cola: Cola): { s: EstadoModal; e: Entrada } {
  const seq = s.seq + 1
  let e = aplicarClienteDefault(s, sembrarCliente(s, nuevaEntrada(seq, imei, cola)))
  const vivo = s.modeloPorImei[imei]
  if (vivo) e = { ...e, modelo: vivo }
  const v = vincularGlass({ ...s, seq }, e)
  return { s: setCola(v.s, cola, [...colaDe(v.s, cola), v.e]), e: v.e }
}

export function escanear(s: EstadoModal, imei: string): EstadoModal {
  if (s.pestana === 'PULIDO') return s
  const cola = s.pestana
  if (colaDe(s, cola).some((e) => e.imei === imei))
    return { ...s, mensajeScan: { texto: `Ese IMEI ya está en la cola (${TIPO_TRABAJO[cola].etiqueta}).`, tono: 'error' } }
  const r = alta({ ...s, mensajeScan: null }, imei, cola)
  return cargar(r.s, r.e.seq)
}

/** Pegado de varios IMEIs: añade sin cargar el detalle (calco, D6). */
export function pegar(s: EstadoModal, texto: string): EstadoModal {
  if (s.pestana === 'PULIDO') return s
  const cola = s.pestana
  const p = parsearPegadoImeis(texto)
  if (p.tipo === 'CORRUPTO')
    return { ...s, mensajeScan: { texto: 'Algún IMEI del pegado está corrupto. Revisa que todos los IMEIs son válidos.', tono: 'error' } }
  let r = s
  let anadidos = 0
  let duplicados = 0
  for (const imei of p.imeis) {
    if (colaDe(r, cola).some((e) => e.imei === imei)) { duplicados++; continue }
    r = alta(r, imei, cola).s
    anadidos++
  }
  const texto2 = `${anadidos} IMEIs añadidos` + (duplicados > 0 ? ` · ${duplicados} ya estaban en la lista.` : '.')
  return { ...r, mensajeScan: { texto: texto2, tono: 'ok' } }
}

/** Una vez por entrada: modelo (si le falta) y cliente del IMEI en BD. */
function lanzarLookup(s: EstadoModal, seq: number): EstadoModal {
  const e = buscar(s, seq)
  if (!e || e.modeloBuscado) return s
  const buscarModelo = !e.modelo
  const r = actualizar(s, seq, (x) => ({ ...x, modeloBuscado: true, buscando: buscarModelo }))
  return conEfecto(r, { tipo: 'lookup', seq, imei: e.imei, buscarModelo })
}

export function cargar(s: EstadoModal, seq: number): EstadoModal {
  let e = buscar(s, seq)
  if (!e) return s
  let r = s
  if (e.idCli == null && !e.sinCliente && !(e.imei in r.clienteManual)) {
    r = actualizar(r, seq, (x) => aplicarClienteDefault(r, x))
    e = buscar(r, seq)!
  }
  if (e.tipo === 'REPARACION' && e.llevaGlass && glassAbiertaBd(r.tabla, e.imei) != null)
    r = actualizar(r, seq, (x) => ({ ...x, llevaGlass: false }))
  const base = e.asignada || e.tecnicos.length > 0 ? e.tecnicos : r.defTecnicos[e.tipo]
  const ocup = tecnicosOcupados(r.tabla, e.imei, e.tipo)
  r = { ...r, actual: seq, borrador: { tecnicos: base.filter((t) => !ocup.has(t)), comentario: e.comentario, esChasis: e.esChasis } }
  return e.asignada ? r : lanzarLookup(r, seq)
}

export function quitar(s: EstadoModal, seq: number): EstadoModal {
  const e = buscar(s, seq)
  if (!e) return s
  let r = setCola(s, e.tipo, colaDe(s, e.tipo).filter((x) => x.seq !== seq))
  if (e.tipo === 'REPARACION' && glassAbiertaBd(r.tabla, e.imei) == null) r = quitarGlassDe(r, e.imei)   // sin marca no hay glass
  if (e.tipo === 'GLASS') r = { ...r, rep: r.rep.map((x) => (x.imei === e.imei ? { ...x, llevaGlass: false } : x)) }   // sin glass no hay marca
  return r.actual === seq ? { ...r, actual: null } : r
}

export function lookupResuelto(s: EstadoModal, seq: number, modelo: string | null, idCliBd: number | null): EstadoModal {
  const e = buscar(s, seq)
  if (!e) return s
  let r = s
  if (modelo && !(e.imei in r.modeloPorImei)) r = { ...r, modeloPorImei: { ...r.modeloPorImei, [e.imei]: modelo } }
  const ctx = r
  return actualizar(r, seq, (x) => {
    let y: Entrada = { ...x, buscando: false }
    if (modelo) { if (!y.modelo) y = { ...y, modelo } }
    else if (x.buscando) y = { ...y, modeloNoEncontrado: true }
    return aplicarClienteBd(ctx, y, idCliBd)
  })
}

/** Modelo vivo: copia el modelo a TODAS las entradas del IMEI en las dos colas (port de propagarModelo). */
export function propagarModelo(imei: string | null, modelo: string, rep: Entrada[], glass: Entrada[]): { rep: Entrada[]; glass: Entrada[]; n: number } {
  if (imei == null) return { rep, glass, n: 0 }
  let n = 0
  const m = (xs: Entrada[]) => xs.map((x) => { if (x.imei !== imei) return x; n++; return { ...x, modelo } })
  return { rep: m(rep), glass: m(glass), n }
}

/** Decisión manual de modelo: propaga, recuerda para los próximos escaneos y lo guarda ya (D3). */
export function decidirModelo(s: EstadoModal, modelo: string): EstadoModal {
  const e = buscar(s, s.actual)
  if (!e || !modelo) return s
  const p = propagarModelo(e.imei, modelo, s.rep, s.glass)
  const r = { ...s, rep: p.rep, glass: p.glass, modeloPorImei: { ...s.modeloPorImei, [e.imei]: modelo } }
  return conEfecto(r, { tipo: 'guardarModelo', imei: e.imei, modelo })
}

export function borrarModelo(s: EstadoModal): EstadoModal {
  return s.actual == null ? s : actualizar(s, s.actual, (x) => ({ ...x, modelo: null }))
}

/** Clic en un técnico: memoriza los pegajosos de la cola; en una roja también sus técnicos; en una verde solo el borrador. */
export function marcarTecnico(s: EstadoModal, idTec: number, marcado: boolean): EstadoModal {
  const e = buscar(s, s.actual)
  if (!e || tecnicosOcupados(s.tabla, e.imei, e.tipo).has(idTec)) return s
  const tecnicos = marcado ? [...new Set([...s.borrador.tecnicos, idTec])] : s.borrador.tecnicos.filter((t) => t !== idTec)
  const r = { ...s, borrador: { ...s.borrador, tecnicos }, defTecnicos: { ...s.defTecnicos, [e.tipo]: tecnicos } }
  return e.asignada ? r : actualizar(r, e.seq, (x) => ({ ...x, tecnicos }))
}

export const cambiarComentario = (s: EstadoModal, texto: string): EstadoModal => ({ ...s, borrador: { ...s.borrador, comentario: texto } })
export const cambiarChasis = (s: EstadoModal, valor: boolean): EstadoModal => ({ ...s, borrador: { ...s.borrador, esChasis: valor } })

function cargarSiguienteRojo(s: EstadoModal): EstadoModal {
  if (s.pestana === 'PULIDO') return { ...s, actual: null }
  const rojas = colaDe(s, s.pestana).filter((x) => !x.asignada)
  return rojas.length === 0 ? { ...s, actual: null } : cargar(s, Math.max(...rojas.map((x) => x.seq)))
}

/** "Asignar →" / "Guardar cambios" (asignarActual del JavaFX). */
export function asignar(s: EstadoModal): EstadoModal {
  const e = buscar(s, s.actual)
  if (!e || !e.modelo) return s
  const ocup = tecnicosOcupados(s.tabla, e.imei, e.tipo)
  const sel = s.borrador.tecnicos.filter((t) => !ocup.has(t))
  if (sel.length === 0) return s
  const editandoVerde = e.asignada
  const ref: RefCliente = { idCli: e.idCli, sin: e.sinCliente }
  const borrador = s.borrador
  let r: EstadoModal = { ...s, clienteManual: { ...s.clienteManual, [e.imei]: ref }, defTecnicos: { ...s.defTecnicos, [e.tipo]: sel } }
  r = propagarCliente(r, e.imei, ref)
  r = actualizar(r, e.seq, (x) => ({
    ...x, tecnicos: sel, comentario: borrador.comentario.trim(), esChasis: x.tipo === 'REPARACION' && borrador.esChasis, asignada: true,
    ...(x.tipo === 'GLASS' ? { auto: false, calculando: false } : {}),
  }))
  if (e.tipo === 'REPARACION') {
    const bloqueada = glassAbiertaBd(r.tabla, e.imei) != null
    if (e.llevaGlass && !bloqueada) {
      r = crearGlassDe(r, e.seq, false)
      const g = glassDe(r, e.imei)
      if (g) {
        if (!g.modelo) r = actualizar(r, g.seq, (x) => ({ ...x, modelo: e.modelo }))
        r = predecir(r, g.seq)
      }
    } else if (!bloqueada) {
      r = quitarGlassDe(r, e.imei)
    }
  }
  return editandoVerde ? { ...r, actual: null } : cargarSiguienteRojo(r)
}
