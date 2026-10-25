import { describe, expect, it } from 'vitest'
import { clasesUbicacion, descripcionMovil, diaNsys, diasDesdeNsys, textoGrado, nombreModeloNsys, textoEstadoMovil, textoPoner, COMPRUEBALO, ETIQUETA_AVISO, queHacerAviso, textoAvisoTaller } from './telefonoNsys'

describe('piezas compartidas del espejo de NSYS', () => {
  it('nombre del modelo: el código del ERP, si no el del maestro y si no un aviso', () => {
    expect(nombreModeloNsys('13pro', '13 PRO')).toBe('iPhone 13 Pro')
    expect(nombreModeloNsys(null, 'SE2022')).toBe('iPhone SE2022')
    expect(nombreModeloNsys(null, null)).toBe('Sin modelo en el maestro')
  })

  it('colores de las ubicaciones; las desconocidas en gris', () => {
    expect(clasesUbicacion('Listos')).toBe('bg-fila-recibido-bg text-fila-recibido-brd')
    expect(clasesUbicacion('Taller · Glass')).toBe('bg-tipo-glass-bg text-tipo-glass-text')
    expect(clasesUbicacion('Caja nueva')).toBe('bg-badge-neutro-bg text-azul-gris')
    expect(clasesUbicacion(null)).toBe('bg-badge-neutro-bg text-azul-gris')
  })

  it('texto del estado del móvil', () => {
    expect(['STOCK', 'DE_PEDIDO', 'NO_CUENTA', 'VENDIDO', 'BAJA'].map(textoEstadoMovil))
      .toEqual(['Libre', 'De pedido', 'No cuenta como stock', 'Vendido', 'Baja en NSYS'])
  })

  it('día de NSYS en dd/mm/aaaa, con o sin hora detrás', () => {
    expect(diaNsys('2023-05-02')).toBe('02/05/2023')
    expect(diaNsys('2026-09-12T13:01:00')).toBe('12/09/2026')
  })
})

describe('textoGrado', () => {
  it('el 100 del final es batería nueva; sin grado, raya', () => {
    expect(textoGrado('A100')).toBe('A · batería nueva')
    expect(textoGrado('A-100')).toBe('A- · batería nueva')
    expect(textoGrado('C')).toBe('C')
    expect(textoGrado('n/a')).toBe('n/a')
    expect(textoGrado('')).toBe('—')
    expect(textoGrado(null)).toBe('—')
    expect(textoGrado(undefined)).toBe('—')
  })

  it('días desde un día de NSYS, con el día de hoy en Madrid', () => {
    const ahora = new Date('2026-10-16T22:30:00Z') // 17/10 00:30 en Madrid
    expect(diasDesdeNsys('2026-10-16', ahora)).toBe(1)
    expect(diasDesdeNsys('2026-10-17', ahora)).toBe(0)
    expect(diasDesdeNsys('2026-10-20', ahora)).toBe(0)
    expect(diasDesdeNsys('2026-09-17', ahora)).toBe(30)
  })
})

describe('lo que hay que poner en NSYS (0.9.21)', () => {
  it('producto y grado; sin producto, buscarlo a mano', () => {
    expect(textoPoner('Apple iPhone 13 128GB Blue', 'A100')).toBe('Apple iPhone 13 128GB Blue · grado A100')
    expect(textoPoner(null, 'B')).toBe('(ningún móvil de ese color en NSYS: búscalo a mano) · grado B')
    expect(textoPoner('Apple iPhone 13 128GB Blue', null)).toBe('Apple iPhone 13 128GB Blue · grado —')
  })
})

