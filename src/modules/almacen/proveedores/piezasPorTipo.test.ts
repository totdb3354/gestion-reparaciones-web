import { describe, expect, it } from 'vitest'
import { cuerpoGuardar, estadoInicial, fijarVendidos, marcarTipo, textoBoton, textoRecuento, textoSinModelos, vendidos, type TipoPiezas } from './piezasPorTipo'

const BAT: TipoPiezas = { prefijo: 'bat', vende: true, modelos: ['12', '13', '14'], excluidos: [] }
const G: TipoPiezas = { prefijo: 'g', vende: true, modelos: ['12', '12mini', '13', '13mini'], excluidos: ['12mini', '13mini'] }
const LCD: TipoPiezas = { prefijo: 'lcd', vende: false, modelos: ['13', '14'], excluidos: [] }
const TIPOS = [BAT, G, LCD]

describe('piezasPorTipo (spec 2026-10-12 §5.1)', () => {
  it('el estado inicial tiene solo los tipos que vende, con sus excluidos', () => {
    const e = estadoInicial(TIPOS)
    expect([...e.keys()]).toEqual(['bat', 'g'])
    expect([...(e.get('g') ?? [])]).toEqual(['12mini', '13mini'])
    expect(textoRecuento(e, TIPOS.length)).toBe('Vende 2 de 3 tipos')
  })

  it('marcar un tipo empieza con todos los modelos; desmarcarlo lo quita', () => {
    const e = marcarTipo(estadoInicial(TIPOS), 'lcd', true)
    expect(textoBoton(LCD, e.get('lcd'))).toBe('Todos los modelos')
    expect(marcarTipo(e, 'lcd', false).has('lcd')).toBe(false)
  })

  it('textos del botón y de los que faltan', () => {
    const e = estadoInicial(TIPOS)
    expect(textoBoton(BAT, e.get('bat'))).toBe('Todos los modelos')
    expect(textoBoton(G, e.get('g'))).toBe('Seleccionados 2 de 4')
    expect(textoBoton(LCD, e.get('lcd'))).toBe('No lo vende')
    expect(textoSinModelos(G, e.get('g'))).toBe('Sin iPhone 12 Mini · iPhone 13 Mini')
    expect(textoSinModelos(BAT, e.get('bat'))).toBe('')
    expect(textoSinModelos(LCD, undefined)).toBe('')
  })

  it('los marcados del desplegable son los no excluidos; sin el tipo, ninguno', () => {
    const e = estadoInicial(TIPOS)
    expect([...vendidos(G, e.get('g'))]).toEqual(['12', '13'])
    expect([...vendidos(LCD, undefined)]).toEqual([])
  })

  it('fijar los vendidos excluye el resto; todos marcados = sin excepciones; ninguno = el tipo fuera', () => {
    const e = estadoInicial(TIPOS)
    const uno = fijarVendidos(e, BAT, new Set(['12', '14']))
    expect([...(uno.get('bat') ?? [])]).toEqual(['13'])
    expect(fijarVendidos(uno, BAT, new Set(BAT.modelos)).get('bat')?.size).toBe(0)
    expect(fijarVendidos(uno, BAT, new Set()).has('bat')).toBe(false)
  })

  it('el cuerpo va en el orden del servidor, con los excluidos en el orden de los modelos', () => {
    const e = fijarVendidos(marcarTipo(estadoInicial(TIPOS), 'lcd', true), G, new Set(['12']))
    expect(cuerpoGuardar(TIPOS, e)).toEqual({ tipos: [
      { prefijo: 'bat', excluidos: [] },
      { prefijo: 'g', excluidos: ['12mini', '13', '13mini'] },
      { prefijo: 'lcd', excluidos: [] },
    ] })
  })
})
