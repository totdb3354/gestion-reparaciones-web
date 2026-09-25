import { describe, expect, it } from 'vitest'
import { formatearImporte, formatearNumero, parsearDecimal, parsearEntero, simboloDivisa, simboloFormulario } from './importes'

/** Calco de `String.format("%.2f …")` con el Locale por defecto de un Windows en español (inventario de Pedidos §15):
 *  coma decimal y sin separador de miles. Los campos de edición aceptan coma o punto (`replace(",", ".")`). */
describe('importes', () => {
  it('formatearNumero: coma decimal, sin separador de miles y 2 decimales por defecto', () => {
    expect(formatearNumero(12.5)).toBe('12,50')
    expect(formatearNumero(0)).toBe('0,00')
    expect(formatearNumero(1234567.891)).toBe('1234567,89')
    expect(formatearNumero(-3)).toBe('-3,00')
    expect(formatearNumero(1 / 1.1367, 4)).toBe('0,8797')
  })
  it('formatearImporte: el número y el símbolo separados por un espacio', () => {
    expect(formatearImporte(12.5, '€')).toBe('12,50 €')
    expect(formatearImporte(10, '$')).toBe('10,00 $')
  })
  it('simboloDivisa (tabla de Pedidos): EUR → €, USD → $, cualquier otra → el propio código', () => {
    expect(simboloDivisa('EUR')).toBe('€')
    expect(simboloDivisa('USD')).toBe('$')
    expect(simboloDivisa('GBP')).toBe('GBP')
  })
  it('simboloFormulario (celda P.Unit. de los formularios de alta): USD → $, cualquier otra → €', () => {
    expect(simboloFormulario('USD')).toBe('$')
    expect(simboloFormulario('EUR')).toBe('€')
    expect(simboloFormulario('GBP')).toBe('€')
  })
  it('parsearDecimal acepta coma o punto y devuelve null si no es un número', () => {
    expect(parsearDecimal('12,5')).toBe(12.5)
    expect(parsearDecimal(' 12.50 ')).toBe(12.5)
    expect(parsearDecimal('0')).toBe(0)
    expect(parsearDecimal('-1,5')).toBe(-1.5)
    expect(parsearDecimal('abc')).toBeNull()
    expect(parsearDecimal('')).toBeNull()
    expect(parsearDecimal('1,2,3')).toBeNull()
  })
  it('parsearEntero: solo dígitos tras recortar', () => {
    expect(parsearEntero('3')).toBe(3)
    expect(parsearEntero(' 12 ')).toBe(12)
    expect(parsearEntero('3.5')).toBeNull()
    expect(parsearEntero('-1')).toBeNull()
    expect(parsearEntero('')).toBeNull()
    expect(parsearEntero('abc')).toBeNull()
  })
})
