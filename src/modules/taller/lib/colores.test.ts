import { describe, expect, it } from 'vitest'
import { PREFIJOS_CON_COLOR, PREFIJO_CHASIS, PREFIJO_TAPA, colorDeSku, leerSku, mismoColor } from './colores'

describe('leerSku (modelo, eSIM y token de color)', () => {
  it('chasis con eSIM, tapa sin ella', () => {
    expect(leerSku('chai16ultramarineesim', 'cha')).toEqual({ modelo: '16', esim: true, token: 'ultramarine' })
    expect(leerSku('tapai16ultramarine', 'tapa')).toEqual({ modelo: '16', esim: false, token: 'ultramarine' })
  })
  it('gana el modelo más largo y respeta las variantes', () => {
    expect(leerSku('chai16eblackesim', 'cha')).toEqual({ modelo: '16e', esim: true, token: 'black' })
    expect(leerSku('chai17promaxcosmicorange', 'cha')).toEqual({ modelo: '17promax', esim: false, token: 'cosmicorange' })
    expect(leerSku('chaiaircloudwhite', 'cha')).toEqual({ modelo: 'air', esim: false, token: 'cloudwhite' })
    expect(leerSku('tapai15problacktitanium', 'tapa')).toEqual({ modelo: '15pro', esim: false, token: 'blacktitanium' })
  })
})

describe('colorDeSku (nombre oficial y tono)', () => {
  it('nombre oficial legible', () => {
    expect(colorDeSku('chai16ultramarine', 'cha').nombre).toBe('Ultramarine')
    expect(colorDeSku('chai15problacktitanium', 'cha').nombre).toBe('Black Titanium')
    expect(colorDeSku('chaiaircloudwhite', 'cha').nombre).toBe('Cloud White')
    expect(colorDeSku('chai12red', 'cha').nombre).toBe('(PRODUCT)RED')
  })
  it('tono propio por modelo cuando Apple repite el nombre con otro tono; si no, el tono base', () => {
    expect(colorDeSku('chai15blue', 'cha').tono).toBe('#D3E0EA')
    expect(colorDeSku('chai12blue', 'cha').tono).toBe('#11416B')
    expect(colorDeSku('chai12problue', 'cha').tono).toBe('#2C5A84')
  })
  it('un color que no está en la tabla: el token como nombre y sin tono', () => {
    expect(colorDeSku('chai16fucsia', 'cha')).toMatchObject({ nombre: 'fucsia', tono: null, modelo: '16' })
  })
  it('conoce todos los colores de los modelos activos (series 12 a 17)', () => {
    const tokens = [
      'black', 'white', 'red', 'blue', 'green', 'purple', 'pink', 'yellow', 'midnight', 'starlight', 'gold', 'graphite',
      'silver', 'pacificblue', 'sierrablue', 'alpinegreen', 'deeppurple', 'spaceblack', 'blacktitanium', 'bluetitanium',
      'naturaltitanium', 'whitetitanium', 'deserttitanium', 'teal', 'ultramarine', 'sage', 'mistblue', 'lavender',
      'cloudwhite', 'lightgold', 'skyblue', 'deepblue', 'cosmicorange',
    ]
    for (const t of tokens) expect(colorDeSku(`chai16${t}`, 'cha').tono, t).not.toBeNull()
  })
})

describe('mismoColor y constantes', () => {
  it('mismo modelo y mismo token, sin mirar SIM/eSIM', () => {
    expect(mismoColor(leerSku('chai16tealesim', 'cha'), leerSku('tapai16teal', 'tapa'))).toBe(true)
    expect(mismoColor(leerSku('chai16teal', 'cha'), leerSku('tapai16plusteal', 'tapa'))).toBe(false)
    expect(mismoColor(leerSku('chai16teal', 'cha'), leerSku('tapai16pink', 'tapa'))).toBe(false)
  })
  it('prefijos con color', () => {
    expect(PREFIJO_CHASIS).toBe('cha')
    expect(PREFIJO_TAPA).toBe('tapa')
    expect(PREFIJOS_CON_COLOR).toEqual(['cha', 'tapa'])
  })
})
