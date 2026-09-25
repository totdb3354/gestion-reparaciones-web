import { describe, expect, it } from 'vitest'
import { textoTotalEdicion, validarEdicion } from './edicion'

const TASA_EUR = { tasa: 1, cargando: false, error: false }
const TASA_USD = { tasa: 1.1367, cargando: false, error: false }

describe('validarEdicion', () => {
  it('componentes: proveedor → cantidad → precio (FCE :116-136); válido devuelve los números', () => {
    expect(validarEdicion({ idProv: null, cantidad: '0', precio: 'x' })).toEqual({ ok: false, error: 'Selecciona un proveedor.' })
    for (const cantidad of ['0', '-1', 'abc', '1,5', ''])
      expect(validarEdicion({ idProv: 1, cantidad, precio: 'x' })).toEqual({ ok: false, error: 'Cantidad no válida (debe ser > 0).' })
    for (const precio of ['-1', 'abc', ''])
      expect(validarEdicion({ idProv: 1, cantidad: '3', precio })).toEqual({ ok: false, error: 'Precio no válido.' })
    expect(validarEdicion({ idProv: 1, cantidad: ' 3 ', precio: '12,5' })).toEqual({ ok: true, valor: { concepto: null, idProv: 1, cantidad: 3, precioUnidad: 12.5 } })
    expect(validarEdicion({ idProv: 1, cantidad: '3', precio: '0' })).toEqual({ ok: true, valor: { concepto: null, idProv: 1, cantidad: 3, precioUnidad: 0 } })
  })
  it('otros: el concepto (tras trim) va primero (FOE :139-165) y se devuelve recortado', () => {
    expect(validarEdicion({ concepto: '  ', idProv: null, cantidad: '0', precio: 'x' })).toEqual({ ok: false, error: 'El concepto no puede estar vacío.' })
    expect(validarEdicion({ concepto: ' Cinta ancha ', idProv: 1, cantidad: '4', precio: '2' })).toEqual({ ok: true, valor: { concepto: 'Cinta ancha', idProv: 1, cantidad: 4, precioUnidad: 2 } })
  })
})

describe('textoTotalEdicion', () => {
  it('tasa cargando o con error (P7: no calcula como si fuera EUR)', () => {
    expect(textoTotalEdicion('10', '2', 'USD', { tasa: null, cargando: true, error: false })).toBe('Obteniendo tasa…')
    expect(textoTotalEdicion('10', '2', 'USD', { tasa: null, cargando: false, error: true })).toBe('Error al obtener tasa')
  })
  it('EUR: total sin etiqueta; "—" si precio o cantidad no parsean', () => {
    expect(textoTotalEdicion('12,50', '3', 'EUR', TASA_EUR)).toBe('37,50 €')
    expect(textoTotalEdicion('abc', '3', 'EUR', TASA_EUR)).toBe('—')
    expect(textoTotalEdicion('12,50', '', 'EUR', TASA_EUR)).toBe('—')
  })
  it('USD: precio / tasa × cantidad y la etiqueta con 1/tasa', () => {
    expect(textoTotalEdicion('12,50', '3', 'USD', TASA_USD)).toBe('32,99 €  (1 USD = 0,8797 €)')
  })
})
