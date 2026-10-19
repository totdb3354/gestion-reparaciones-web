import { describe, expect, it } from 'vitest'
import { AHORA, movilComprobado, noEncontrado, trabajo } from '../test/fabrica'
import { analizar, cruzar, esImei, imeisEn, paraExcel, resumen, textoEstado, trocear } from './varios'

describe('pegar varios IMEIs (spec 0.9.18 §4.9)', () => {
  it('trocea lo pegado: líneas, comas, puntos y comas, tabuladores y una columna de Excel', () => {
    expect(trocear('350000000000001\r\n350000000000002, 350000000000003;350000000000004\t350000000000005\n\n')).toEqual([
      '350000000000001', '350000000000002', '350000000000003', '350000000000004', '350000000000005',
    ])
  })

  it('un IMEI son 15 cifras; un número de serie, de 8 a 20 letras y cifras, con alguna de cada', () => {
    expect(esImei('350000000000001')).toBe(true)
    expect(esImei('F2LXABC123')).toBe(true)
    expect(esImei('35000000000001')).toBe(false)
    expect(esImei('12345678')).toBe(false)
    expect(esImei('pendiente')).toBe(false)
    expect(esImei('F2L1')).toBe(false)
  })

  it('cada línea: no es un IMEI, repetido (con la línea del primero) o un IMEI que preguntar; las series en mayúsculas', () => {
    const { lineas, imeis } = analizar('350000000000001\nf2lxabc123\npendiente\n350000000000001\nF2LXABC123')
    expect(lineas).toEqual([
      { n: 1, texto: '350000000000001', tipo: 'IMEI', imei: '350000000000001' },
      { n: 2, texto: 'f2lxabc123', tipo: 'IMEI', imei: 'F2LXABC123' },
      { n: 3, texto: 'pendiente', tipo: 'NO_IMEI' },
      { n: 4, texto: '350000000000001', tipo: 'REPETIDO', de: 1 },
      { n: 5, texto: 'F2LXABC123', tipo: 'REPETIDO', de: 2 },
    ])
    expect(imeis).toEqual(['350000000000001', 'F2LXABC123'])
    expect(imeisEn('350000000000001 hola 350000000000002')).toBe(2)
  })

  it('el estado de cada línea con la respuesta del servidor', () => {
    const { lineas } = analizar('350000000000001 350000000000002 350000000000003 350000000000004 350000000000005 350000000000006 350000000000007 x')
    const filas = cruzar(lineas, [
      movilComprobado({ imei: '350000000000001' }),
      noEncontrado('350000000000002'),
      movilComprobado({ imei: '350000000000003', estado: 'DE_PEDIDO' }),
      movilComprobado({ imei: '350000000000004', estado: 'NO_CUENTA' }),
      movilComprobado({ imei: '350000000000005', estado: 'VENDIDO', fechaVenta: '2026-10-02' }),
      movilComprobado({ imei: '350000000000006', estado: 'VENDIDO', fechaVenta: null }),
      movilComprobado({ imei: '350000000000007', estado: 'BAJA' }),
    ])
    expect(filas.map(textoEstado)).toEqual([
      'Libre', 'No está en NSYS', 'De pedido', 'No cuenta', 'Vendido 02/10/2026', 'Vendido', 'Baja en NSYS', 'No es un IMEI',
    ])
  })

  it('el resumen: siempre «N en stock» y lo demás si lo hay, en singular o en plural', () => {
    const { lineas } = analizar('350000000000001 350000000000002 350000000000003 350000000000001 x y')
    const filas = cruzar(lineas, [
      movilComprobado({ imei: '350000000000001' }), noEncontrado('350000000000002'),
      movilComprobado({ imei: '350000000000003', estado: 'VENDIDO', fechaVenta: '2026-10-02' }),
    ])
    expect(resumen(filas)).toEqual([
      { texto: '1 en stock', tono: 'ok' }, { texto: '1 vendido', tono: 'aviso' }, { texto: '1 no está en NSYS', tono: 'mal' },
      { texto: '1 repetido', tono: 'neutro' }, { texto: '2 no son un IMEI', tono: 'neutro' },
    ])
    expect(resumen([])).toEqual([{ texto: '0 en stock', tono: 'ok' }])
  })

  it('la tabla para Excel: separada por tabuladores, con cabecera y «Quién lo tiene»', () => {
    const { lineas } = analizar('350000000000001\nx')
    const filas = cruzar(lineas, [movilComprobado({ imei: '350000000000001', ubicacion: 'Taller · Reparación', trabajos: [trabajo({ tecnico: 'Técnico 1' })] })])
    expect(paraExcel(filas, AHORA)).toBe([
      '#\tIMEI\tModelo\tColor\tGrado\tUbicación\tQuién lo tiene\tEstado',
      '1\t350000000000001\tiPhone 13 128GB\tAzul\tA\tTaller · Reparación\tTécnico 1\tLibre',
      '2\tx\t\t\t\t\t\tNo es un IMEI',
    ].join('\n'))
  })
})
