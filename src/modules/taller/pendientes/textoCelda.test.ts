import { describe, expect, it } from 'vitest'
import { resumen } from '../test/fabrica'
import { textoCeldaPendiente } from './textoCelda'

describe('textoCeldaPendiente: «Copiar celda» de Asignaciones, Pendientes y Pulidos pendientes', () => {
  it('0.9.21: el modelo copia la descripción completa; sin NSYS, el modelo solo; sin modelo, vacío', () => {
    expect(textoCeldaPendiente(resumen({ modelo: '13', capacidad: '128GB', color: 'Azul' }), 'modelo')).toBe('iPhone 13 128GB Azul')
    expect(textoCeldaPendiente(resumen({ modelo: '13', capacidad: '128GB', color: null }), 'modelo')).toBe('iPhone 13 128GB')
    expect(textoCeldaPendiente(resumen({ modelo: '13' }), 'modelo')).toBe('iPhone 13')
    expect(textoCeldaPendiente(resumen({ modelo: null, capacidad: '128GB', color: 'Azul' }), 'modelo')).toBe('')
  })
})
