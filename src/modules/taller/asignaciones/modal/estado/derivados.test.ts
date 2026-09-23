import { describe, expect, it } from 'vitest'
import {
  asignarHabilitado, contadorPestana, filasCola, glassAbiertaBd, imeiEnColaActiva, promptModelo, resumenBarra,
  tecnicosOcupados, totalEscaneados, verdesParaPrediccion,
} from './derivados'
import { entrada, estado, filaTabla, IMEI_1, IMEI_2 } from './fabrica'

const tabla = [
  filaTabla({ idRep: 'A1', imei: IMEI_1, idTec: 3 }),
  filaTabla({ idRep: 'AG1', imei: IMEI_1, idTec: 4, nombreTecnico: 'Técnico G' }),
  filaTabla({ idRep: 'AP1', imei: IMEI_1, idTec: 5 }),
]

describe('derivados', () => {
  it('ocupados por categoría, sobre la tabla', () => {
    expect([...tecnicosOcupados(tabla, IMEI_1, 'REPARACION')]).toEqual([3])
    expect([...tecnicosOcupados(tabla, IMEI_1, 'GLASS')]).toEqual([4])
    expect(tecnicosOcupados(tabla, IMEI_2, 'REPARACION').size).toBe(0)
  })

  it('glass abierta en BD: nombre del técnico o null', () => {
    expect(glassAbiertaBd(tabla, IMEI_1)).toBe('Técnico G')
    expect(glassAbiertaBd(tabla, IMEI_2)).toBeNull()
  })

  it('verdes para la predicción: una por entrada verde × técnico, con conCliente', () => {
    const s = estado({
      rep: [entrada({ seq: 1, imei: IMEI_1, asignada: true, tecnicos: [3, 4], esChasis: true, idCli: 9 }),
        entrada({ seq: 2, imei: IMEI_2, asignada: false, tecnicos: [3] })],
      glass: [entrada({ seq: 3, imei: IMEI_1, tipo: 'GLASS', asignada: true, tecnicos: [5] })],
    })
    expect(verdesParaPrediccion(s)).toEqual([
      { imei: IMEI_1, idTec: 3, tipo: 'REPARACION', esChasis: true, conCliente: true },
      { imei: IMEI_1, idTec: 4, tipo: 'REPARACION', esChasis: true, conCliente: true },
      { imei: IMEI_1, idTec: 5, tipo: 'GLASS', esChasis: false, conCliente: false },
    ])
  })

  it('filas de la cola activa: rojas y verdes de más nueva a más vieja', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1 }), entrada({ seq: 4, imei: IMEI_2 }),
      entrada({ seq: 2, imei: '333333333333333', asignada: true })] })
    const { rojas, verdes } = filasCola(s, 'REPARACION')
    expect(rojas.map((e) => e.seq)).toEqual([4, 1])
    expect(verdes.map((e) => e.seq)).toEqual([2])
  })

  it('contador de pestaña: total y pendientes (pulido sin técnico cuenta como pendiente)', () => {
    const s = estado({
      glass: [entrada({ seq: 1, imei: IMEI_1, tipo: 'GLASS', asignada: true })],
      pulido: [{ seq: 2, imei: IMEI_1, idTec: null, comentario: '', idCli: null, sinCliente: false }],
    })
    expect(contadorPestana(s, 'GLASS')).toEqual({ total: 1, pendientes: 0 })
    expect(contadorPestana(s, 'PULIDO')).toEqual({ total: 1, pendientes: 1 })
    expect(contadorPestana(s, 'REPARACION')).toEqual({ total: 0, pendientes: 0 })
  })

  it('barra: textos y Guardar', () => {
    const vacio = resumenBarra(estado())
    expect(vacio).toEqual({ texto: '0 configurados · 0 pendientes', n: 0, guardarHabilitado: false })
    const s = estado({
      rep: [entrada({ seq: 1, imei: IMEI_1, asignada: true }), entrada({ seq: 2, imei: IMEI_2 })],
      pulido: [{ seq: 3, imei: IMEI_1, idTec: 5, comentario: '', idCli: null, sinCliente: false }],
    })
    expect(resumenBarra(s)).toEqual({ texto: '1 configurados · 1 pendientes · 1 pulido · 1 sin modelo', n: 2, guardarHabilitado: false })
    const listo = estado({ rep: [entrada({ seq: 1, imei: IMEI_1, asignada: true, modelo: '12' })],
      pulido: [{ seq: 3, imei: IMEI_1, idTec: 5, comentario: '', idCli: null, sinCliente: false }] })
    expect(resumenBarra(listo)).toEqual({ texto: '1 configurados · 0 pendientes · 1 pulido', n: 2, guardarHabilitado: true })
  })

  it('Guardar se bloquea con un pulido sin técnico', () => {
    const s = estado({ pulido: [{ seq: 1, imei: IMEI_1, idTec: null, comentario: '', idCli: null, sinCliente: false }] })
    expect(resumenBarra(s).guardarHabilitado).toBe(false)
  })

  it('Guardar se bloquea si una verde R/G no tiene modelo ni modelo vivo del IMEI (fix A)', () => {
    const sinModeloNiVivo = estado({ rep: [entrada({ seq: 1, imei: IMEI_1, asignada: true, modelo: null, tecnicos: [3] })] })
    expect(resumenBarra(sinModeloNiVivo).guardarHabilitado).toBe(false)
    const conVivo = estado({
      rep: [entrada({ seq: 1, imei: IMEI_1, asignada: true, modelo: null, tecnicos: [3] })],
      modeloPorImei: { [IMEI_1]: '12' },
    })
    expect(resumenBarra(conVivo).guardarHabilitado).toBe(true)
  })

  it('Asignar exige modelo y un técnico marcado que no esté ocupado', () => {
    const base = estado({ tabla, rep: [entrada({ seq: 1, imei: IMEI_1, modelo: '12' })], actual: 1 })
    expect(asignarHabilitado({ ...base, borrador: { tecnicos: [], comentario: '', esChasis: false } })).toBe(false)
    expect(asignarHabilitado({ ...base, borrador: { tecnicos: [3], comentario: '', esChasis: false } })).toBe(false)
    expect(asignarHabilitado({ ...base, borrador: { tecnicos: [7], comentario: '', esChasis: false } })).toBe(true)
    const sinModelo = { ...base, rep: [entrada({ seq: 1, imei: IMEI_1 })], borrador: { tecnicos: [7], comentario: '', esChasis: false } }
    expect(asignarHabilitado(sinModelo)).toBe(false)
  })

  it('total escaneados: rep + glass + pulido', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1 })], glass: [entrada({ seq: 2, imei: IMEI_1, tipo: 'GLASS' })],
      pulido: [{ seq: 3, imei: IMEI_2, idTec: null, comentario: '', idCli: null, sinCliente: false }] })
    expect(totalEscaneados(s)).toBe(3)
  })

  it('prompt del modelo', () => {
    expect(promptModelo(entrada({ seq: 1, imei: IMEI_1, buscando: true }))).toBe('Buscando...')
    expect(promptModelo(entrada({ seq: 1, imei: IMEI_1, modeloNoEncontrado: true }))).toBe('No encontrado — selecciona manualmente')
    expect(promptModelo(entrada({ seq: 1, imei: IMEI_1 }))).toBe('Escribe modelo...')
  })

  it('IMEI en la cola activa', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1 })] })
    expect(imeiEnColaActiva(s, IMEI_1)).toBe(true)
    expect(imeiEnColaActiva({ ...s, pestana: 'GLASS' }, IMEI_1)).toBe(false)
  })
})
