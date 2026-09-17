import { describe, expect, it } from 'vitest'
import { categoriaPieza } from './piezas'

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
