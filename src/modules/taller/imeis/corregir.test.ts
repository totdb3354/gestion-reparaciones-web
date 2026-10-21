import { describe, expect, it } from 'vitest'
import { fichaMovil, opcionesTaller } from '../test/fabrica'
import { eleccionInicial, escribirGrado, gradoCompleto, leerGrado, ordenColores, previa } from './corregir'

describe('reglas del diálogo «Corregir…» (spec 0.9.21 §2.3)', () => {
  it('el grado: leer el que vale y escribirlo como en NSYS', () => {
    expect(leerGrado('MsA-', true)).toEqual({ letra: 'A-', ms: true, bateria: true })
    expect(leerGrado('B', false)).toEqual({ letra: 'B', ms: false, bateria: false })
    expect(leerGrado('ID', false)).toEqual({ letra: '', ms: false, bateria: false })
    expect(leerGrado('n/a', true)).toEqual({ letra: '', ms: false, bateria: true })
    expect(escribirGrado({ letra: 'A', ms: false, bateria: true })).toBe('A100')
    expect(escribirGrado({ letra: 'A-', ms: true, bateria: false })).toBe('MsA-')
    expect(escribirGrado({ letra: '', ms: true, bateria: true })).toBeNull()
    expect(gradoCompleto('A', true)).toBe('A100')
    expect(gradoCompleto('B', false)).toBe('B')
  })

  it('los colores: el que vale primero y después los del maestro', () => {
    expect(ordenColores(opcionesTaller(), 'Rosa')).toEqual(['Rosa', 'Negro'])
    expect(ordenColores(opcionesTaller(), 'Verde')).toEqual(['Verde', 'Negro', 'Rosa'])
    expect(ordenColores(null, 'Negro')).toEqual(['Negro'])
  })

  it('sin cambios, nada que mandar', () => {
    const f = fichaMovil()
    expect(previa(f, eleccionInicial(f), opcionesTaller()))
      .toMatchObject({ cambiaColor: false, cambiaGrado: false, valido: false, cuerpo: { color: null, grado: null } })
  })

  it('cambiar el grado: el SKU del maestro y el producto de ahora', () => {
    const f = fichaMovil({ grado: 'B', bateriaNueva: false, sku: 'i16128NegroB' })
    const p = previa(f, { color: 'Negro', grado: { letra: 'A', ms: false, bateria: true }, motivo: ' batería ' }, opcionesTaller())
    expect(p).toMatchObject({ cambiaGrado: true, gradoAntes: 'B', gradoFinal: 'A100', sku: 'i16128NegroA100',
      producto: 'Apple iPhone 16 128GB Black', coincideConNsys: false, valido: true, cuerpo: { color: null, grado: 'A100' } })
  })

  it('cambiar el color: su producto o ninguno, y sin SKU si el maestro no lo tiene', () => {
    const f = fichaMovil()
    expect(previa(f, { ...eleccionInicial(f), color: 'Rosa' }, opcionesTaller())).toMatchObject({ cambiaColor: true,
      colorFinal: 'Rosa', sku: 'i16128RosaA100', producto: 'Apple iPhone 16 128GB Pink', valido: false })
    const verde = previa(f, { ...eleccionInicial(f), color: 'Verde', motivo: 'chasis verde' },
      opcionesTaller({ colores: [{ color: 'Verde', producto: null }] }))
    expect(verde).toMatchObject({ sku: null, producto: null, valido: true, cuerpo: { color: 'Verde', grado: null } })
  })

  it('elegir lo que dice NSYS: coincide y se quita lo del taller', () => {
    const f = fichaMovil({ color: 'Rosa', colorNsys: 'Negro', porPasar: true })
    expect(previa(f, { ...eleccionInicial(f), color: 'Negro' }, opcionesTaller()).coincideConNsys).toBe(true)
  })

  it('un grado que no es de NSYS no cambia solo por las casillas', () => {
    const f = fichaMovil({ grado: 'ID', bateriaNueva: false })
    expect(previa(f, { color: 'Negro', grado: { letra: '', ms: true, bateria: true }, motivo: 'x' }, opcionesTaller()).cambiaGrado).toBe(false)
  })
})
