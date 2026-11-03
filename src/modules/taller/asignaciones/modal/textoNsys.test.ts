import { describe, expect, it } from 'vitest'
import { textoAyudaNoNsys, textoLineaNoNsys } from './textoNsys'

const AHORA = new Date('2026-11-03T12:00:00Z') // las 13:00 en Madrid

describe('0.9.23: textos de «no está en NSYS»', () => {
  it('la línea del detalle, con la hora del último Items o sin ella', () => {
    expect(textoLineaNoNsys('2026-11-03T13:40:00', AHORA)).toBe('No está en NSYS · último Items: hoy 13:40')
    expect(textoLineaNoNsys('2026-11-02T22:10:00', AHORA)).toBe('No está en NSYS · último Items: del 02/11 22:10')
    expect(textoLineaNoNsys(null, AHORA)).toBe('No está en NSYS')
  })

  it('la ayuda al pasar el ratón', () => {
    expect(textoAyudaNoNsys('2026-11-03T13:40:00', AHORA))
      .toBe('NSYS no tiene este IMEI en ningún lote del último Items (hoy 13:40). Al guardar saldrá en «No está en NSYS».')
    expect(textoAyudaNoNsys(undefined, AHORA))
      .toBe('NSYS no tiene este IMEI en ningún lote del último Items. Al guardar saldrá en «No está en NSYS».')
  })
})
