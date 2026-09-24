import { describe, expect, it } from 'vitest'
import { agrupados, componente } from '../test/fabrica'
import { PREFIJOS_GLASS, PREFIJO_OTRO, categoriaPieza, claseStock, nivelStock, nombreTipo, prefijosDeFila } from './piezas'

describe('categoriaPieza (calco de Piezas.categoria)', () => {
  it('deriva la categoría del prefijo del SKU', () => {
    expect(categoriaPieza('gi12negra')).toBe('Glass')
    expect(categoriaPieza('lcdi12negraic')).toBe('Pantalla')
    expect(categoriaPieza('mci12negra')).toBe('Marco')
    expect(categoriaPieza('bati12')).toBe('Batería')
    expect(categoriaPieza('cami12')).toBe('Cámara')
    expect(categoriaPieza('chai12negro')).toBe('Chasis')
    expect(categoriaPieza('otroi8')).toBe('Otros')
  })
  it('vacía si nulo o desconocido', () => {
    expect(categoriaPieza(null)).toBe('')
    expect(categoriaPieza('xyz123')).toBe('')
  })
})

describe('nombreTipo (nombre de la fila del formulario)', () => {
  it('traduce los seis tipos conocidos', () => {
    expect(nombreTipo('bat')).toBe('Batería')
    expect(nombreTipo('cha')).toBe('Chasis')
    expect(nombreTipo('g')).toBe('Glass')
    expect(nombreTipo('cam')).toBe('Cámara')
    expect(nombreTipo('lcd')).toBe('Pantalla')
    expect(nombreTipo('mc')).toBe('Marco')
  })
  it('cualquier otro prefijo se muestra tal cual (a diferencia de categoriaPieza, que lo deja vacío)', () => {
    expect(nombreTipo('alt')).toBe('alt')
    expect(nombreTipo('otro')).toBe('otro')
    expect(categoriaPieza('alti13')).toBe('')
  })
})

describe('prefijosDeFila (una fila por tipo, en el orden del servidor)', () => {
  it('reparación: todos menos g, mc y otro', () => {
    expect(prefijosDeFila(agrupados(), false)).toEqual(['bat', 'cha', 'lcd', 'cam'])
  })
  it('glass: solo g y mc, en el orden del servidor', () => {
    expect(prefijosDeFila(agrupados(), true)).toEqual(['g', 'mc'])
    const invertido = { mc: agrupados().mc, bat: agrupados().bat, g: agrupados().g }
    expect(prefijosDeFila(invertido, true)).toEqual(['mc', 'g'])
  })
  it('salta los grupos vacíos', () => {
    const a = agrupados()
    a.cha = []
    a.mc = []
    expect(prefijosDeFila(a, false)).toEqual(['bat', 'lcd', 'cam'])
    expect(prefijosDeFila(a, true)).toEqual(['g'])
  })
  it('conserva un prefijo desconocido en su sitio', () => {
    const a = { bat: agrupados().bat, alt: [componente({ idCom: 171, tipo: 'alti13' })], g: agrupados().g, cam: agrupados().cam, otro: agrupados().otro }
    expect(prefijosDeFila(a, false)).toEqual(['bat', 'alt', 'cam'])
  })
  it('constantes', () => {
    expect(PREFIJO_OTRO).toBe('otro')
    expect(PREFIJOS_GLASS).toEqual(['g', 'mc'])
  })
})

describe('nivelStock y claseStock (color del SKU)', () => {
  it('stock 0 → sin stock, en rojo', () => {
    expect(nivelStock({ stock: 0, stockMinimo: 2 })).toBe('sinStock')
    expect(claseStock({ stock: 0, stockMinimo: 2 })).toBe('text-rojo-sin-stock')
  })
  it('0 < stock ≤ mínimo → bajo, en ámbar', () => {
    expect(nivelStock({ stock: 1, stockMinimo: 2 })).toBe('bajo')
    expect(nivelStock({ stock: 2, stockMinimo: 2 })).toBe('bajo')
    expect(claseStock({ stock: 2, stockMinimo: 2 })).toBe('text-fila-solicitud-brd')
  })
  it('por encima del mínimo → normal, sin clase', () => {
    expect(nivelStock({ stock: 3, stockMinimo: 2 })).toBe('normal')
    expect(claseStock({ stock: 3, stockMinimo: 2 })).toBe('')
  })
  it('con mínimo 0: stock 0 sigue siendo sin stock y cualquier unidad es normal', () => {
    expect(nivelStock({ stock: 0, stockMinimo: 0 })).toBe('sinStock')
    expect(nivelStock({ stock: 1, stockMinimo: 0 })).toBe('normal')
  })
  it('acepta un Componente entero', () => {
    expect(nivelStock(componente({ stock: 1, stockMinimo: 1 }))).toBe('bajo')
  })
  it('stock negativo → bajo, en ámbar (calco de estadoComponente / aplicarColorStock)', () => {
    expect(nivelStock({ stock: -1, stockMinimo: 0 })).toBe('bajo')
    expect(claseStock({ stock: -1, stockMinimo: 2 })).toBe('text-fila-solicitud-brd')
  })
})
