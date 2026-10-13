import { describe, expect, it } from 'vitest'
import type { ResultadoEntregaGlass } from '@/shared/api/client'
import { glass, normal, resumen } from '../test/fabrica'
import {
  avisoDeshacer, avisoEntrega, avisoLlegada, etiquetaGlassPendiente, etiquetaRepAbierta, mostrarMarcarLlegada, ocultarAnadirGlass, opcionDeshacerLlegada, opcionMenuEntrega,
  subEtiquetaHistorial, textoBadgeEntrega, textoCsvEntrega, tooltipEntrega, tooltipGlassPendiente, tooltipRepAbierta,
} from './entregaGlass'

const UTC_0842 = '2026-08-28T08:42:00'
const HOY = '2026-08-28'
const MANANA = '2026-08-29'

describe('entregaGlass (calco de EntregaGlass, spec 2026-08-28)', () => {
  it('badge arriba dice a quién, sin hora y sin depender del día', () => {
    expect(textoBadgeEntrega(normal(true, UTC_0842), HOY)).toBe('→ Técnico H')
    expect(textoBadgeEntrega(normal(true, UTC_0842), MANANA)).toBe('→ Técnico H')
    expect(textoBadgeEntrega(normal(true, UTC_0842), null)).toBe('→ Técnico H')
  })
  it('badge de glass dice Llegó con hora hoy y con fecha otro día', () => {
    expect(textoBadgeEntrega(glass(UTC_0842), HOY)).toBe('Llegó 10:42')
    expect(textoBadgeEntrega(glass(UTC_0842), MANANA)).toBe('Llegó 28/08')
    expect(textoBadgeEntrega(glass(UTC_0842), null)).toBe('Llegó 28/08')
  })
  it('sin entrega, en pulidos o sin fila no hay badge ni tooltip', () => {
    expect(textoBadgeEntrega(normal(true, null), HOY)).toBeNull()
    expect(textoBadgeEntrega(glass(null), HOY)).toBeNull()
    expect(textoBadgeEntrega(resumen({ idRep: 'AP20260828_1', entregadoAt: UTC_0842 }), HOY)).toBeNull()
    expect(textoBadgeEntrega(null, HOY)).toBeNull()
    expect(tooltipEntrega(normal(true, null))).toBeNull()
    expect(tooltipEntrega(null)).toBeNull()
  })
  it('tooltips', () => {
    expect(tooltipEntrega(normal(true, UTC_0842))).toBe('Entregado a Técnico H por Técnico J, 28/08 10:42')
    expect(tooltipEntrega(glass(UTC_0842))).toBe('Bajado por Técnico J, 28/08 10:42')
  })
  it('opción de menú de entrega', () => {
    expect(opcionMenuEntrega(normal(true, null), false, 7)).toBe('Entregar a Técnico H')
    expect(opcionMenuEntrega(normal(true, UTC_0842), false, 7)).toBe('Deshacer entrega')
    expect(opcionMenuEntrega(normal(true, UTC_0842), false, 9)).toBeNull()      // la firmó otro
    expect(opcionMenuEntrega(normal(true, UTC_0842), false, null)).toBeNull()
    expect(opcionMenuEntrega(normal(true, null), false, 9)).toBe('Entregar a Técnico H')  // entregar no exige firma
    expect(opcionMenuEntrega(normal(false, null), false, 7)).toBeNull()
    expect(opcionMenuEntrega(normal(true, null), true, 7)).toBeNull()
    expect(opcionMenuEntrega(glass(null), false, 7)).toBeNull()
    expect(opcionMenuEntrega(null, false, 7)).toBeNull()
  })
  it('nombre vacío cae en "glass"', () => {
    const sinTecnico = { ...normal(true, null), glassTecnicoNombre: null }
    expect(opcionMenuEntrega(sinTecnico, false, 7)).toBe('Entregar a glass')
    const conEntrega = { ...normal(true, UTC_0842), glassTecnicoNombre: '', glassEntregadoPorNombre: null }
    expect(tooltipEntrega(conEntrega)).toBe('Entregado a glass por glass, 28/08 10:42')
    expect(textoBadgeEntrega(conEntrega, HOY)).toBe('→ glass')
  })
  it('CSV: fecha completa o vacío', () => {
    expect(textoCsvEntrega(normal(true, UTC_0842))).toBe('28/08/2026 10:42')
    expect(textoCsvEntrega(glass(UTC_0842))).toBe('28/08/2026 10:42')
    expect(textoCsvEntrega(normal(true, null))).toBe('')
    expect(textoCsvEntrega(null)).toBe('')
    expect(textoCsvEntrega(resumen({ idRep: 'AP20260828_1', entregadoAt: UTC_0842, glassEntregadoAt: UTC_0842 }))).toBe('')
  })
  it('"Añadir glass" se oculta solo con normal abierta y sin entrega; "Marcar que llegó" solo en la pestaña Glass y bloqueada', () => {
    const bloqueada = { ...glass(null), normalAbierta: true }
    expect(ocultarAnadirGlass(bloqueada)).toBe(true)
    expect(ocultarAnadirGlass({ ...glass(UTC_0842), normalAbierta: true })).toBe(false)
    expect(ocultarAnadirGlass(glass(null))).toBe(false)
    expect(ocultarAnadirGlass({ ...normal(true, null), normalAbierta: true })).toBe(false)
    expect(ocultarAnadirGlass(null)).toBe(false)
    expect(mostrarMarcarLlegada(bloqueada, true)).toBe(true)
    expect(mostrarMarcarLlegada(bloqueada, false)).toBe(false)
    expect(mostrarMarcarLlegada({ ...glass(UTC_0842), normalAbierta: true }, true)).toBe(false)
    expect(mostrarMarcarLlegada(glass(null), true)).toBe(false)
    expect(mostrarMarcarLlegada(null, true)).toBe(false)
  })
  it('sub-etiqueta del historial solo en glass con entrega', () => {
    expect(subEtiquetaHistorial(resumen({ idRep: 'G20260828_64', entregadoAt: UTC_0842, entregadoPorNombre: 'Técnico J' }))).toBe('Llegó 28/08 10:42')
    expect(subEtiquetaHistorial(glass(UTC_0842))).toBe('Llegó 28/08 10:42')
    expect(subEtiquetaHistorial(glass(null))).toBeNull()
    expect(subEtiquetaHistorial(normal(true, UTC_0842))).toBeNull()
    expect(subEtiquetaHistorial(null)).toBeNull()
  })
  it('píldoras "Glass: X" y "Rep: X" con sus tooltips', () => {
    expect(etiquetaGlassPendiente(normal(true, null))).toBe('Glass: Técnico H')
    expect(etiquetaGlassPendiente(normal(true, UTC_0842))).toBeNull()
    expect(etiquetaGlassPendiente(normal(false, null))).toBeNull()
    expect(etiquetaGlassPendiente(glass(null))).toBeNull()
    expect(etiquetaGlassPendiente(null)).toBeNull()
    expect(tooltipGlassPendiente(normal(true, null))).toBe('Glass abierta de Técnico H — entrega sin registrar')
    expect(tooltipGlassPendiente({ ...normal(true, null), glassTecnicoNombre: null })).toBe('Glass abierta de glass — entrega sin registrar')
    expect(tooltipGlassPendiente(normal(true, UTC_0842))).toBeNull()
    const ag = { ...glass(null), normalAbierta: true, normalTecnicoNombre: 'Técnico J' }
    expect(etiquetaRepAbierta(ag)).toBe('Rep: Técnico J')
    expect(tooltipRepAbierta(ag)).toBe('Reparación abierta de Técnico J')
    expect(etiquetaRepAbierta({ ...glass(UTC_0842), normalAbierta: true, normalTecnicoNombre: 'Técnico J' })).toBe('Rep: Técnico J')
    expect(etiquetaRepAbierta({ ...glass(null), normalAbierta: true, normalTecnicoNombre: null })).toBe('Rep: técnico')
    expect(etiquetaRepAbierta(glass(null))).toBeNull()
    expect(etiquetaRepAbierta(normal(true, null))).toBeNull()
    expect(tooltipRepAbierta(glass(null))).toBeNull()
  })
  it('deshacer llegada solo para el firmante en la pestaña Glass', () => {
    const ag = glass(UTC_0842)
    expect(opcionDeshacerLlegada(ag, true, 7)).toBe('Deshacer llegada')
    expect(opcionDeshacerLlegada(ag, true, 9)).toBeNull()
    expect(opcionDeshacerLlegada(ag, false, 7)).toBeNull()
    expect(opcionDeshacerLlegada(glass(null), true, 7)).toBeNull()
    expect(opcionDeshacerLlegada(normal(true, UTC_0842), true, 7)).toBeNull()
    expect(opcionDeshacerLlegada(null, true, 7)).toBeNull()
  })
})

