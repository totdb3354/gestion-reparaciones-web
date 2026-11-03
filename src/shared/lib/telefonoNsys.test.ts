import { describe, expect, it } from 'vitest'
import { cuandoItems, clasesUbicacion, descripcionMovil, diaNsys, diasDesdeNsys, textoGrado, nombreModeloNsys, textoEstadoMovil, textoPoner, COMPRUEBALO, ETIQUETA_AVISO, queHacerAviso, textoAvisoTaller, textoBateriaEnCorregir, textoBateriaRecordada, conEsim, nombreMovilNsys, SIN_MODELO_MAESTRO } from './telefonoNsys'

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
  it('0.9.23: cuándo es un Items: «hoy 13:40» o «del 02/11 22:10», con el día de Madrid', () => {
    const ahora = new Date('2026-11-03T12:00:00Z') // las 13:00 en Madrid
    expect(cuandoItems('2026-11-03T13:40:00', ahora)).toBe('hoy 13:40')
    expect(cuandoItems('2026-11-02T22:10:00', ahora)).toBe('del 02/11 22:10')
    // Las 23:30 UTC del 2 son ya el 3 en Madrid: un Items de las 00:10 del 3 es de hoy.
    expect(cuandoItems('2026-11-03T00:10:00', new Date('2026-11-02T23:30:00Z'))).toBe('hoy 00:10')
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
      .toBe('Taller: el grado (ID) aún no se puede calcular: se resuelve solo cuando el móvil tenga grado (reparación R20261021_3 · Técnico 2 · batería bati13 nueva)')
    expect(textoAvisoTaller({ ...base, tipo: 'SIN_DESHACER', causa: 'BORRADA', dato: 'COLOR', de: 'Rojo' }))
      .toBe('Se borró la reparación R20261021_3 que cambió el color; corrígelo a mano si hace falta (Técnico 2)')
    expect(ETIQUETA_AVISO).toEqual({ SIN_COLOR: 'Color sin deducir', SIN_GRADO: 'Grado sin calcular', SIN_DESHACER: 'No se pudo deshacer' })
    expect(queHacerAviso('SIN_COLOR', 'COLOR')).toBe('Mira de qué color quedó y corrígelo en su ficha')
    expect(queHacerAviso('SIN_GRADO', 'GRADO')).toBe('Decide el grado que le toca y corrígelo en su ficha')
    expect(queHacerAviso('SIN_DESHACER', 'COLOR')).toBe('Mira si el móvil tiene de verdad ese color; si no, corrígelo en su ficha')
    expect(queHacerAviso('SIN_DESHACER', 'GRADO')).toBe('Mira si el móvil tiene de verdad ese grado; si no, corrígelo en su ficha')
  })
})

describe('batería recordada (0.9.22 pieza 4)', () => {
  it('en la fila «Sin grado en NSYS» y en «Corregir…»', () => {
    expect(textoBateriaRecordada(true, '2026-10-26T17:28:49', 'R20261026_205')).toBe('Batería nueva del 26/10 (R20261026_205)')
    expect(textoBateriaRecordada(false, '2026-10-26T17:28:49', 'R20261026_205')).toBe('Batería reutilizada del 26/10 (R20261026_205)')
    expect(textoBateriaEnCorregir(true, '2026-10-26T17:28:49', 'R20261026_205'))
      .toBe('Lleva batería nueva del 26/10 (R20261026_205): si quieres el 100, escríbelo')
    expect(textoBateriaEnCorregir(false, '2026-10-26T17:28:49', 'R20261026_205'))
      .toBe('Lleva batería reutilizada del 26/10 (R20261026_205): sin el 100')
  })
})

describe('la eSIM detrás del modelo (0.9.24, spec «La descripción del móvil dice si es eSIM» §2.1)', () => {
  it('conEsim: «eSIM» detrás del nombre si lo es; sin nombre o «Sin modelo en el maestro», tal cual', () => {
    expect(conEsim('iPhone 14', true)).toBe('iPhone 14 eSIM')
    expect(conEsim('iPhone 14', false)).toBe('iPhone 14')
    expect(conEsim('iPhone 14', undefined)).toBe('iPhone 14')
    expect(conEsim('', true)).toBe('')
    expect(conEsim(SIN_MODELO_MAESTRO, true)).toBe('Sin modelo en el maestro')
  })

  it('nombreMovilNsys: el nombre del espejo con su eSIM; con la capacidad detrás en descripcionMovil', () => {
    expect(nombreMovilNsys({ modelo: '14', modeloMaestro: '14', esEsim: true })).toBe('iPhone 14 eSIM')
    expect(nombreMovilNsys({ modelo: null, modeloMaestro: '17e', esEsim: true })).toBe('iPhone 17e eSIM')
    expect(nombreMovilNsys({ modelo: null, modeloMaestro: null, esEsim: true })).toBe('Sin modelo en el maestro')
    expect(nombreMovilNsys({ modelo: '13pro', modeloMaestro: '13 PRO', esEsim: false })).toBe('iPhone 13 Pro')
    expect(nombreMovilNsys({ modelo: '13pro', modeloMaestro: '13 PRO' })).toBe('iPhone 13 Pro')
    expect(descripcionMovil(nombreMovilNsys({ modelo: '14', modeloMaestro: '14', esEsim: true }), '256GB')).toBe('iPhone 14 eSIM 256GB')
  })

  it('si el nombre ya dice eSIM (texto del maestro), no se repite', () => {
    expect(conEsim('iPhone 17 e eSIM', true)).toBe('iPhone 17 e eSIM')
    expect(nombreMovilNsys({ modelo: null, modeloMaestro: '17 e eSIM', esEsim: true })).toBe('iPhone 17 e eSIM')
    expect(descripcionMovil(nombreMovilNsys({ modelo: null, modeloMaestro: '17 e eSIM', esEsim: true }), '256GB')).toBe('iPhone 17 e eSIM 256GB')
  })
})
