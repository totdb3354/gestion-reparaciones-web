import { describe, expect, it } from 'vitest'
import { filaPorPasar, porQue } from '../test/fabrica'
import { modeloDeFila, paraExcel, textoDesde, textoEnNsys, textoPorQue } from './porPasar'

describe('lista «Por pasar a NSYS» (spec 0.9.21 §2.4)', () => {
  it('por qué: a mano con quién y motivo; sin motivo, sin la última parte; la reparación de la pieza 2', () => {
    expect(textoPorQue(porQue({ dato: 'COLOR', usuario: 'Supertécnico 1', motivo: 'chasis rojo' }))).toBe('Color: a mano · Supertécnico 1 · «chasis rojo»')
    expect(textoPorQue(porQue({ motivo: null }))).toBe('Grado: a mano · Técnico 1')
    expect(textoPorQue(porQue({ origen: 'REPARACION', idRep: 'R20261020_4', usuario: 'Técnico 2', motivo: null })))
      .toBe('Grado: reparación R20261020_4 · Técnico 2')
  })

  it('el modelo, lo de NSYS hoy y desde cuándo', () => {
    const f = filaPorPasar()
    expect(modeloDeFila(f)).toBe('iPhone 13 128GB')
    expect(textoEnNsys(f)).toBe('Apple iPhone 13 128GB Blue · grado B')
    expect(textoDesde(f.desde)).toBe('20/10/2026 10:31')
  })

  it('para Excel: la cabecera y una línea por móvil, sin tabuladores dentro de las celdas', () => {
    const [cabecera, uno, dos] = paraExcel([
      filaPorPasar(),
      filaPorPasar({ imeiSn: '350000000000002', ponerProducto: null, sku: null, porQue: [porQue({ motivo: 'uno\tdos' })] }),
    ]).split('\n')
    expect(cabecera).toBe('IMEI\tModelo\tEn NSYS hoy\tPoner en NSYS\tSKU nuevo\tPor qué\tDesde')
    expect(uno).toBe('350000000000001\tiPhone 13 128GB\tApple iPhone 13 128GB Blue · grado B\tApple iPhone 13 128GB Blue · grado A100'
      + '\ti13128AzulA100\tGrado: a mano · Técnico 1 · «batería nueva»\t20/10/2026 10:31')
    expect(dos).toContain('(ningún móvil de ese color en NSYS: búscalo a mano) · grado A100\tsin SKU en el maestro\tGrado: a mano · Técnico 1 · «uno dos»')
  })
})