const res = (p: Partial<ResultadoEntregaGlass>): ResultadoEntregaGlass => ({
  abrir: null, idRepAbrir: null, tecnicoAbrir: null, idRepBorrado: null, ...p,
})

describe('avisos del «Abrir» automático (spec 2026-10-13 §2.1–2.4)', () => {
  it('entregar: creado, ya abierto y sin pieza otro', () => {
    expect(avisoEntrega(res({ abrir: 'CREADO', idRepAbrir: 'R20261013_101', tecnicoAbrir: 'Técnico J' }), 'Técnico H'))
      .toEqual({ texto: 'Entregado a Técnico H · Abierto', tipo: 'ok' })
    expect(avisoEntrega(res({ abrir: 'YA_EXISTIA', tecnicoAbrir: 'Técnico J' }), 'Técnico H'))
      .toEqual({ texto: 'Entregado a Técnico H · ya estaba abierto', tipo: 'info' })
    expect(avisoEntrega(res({ abrir: 'SIN_PIEZA_OTRO', tecnicoAbrir: 'Técnico J' }), 'Técnico H'))
      .toEqual({ texto: 'Entregado a Técnico H · sin «Abrir» (el modelo no tiene pieza otro)', tipo: 'warn' })
    expect(avisoEntrega(res({ abrir: 'CREADO' }), null).texto).toBe('Entregado a glass · Abierto')
  })
  it('llegada: dice a quién se apuntó el «Abrir»; sin normal, solo la llegada', () => {
    expect(avisoLlegada(res({ abrir: 'CREADO', idRepAbrir: 'R20261013_102', tecnicoAbrir: 'Técnico L' })))
      .toEqual({ texto: 'Llegada registrada · Abierto (Técnico L)', tipo: 'ok' })
    expect(avisoLlegada(res({ abrir: 'YA_EXISTIA', tecnicoAbrir: 'Técnico L' })))
      .toEqual({ texto: 'Llegada registrada · ya estaba abierto', tipo: 'info' })
    expect(avisoLlegada(res({ abrir: 'SIN_PIEZA_OTRO', tecnicoAbrir: 'Técnico L' })))
      .toEqual({ texto: 'Llegada registrada · sin «Abrir» (el modelo no tiene pieza otro)', tipo: 'warn' })
    expect(avisoLlegada(res({ abrir: 'SIN_NORMAL' }))).toEqual({ texto: 'Llegada registrada', tipo: 'info' })
  })
  it('deshacer: con y sin «Abrir» que borrar', () => {
    expect(avisoDeshacer(res({ idRepBorrado: 'R20261013_101' }), false)).toEqual({ texto: 'Entrega deshecha · «Abrir» borrado', tipo: 'ok' })
    expect(avisoDeshacer(res({}), false)).toEqual({ texto: 'Entrega deshecha', tipo: 'info' })
    expect(avisoDeshacer(res({ idRepBorrado: 'R20261013_101' }), true)).toEqual({ texto: 'Llegada deshecha · «Abrir» borrado', tipo: 'ok' })
    expect(avisoDeshacer(res({}), true)).toEqual({ texto: 'Llegada deshecha', tipo: 'info' })
  })
})
