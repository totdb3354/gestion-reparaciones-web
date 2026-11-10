import { describe, expect, it } from 'vitest'
import { reiniciarStores } from '@/shared/lib/store'
import { visto } from '../test/fabrica'
import type { Movil } from './modelo'
import { buscarQueRevisar, estadoStockTelefonos, type EstadoQueRevisar } from './estado'
import { listaRevisar, listaSubir } from './queRevisar'

const P15 = { modelo: '15pro', modeloMaestro: '15 PRO', capacidad: '256GB', color: 'Titanio natural' }
const B11 = { modelo: '11', modeloMaestro: '11', capacidad: '64GB', color: 'Blanco' }
// Revisar: 15 Pro (101) y 13 128 Azul (104), con un pendiente cada uno (el 15 Pro, primero). Subir: 11 Blanco (106).
const STOCK: Movil[] = [
  visto({ imeiSn: '350000000000101', ...P15, grado: 'n/a' }),
  visto({ imeiSn: '350000000000104', grado: 'n/a' }),
  visto({ imeiSn: '350000000000106', ...B11, grado: 'B' }),
]
const LISTAS = { revisar: listaRevisar(STOCK), subir: listaSubir(STOCK) }
const INICIAL: EstadoQueRevisar = { tarjeta: 'revisar', elegido: { revisar: null, subir: null }, buscar: '', orden: { revisar: null, subir: null } }
const buscar = (qr: EstadoQueRevisar, texto: string) => buscarQueRevisar(qr, texto, LISTAS)

describe('estado de «Qué revisar» (spec 0.9.25 §10.14)', () => {
  it('al empezar no hay ningún modelo-color elegido en ninguna tarjeta, y reiniciarStores (cerrar sesión) lo deja así', () => {
    expect(estadoStockTelefonos.get().queRevisar).toEqual(INICIAL)
    estadoStockTelefonos.set((e) => ({ ...e, ordenMoviles: [{ id: 'dias', desc: true }], queRevisar: { tarjeta: 'subir', elegido: { revisar: 'iPhone 13|128GB|Azul', subir: 'iPhone 11|64GB|Blanco' }, buscar: '13', orden: { revisar: { columna: 'Color', desc: false }, subir: null } } }))
    reiniciarStores()
    expect(estadoStockTelefonos.get().queRevisar).toEqual(INICIAL)
    expect(estadoStockTelefonos.get().ordenMoviles).toEqual([])
  })

  it('al cambiar la búsqueda, un trozo de IMEI elige su modelo-color en la tarjeta en la que está; la otra no cambia', () => {
    expect(buscar(INICIAL, '000104')).toEqual({ ...INICIAL, buscar: '000104', elegido: { revisar: 'iPhone 13|128GB|Azul', subir: null } })
    expect(buscar(INICIAL, '000106')).toEqual({ ...INICIAL, buscar: '000106', elegido: { revisar: null, subir: 'iPhone 11|64GB|Blanco' } })
    const elegido = { revisar: 'iPhone 13|128GB|Azul', subir: 'iPhone 11|64GB|Blanco' }
    expect(buscar({ ...INICIAL, elegido }, '000101')).toEqual({ ...INICIAL, buscar: '000101', elegido: { ...elegido, revisar: 'iPhone 15 Pro|256GB|Titanio natural' } })
  })

  it('con varios modelos-color con ese IMEI, el primero de la lista', () => {
    expect(buscar(INICIAL, '35000000000010').elegido).toEqual({ revisar: 'iPhone 15 Pro|256GB|Titanio natural', subir: 'iPhone 11|64GB|Blanco' })
  })

  it('sin IMEI (palabras, menos de 6 cifras o un IMEI que no está) solo cambia lo escrito: lo elegido sigue', () => {
    const qr: EstadoQueRevisar = { ...INICIAL, tarjeta: 'subir', elegido: { revisar: 'iPhone 13|128GB|Azul', subir: null } }
    for (const texto of ['15 pro', '00010', '999999', '']) expect(buscar(qr, texto)).toEqual({ ...qr, buscar: texto })
  })

  it('un IMEI que la búsqueda deja fuera por otra palabra no elige: «15 000104» no deja el 13 Azul', () => {
    expect(buscar(INICIAL, '15 000104')).toEqual({ ...INICIAL, buscar: '15 000104' })
  })

  it('si las palabras no cambian (un espacio de más), no pisa lo elegido a mano con esa búsqueda', () => {
    const aMano: EstadoQueRevisar = { ...INICIAL, buscar: '35000000000010', elegido: { revisar: 'iPhone 13|128GB|Azul', subir: null } }
    expect(buscar(aMano, '35000000000010 ')).toEqual({ ...aMano, buscar: '35000000000010 ' })
    expect(buscar(aMano, '000101').elegido).toEqual({ revisar: 'iPhone 15 Pro|256GB|Titanio natural', subir: null })
  })
})
