import { describe, expect, it } from 'vitest'
import { agruparPorImei } from '../lib/grupoImei'
import { resumen } from '../test/fabrica'
import { filaResumen } from './csvImeis'

describe('CSV agrupado_resumen: «Modelo» (0.9.24)', () => {
  it('lleva «eSIM» detrás del modelo si NSYS dice que es eSIM; si no, el modelo solo', () => {
    const [esim] = agruparPorImei([resumen({ imei: '350000000000001', modelo: '14', capacidad: '256GB', color: 'Negro', esEsim: true })])
    expect(filaResumen(esim).slice(0, 4)).toEqual(['="350000000000001"', 'iPhone 14 eSIM', '256GB', 'Negro'])
    const [sim] = agruparPorImei([resumen({ imei: '350000000000002', modelo: '14', capacidad: '256GB', color: 'Negro' })])
    expect(filaResumen(sim)[1]).toBe('iPhone 14')
  })
})
