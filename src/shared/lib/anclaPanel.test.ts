import { describe, expect, it } from 'vitest'
import { ANCLA_DE_FABRICA, anclaAlSoltar, anclaValida, dentroDelHueco, estiloAnclado, huecoVentana, type Hueco } from './anclaPanel'

/** La pantalla del prototipo: 1280 × 680 con la barra azul de 64 px. */
const HUECO: Hueco = { ancho: 1280, alto: 680, arriba: 64 }

describe('anclaAlSoltar', () => {
  it('abajo a la derecha: distancias a los bordes derecho e inferior', () => {
    expect(anclaAlSoltar({ izq: 924, arriba: 234, ancho: 340, alto: 430 }, HUECO)).toEqual({ esq: 'br', x: 16, y: 16 })
  })

  it('arriba a la izquierda: la distancia de arriba se mide desde la barra azul', () => {
    expect(anclaAlSoltar({ izq: 20, arriba: 100, ancho: 220, alto: 34 }, HUECO)).toEqual({ esq: 'tl', x: 20, y: 36 })
  })

  it('decide por el centro de la caja, no por su esquina', () => {
    // La esquina izquierda está en la mitad izquierda, pero el centro (520 + 170 = 690) cae a la derecha de 640.
    expect(anclaAlSoltar({ izq: 520, arriba: 80, ancho: 340, alto: 200 }, HUECO).esq).toBe('tr')
    // Mitad vertical: (64 + 680) / 2 = 372. Centro en 363 + 17 = 380 → abajo.
    expect(anclaAlSoltar({ izq: 10, arriba: 363, ancho: 220, alto: 34 }, HUECO).esq).toBe('bl')
  })

  it('redondea y nunca da distancias negativas', () => {
    expect(anclaAlSoltar({ izq: -3.6, arriba: 60, ancho: 220, alto: 34 }, HUECO)).toEqual({ esq: 'tl', x: 0, y: 0 })
  })
})

describe('estiloAnclado', () => {
  it('de fábrica: right y bottom a 16 px', () => {
    expect(estiloAnclado(ANCLA_DE_FABRICA, 340, 430, HUECO)).toEqual({ right: 16, bottom: 16 })
  })

  it('arriba: top suma el alto de la barra azul', () => {
    expect(estiloAnclado({ esq: 'tl', x: 20, y: 36 }, 220, 34, HUECO)).toEqual({ left: 20, top: 100 })
  })

  it('recorta para que quepa entera, sin tocar el ancla guardada', () => {
    const ancla = { esq: 'tl' as const, x: 1200, y: 500 }
    // Panel de 340 × 430: como mucho 1280 − 340 = 940 a la izquierda y 680 − 64 − 430 = 186 bajo la barra.
    expect(estiloAnclado(ancla, 340, 430, HUECO)).toEqual({ left: 940, top: 64 + 186 })
    // La pastilla, más pequeña, cabe más abajo: 680 − 64 − 34 = 582 ≥ 500.
    expect(estiloAnclado(ancla, 220, 34, HUECO)).toEqual({ left: 1060, top: 564 })
    expect(ancla).toEqual({ esq: 'tl', x: 1200, y: 500 })
  })

  it('con una ventana más pequeña que la caja, la pega al borde de su esquina', () => {
    expect(estiloAnclado({ esq: 'br', x: 300, y: 300 }, 340, 430, { ancho: 300, alto: 400, arriba: 64 })).toEqual({ right: 0, bottom: 0 })
  })
})

describe('dentroDelHueco', () => {
  it('no deja salir la caja de la ventana ni meterse bajo la barra azul', () => {
    expect(dentroDelHueco(-50, 10, 340, 430, HUECO)).toEqual({ izq: 0, arriba: 64 })
    expect(dentroDelHueco(1200, 600, 340, 430, HUECO)).toEqual({ izq: 940, arriba: 250 })
    expect(dentroDelHueco(300, 200, 340, 430, HUECO)).toEqual({ izq: 300, arriba: 200 })
  })
})

describe('anclaValida', () => {
  it('acepta un ancla bien formada', () => {
    expect(anclaValida({ esq: 'tl', x: 0, y: 12.5 })).toEqual({ esq: 'tl', x: 0, y: 12.5 })
  })

  it.each([
    null,
    'br',
    7,
    {},
    { esq: 'centro', x: 1, y: 1 },
    { esq: 'br', x: -1, y: 1 },
    { esq: 'br', x: 1, y: Number.NaN },
    { esq: 'br', x: Number.POSITIVE_INFINITY, y: 1 },
    { esq: 'br', x: '16', y: 16 },
  ])('rechaza %o', (v) => {
    expect(anclaValida(v)).toBeNull()
  })
})

describe('huecoVentana', () => {
  it('la ventana menos la barra azul (jsdom: 1024 × 768 por innerWidth/innerHeight)', () => {
    expect(huecoVentana()).toEqual({ ancho: 1024, alto: 768, arriba: 64 })
  })
})
