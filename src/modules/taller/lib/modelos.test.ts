import { describe, expect, it } from 'vitest'
import { agrupados, componente } from '../test/fabrica'
import { MODELOS_ORDENADOS, extraerModelo, modelosDisponibles, traducirModelo } from './modelos'

describe('modelos (calco de MODELOS_ORDENADOS y traducirModelo)', () => {
  it('traduce numéricos con variante, especiales y aire', () => {
    expect(traducirModelo('12promax')).toBe('iPhone 12 Pro Max')
    expect(traducirModelo('14plus')).toBe('iPhone 14 Plus')
    expect(traducirModelo('13mini')).toBe('iPhone 13 Mini')
    expect(traducirModelo('16e')).toBe('iPhone 16e')
    expect(traducirModelo('15')).toBe('iPhone 15')
    expect(traducirModelo('se2020')).toBe('iPhone SE 2020')
    expect(traducirModelo('xsmax')).toBe('iPhone XS Max')
    expect(traducirModelo('6splus')).toBe('iPhone 6S Plus')
    expect(traducirModelo('air')).toBe('iPhone Air')
    expect(traducirModelo('')).toBe('')
    expect(traducirModelo(null)).toBe('')
  })
  it('el catálogo va en orden de tienda y empieza y acaba como el JavaFX', () => {
    expect(MODELOS_ORDENADOS[0]).toBe('6s')
    expect(MODELOS_ORDENADOS.at(-1)).toBe('17promax')
    expect(MODELOS_ORDENADOS).toHaveLength(39)
    expect(new Set(MODELOS_ORDENADOS).size).toBe(MODELOS_ORDENADOS.length)
  })
})

describe('extraerModelo (modelo de un SKU)', () => {
  it('gana el código más largo que sea prefijo del resto', () => {
    expect(extraerModelo('bati13promaxneg', 'bat')).toBe('13promax')
    expect(extraerModelo('bati13pro', 'bat')).toBe('13pro')
    expect(extraerModelo('bati13', 'bat')).toBe('13')
    expect(extraerModelo('lcdixsmaxnegra', 'lcd')).toBe('xsmax')
    expect(extraerModelo('lcdixsnegra', 'lcd')).toBe('xs')
    expect(extraerModelo('lcdi6splus', 'lcd')).toBe('6splus')
    expect(extraerModelo('bati16e', 'bat')).toBe('16e')
  })
  it('quita el prefijo del tipo y la "i" inicial, y no distingue mayúsculas', () => {
    expect(extraerModelo('BATI14PLUS', 'bat')).toBe('14plus')
    expect(extraerModelo('chai13negro', 'cha')).toBe('13')
    expect(extraerModelo('cami13', 'cam')).toBe('13')
    expect(extraerModelo('batise2020', 'bat')).toBe('se2020')
    expect(extraerModelo('batair', 'bat')).toBe('air')
  })
  it('el prefijo "g" no se confunde con el resto del SKU', () => {
    expect(extraerModelo('gi13', 'g')).toBe('13')
    expect(extraerModelo('gi14promaxnegra', 'g')).toBe('14promax')
    expect(extraerModelo('mci13', 'mc')).toBe('13')
  })
  it('los componentes "otro" llevan el modelo igual que los demás', () => {
    expect(extraerModelo('otroi13', 'otro')).toBe('13')
    expect(extraerModelo('otroi14', 'otro')).toBe('14')
  })
  it('sin coincidencia devuelve null', () => {
    expect(extraerModelo('batuniversal', 'bat')).toBeNull()
    expect(extraerModelo('bat', 'bat')).toBeNull()
    expect(extraerModelo('', 'bat')).toBeNull()
  })
})

describe('modelosDisponibles (opciones del combo de modelo)', () => {
  const a = agrupados()
  it('salen en el orden de MODELOS_ORDENADOS y solo de SKU activos', () => {
    const grupos = ['bat', 'cha', 'lcd', 'cam'].map((prefijo) => ({ prefijo, skus: a[prefijo] }))
    // bati12 está inactivo: el 12 no aparece; 13promax va después de 13 y antes de 14, como en la lista
    expect(modelosDisponibles(grupos)).toEqual(['13', '13promax', '14'])
  })
  it('solo mira los grupos que recibe (quien llama decide que "otro" no aporta)', () => {
    expect(modelosDisponibles([{ prefijo: 'cam', skus: a.cam }])).toEqual(['13'])
    expect(modelosDisponibles([{ prefijo: 'g', skus: a.g }, { prefijo: 'mc', skus: a.mc }])).toEqual(['13', '14'])
    expect(modelosDisponibles([])).toEqual([])
  })
  it('un SKU sin modelo reconocible no aporta nada y los repetidos salen una vez', () => {
    const skus = [componente({ idCom: 1, tipo: 'batuniversal' }), componente({ idCom: 2, tipo: 'bati15' }), componente({ idCom: 3, tipo: 'bati15negra' })]
    expect(modelosDisponibles([{ prefijo: 'bat', skus }])).toEqual(['15'])
  })
  it('el resultado son siempre códigos de MODELOS_ORDENADOS', () => {
    const grupos = Object.keys(a).map((prefijo) => ({ prefijo, skus: a[prefijo] }))
    for (const m of modelosDisponibles(grupos)) expect(MODELOS_ORDENADOS).toContain(m)
  })
})
