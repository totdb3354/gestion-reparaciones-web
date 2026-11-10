import { describe, expect, it } from 'vitest'
import { fila } from '../test/fabrica'
import { COLUMNAS, TEXTO_NIVEL, claseCelda, haceUnMes, recuento, textoMotivo } from './filas'

describe('textoMotivo', () => {
  it.each([
    ['NO_EN_NSYS', null, 'no está en NSYS'],
    ['EN_OTRA_FILA', null, 'ya está en otro pedido'],
    ['MODELO', 'i14128AzulA', 'otro modelo, capacidad o eSIM: es i14128AzulA'],
    ['MODELO', null, 'otro modelo, capacidad o eSIM'],
    ['COLOR_O_GRADO', 'i13128RosaA', 'otro color o grado: es i13128RosaA'],
    ['COLOR_O_GRADO', null, 'otro color o grado'],
    ['GRADO_NO_VENDIBLE', null, 'ese grado no se vende'],
    ['SKU_DESCONOCIDO', null, 'el maestro no conoce este SKU'],
    ['EN_TALLER', null, 'en el taller'],
    ['MS', null, 'es un Ms'],
    ['B_POR_A', null, 'B por A'],
  ])('%s (%s) → %s', (motivo, skuMovil, esperado) => {
    expect(textoMotivo(fila({ motivo, skuMovil }))).toBe(esperado)
  })

  it('sin motivo, null', () => {
    expect(textoMotivo(fila())).toBeNull()
  })
})

describe('claseCelda', () => {
  it('enviada gana, con o sin IMEI', () => {
    expect(claseCelda(fila({ enviada: true }))).toBe('enviada')
    expect(claseCelda(fila({ enviada: true, imei: '350000000000001', nivel: 'MAL' }))).toBe('enviada')
  })
  it('sin IMEI, vacía', () => expect(claseCelda(fila())).toBe('vacia'))
  it('por nivel', () => {
    const imei = '350000000000001'
    expect(claseCelda(fila({ imei, nivel: 'OK' }))).toBe('ok')
    expect(claseCelda(fila({ imei, nivel: 'AVISO' }))).toBe('aviso')
    expect(claseCelda(fila({ imei, nivel: 'MAL' }))).toBe('mal')
    expect(claseCelda(fila({ imei, nivel: null }))).toBe('ok')
  })
})

describe('recuento', () => {
  it('cuenta total, sin enviar y sin IMEI (solo entre las sin enviar)', () => {
    const filas = [
      fila({ idFila: 1, enviada: true }), fila({ idFila: 2, imei: '350000000000001' }), fila({ idFila: 3 }), fila({ idFila: 4 }),
    ]
    expect(recuento(filas)).toEqual({ total: 4, sinEnviar: 3, sinImei: 2 })
  })
  it('vacío', () => expect(recuento([])).toEqual({ total: 0, sinEnviar: 0, sinImei: 0 }))
})

describe('constantes', () => {
  it('columnas y textos de nivel', () => {
    expect([...COLUMNAS]).toEqual(['Fecha', 'Plataforma', 'SKU', 'IMEI', 'Pedido', 'Fecha compra'])
    expect(TEXTO_NIVEL[3]).toBe('hay que transformarlo')
  })
})

describe('haceUnMes', () => {
  it('el mismo día del mes anterior, o el último si no existe', () => {
    expect(haceUnMes('2026-11-10')).toBe('2026-10-10')
    expect(haceUnMes('2026-01-15')).toBe('2025-12-15')
    expect(haceUnMes('2026-03-31')).toBe('2026-02-28')
    expect(haceUnMes('2028-03-31')).toBe('2028-02-29')
  })
})