describe('descripcionMovil (0.9.21, spec «Descripción completa donde pone «Modelo»» §2.1)', () => {
  it('nombre, capacidad y color con un espacio, sin los que falten', () => {
    expect(descripcionMovil('iPhone 13', '128GB', 'Azul')).toBe('iPhone 13 128GB Azul')
    expect(descripcionMovil('iPhone 13', '128GB', null)).toBe('iPhone 13 128GB')
    expect(descripcionMovil('iPhone 13', null, 'Azul')).toBe('iPhone 13 Azul')
    expect(descripcionMovil('iPhone 13', '128GB')).toBe('iPhone 13 128GB')
    expect(descripcionMovil('iPhone 13', '', '')).toBe('iPhone 13')
    expect(descripcionMovil('iPhone 13')).toBe('iPhone 13')
  })

  it('sin nombre, nada: una lista del taller sin modelo dice lo de hoy aunque NSYS sepa la capacidad', () => {
    expect(descripcionMovil('', '128GB', 'Azul')).toBe('')
    expect(descripcionMovil(null, '128GB', 'Azul')).toBe('')
    expect(descripcionMovil(undefined)).toBe('')
  })

  it('las copias de «modelo capacidad» de NSYS enseñan lo mismo que antes', () => {
    expect(descripcionMovil(nombreModeloNsys('13pro', '13 PRO'), '256GB')).toBe('iPhone 13 Pro 256GB')
    expect(descripcionMovil(nombreModeloNsys(null, 'SE2022'), null)).toBe('iPhone SE2022')
    expect(descripcionMovil(nombreModeloNsys(null, null), null)).toBe('Sin modelo en el maestro')
  })

  it('lo que hay que poner en NSYS con «compruébalo» si sale del maestro tal cual (0.9.22, paso 4)', () => {
    expect(textoPoner('Apple iPhone 13 128GB Pink', 'B', true))
      .toBe('Apple iPhone 13 128GB Pink (compruébalo: NSYS nunca ha escrito ese color) · grado B')
    expect(textoPoner('Apple iPhone 13 128GB Pink', 'B', false)).toBe('Apple iPhone 13 128GB Pink · grado B')
    expect(textoPoner(null, 'B', true)).toBe('(ningún móvil de ese color en NSYS: búscalo a mano) · grado B')
    expect(COMPRUEBALO).toBe('compruébalo: NSYS nunca ha escrito ese color')
  })

  it('los avisos del taller como los cuenta el rastro, su etiqueta y qué hacer (0.9.22 §3.5)', () => {
    const base = { causa: null, idRep: 'R20261021_3', usuario: 'Técnico 2', motivo: null }
    expect(textoAvisoTaller({ ...base, tipo: 'SIN_COLOR', dato: 'COLOR', de: 'chai13xxx' }))
      .toBe('Taller: el color del chasis chai13xxx no se puede deducir: lo corregirá un supertécnico (reparación R20261021_3 · Técnico 2)')
    expect(textoAvisoTaller({ ...base, tipo: 'SIN_COLOR', dato: 'COLOR', de: 'tapai13xxx' })).toContain('el color de la tapa tapai13xxx')
    expect(textoAvisoTaller({ ...base, tipo: 'SIN_GRADO', dato: 'GRADO', de: 'ID', motivo: 'batería bati13 nueva' }))
      .toBe('Taller: el grado (ID) no se puede calcular: lo corregirá un supertécnico (reparación R20261021_3 · Técnico 2 · batería bati13 nueva)')
    expect(textoAvisoTaller({ ...base, tipo: 'SIN_DESHACER', causa: 'BORRADA', dato: 'COLOR', de: 'Rojo' }))
      .toBe('Se borró la reparación R20261021_3 que cambió el color; corrígelo a mano si hace falta (Técnico 2)')
    expect(ETIQUETA_AVISO).toEqual({ SIN_COLOR: 'Color sin deducir', SIN_GRADO: 'Grado sin calcular', SIN_DESHACER: 'No se pudo deshacer' })
    expect(queHacerAviso('SIN_COLOR', 'COLOR')).toBe('Mira de qué color quedó y corrígelo en su ficha')
    expect(queHacerAviso('SIN_GRADO', 'GRADO')).toBe('Decide el grado que le toca y corrígelo en su ficha')
    expect(queHacerAviso('SIN_DESHACER', 'COLOR')).toBe('Mira si el móvil tiene de verdad ese color; si no, corrígelo en su ficha')
    expect(queHacerAviso('SIN_DESHACER', 'GRADO')).toBe('Mira si el móvil tiene de verdad ese grado; si no, corrígelo en su ficha')
  })
})
