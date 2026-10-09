import { describe, expect, it } from 'vitest'
import type { Componente } from '@/shared/api/client'
import { componente } from '../test/fabrica'
import type { FilaEstado } from './estado'
import { TEXTO_SIN_COLOR, opcionesSku } from './opcionesSku'

const sku = (idCom: number, tipo: string, stock = 9999): Componente => componente({ idCom, tipo, stock, stockMinimo: 2 })
const filaDe = (prefijo: string, opciones: Componente[]) => ({ prefijo, opciones }) as FilaEstado

describe('opcionesSku (combo de SKU de cada fila)', () => {
  it('filas sin color: como siempre (SKU tal cual y clase de stock)', () => {
    expect(opcionesSku(filaDe('bat', [sku(1, 'bati16', 0)]), new Set())).toEqual([{ valor: '1', etiqueta: 'bati16', clase: 'text-rojo-sin-stock' }])
  })
  it('chasis: SIM y luego eSIM, cada bloque por nombre; nombre en la lista, SKU en el botón y en el title', () => {
    const fila = filaDe('cha', [sku(1, 'chai16teal'), sku(2, 'chai16tealesim'), sku(3, 'chai16black'), sku(4, 'chai16blackesim')])
    const opciones = opcionesSku(fila, new Set([1, 2]))
    expect(opciones.map((o) => [o.grupo, o.etiqueta, o.etiquetaBoton, o.resaltada])).toEqual([
      ['SIM', 'Black', 'chai16black', false], ['SIM', 'Teal', 'chai16teal', true],
      ['eSIM', 'Black', 'chai16blackesim', false], ['eSIM', 'Teal', 'chai16tealesim', true],
    ])
    expect(opciones[0]).toMatchObject({ titulo: 'chai16black', color: '#3C3C3E' })
  })
  it('chasis solo SIM: sin bloques', () => {
    const opciones = opcionesSku(filaDe('cha', [sku(1, 'chai13midnight'), sku(2, 'chai13blue')]), new Set())
    expect(opciones.map((o) => [o.grupo, o.etiqueta])).toEqual([[undefined, 'Blue'], [undefined, 'Midnight']])
  })
  it('tapa: sin bloques; color desconocido con tono null', () => {
    const opciones = opcionesSku(filaDe('tapa', [sku(1, 'tapai16teal'), sku(2, 'tapai16fucsia')]), new Set())
    expect(opciones.map((o) => [o.grupo, o.etiqueta, o.color])).toEqual([[undefined, 'fucsia', null], [undefined, 'Teal', '#B0D4D2']])
  })
  it('texto vacío de chasis y tapa', () => {
    expect(TEXTO_SIN_COLOR).toBe('— Elige color —')
  })
})
