import { describe, expect, it } from 'vitest'
import { filaAlta, filaColor, filaGrado, filaPorPasar, filaRevisar, porQue, tarjetas } from '../test/fabrica'
import {
  AYUDA, avisoCopiado, avisoPlantillaAltas, avisoPlantillaColor, cuentas, EXPLICACION, horaDe, listaGrado, marcada, modeloDeFila,
  modeloDelTaller, NOMBRE, paraExcel, paraPlantillaColor, pendientes, textoDesde, textoEnNsys, textoNumero, textoPorQue,
  textoUltimoTrabajo, textoVolvio, totalPendientes, VACIA,
} from './porPasar'

describe('lista «Por pasar a NSYS» (spec 0.9.21 §2.4)', () => {
  it('por qué: a mano con quién y motivo; sin motivo, sin la última parte; la reparación de la pieza 2', () => {
    expect(textoPorQue(porQue({ dato: 'COLOR', usuario: 'Supertécnico 1', motivo: 'chasis rojo' }))).toBe('Color: a mano · Supertécnico 1 · «chasis rojo»')
    expect(textoPorQue(porQue({ motivo: null }))).toBe('Grado: a mano · Técnico 1')
    expect(textoPorQue(porQue({ origen: 'REPARACION', idRep: 'R20261020_4', usuario: 'Técnico 2', motivo: null })))
      .toBe('Grado: reparación R20261020_4 · Técnico 2')
  })

  it('el modelo, lo de NSYS hoy y desde cuándo', () => {
    const f = filaPorPasar()
    expect(modeloDeFila(f)).toBe('iPhone 13 128GB')
    expect(textoEnNsys(f)).toBe('Apple iPhone 13 128GB Blue · grado B')
    expect(textoDesde(f.desde)).toBe('20/10/2026 10:31')
  })

  it('para Excel: la cabecera y una línea por móvil, sin tabuladores dentro de las celdas', () => {
    const [cabecera, uno, dos] = paraExcel([
      filaPorPasar(),
      filaPorPasar({ imeiSn: '350000000000002', ponerProducto: null, sku: null, porQue: [porQue({ motivo: 'uno\tdos' })] }),
    ]).split('\n')
    expect(cabecera).toBe('IMEI\tModelo\tEn NSYS hoy\tPoner en NSYS\tSKU nuevo\tPor qué\tDesde')
    expect(uno).toBe('350000000000001\tiPhone 13 128GB\tApple iPhone 13 128GB Blue · grado B\tApple iPhone 13 128GB Blue · grado A100'
      + '\ti13128AzulA100\tGrado: a mano · Técnico 1 · «batería nueva»\t20/10/2026 10:31')
    expect(dos).toContain('(ningún móvil de ese color en NSYS: búscalo a mano) · grado A100\tsin SKU en el maestro\tGrado: a mano · Técnico 1 · «uno dos»')
  })

  it('por qué desde una reparación: la reparación, quién y la pieza, sin comillas (spec 0.9.21 pieza 2 §2.5)', () => {
    expect(textoPorQue(porQue({ dato: 'COLOR', origen: 'REPARACION', idRep: 'R20261021_3', usuario: 'Técnico 2', motivo: 'chasis chai13red nuevo' })))
      .toBe('Color: reparación R20261021_3 · Técnico 2 · chasis chai13red nuevo')
  })
})

const HECHO = { hechoPor: 'Supertécnico 1', hechoEn: '2026-10-25T12:31:00', hechoVolvio: null }

describe('«Por pasar a NSYS» con cuatro tarjetas (spec 0.9.22 §3)', () => {
  it('una fila marcada no cuenta; una que volvió, sí', () => {
    expect(marcada(filaColor(HECHO))).toBe(true)
    expect(marcada(filaColor({ ...HECHO, hechoVolvio: '2026-10-25T13:01:00' }))).toBe(false)
    expect(marcada(filaColor())).toBe(false)
    expect(pendientes([filaColor(), filaColor({ imeiSn: '350000000000012', ...HECHO })]).map((f) => f.imeiSn)).toEqual(['350000000000011'])
  })

  it('el número de la pestaña es lo pendiente de las cuatro tarjetas', () => {
    const t = tarjetas({
      color: [filaColor(), filaColor({ imeiSn: '350000000000012', ...HECHO })], grado: [filaGrado()],
      altas: [filaAlta({ ...HECHO, hechoVolvio: '2026-10-25T13:01:00' })], revisar: [filaRevisar(), filaRevisar({ idAviso: 2 })],
    })
    expect(totalPendientes(t)).toBe(5)
    expect(totalPendientes(null)).toBe(0)
    expect(cuentas(t, 'color')).toEqual({ total: 2, hechos: 1, pendientes: 1 })
    expect(cuentas(t, 'revisar')).toEqual({ total: 2, hechos: 0, pendientes: 2 })
  })

  it('«3 móviles · 1 hecho», «1 móvil» y sin hechos sin la segunda parte', () => {
    expect(textoNumero(3, 1)).toBe('3 móviles · 1 hecho')
    expect(textoNumero(5, 2)).toBe('5 móviles · 2 hechos')
    expect(textoNumero(1, 0)).toBe('1 móvil')
    expect(textoNumero(0, 0)).toBe('0 móviles')
  })

  it('la plantilla de color lleva lo pendiente con producto', () => {
    const filas = [filaColor(), filaColor({ imeiSn: '350000000000012', ponerProducto: null }), filaColor({ imeiSn: '350000000000013', ...HECHO })]
    expect(paraPlantillaColor(filas).map((f) => f.imeiSn)).toEqual(['350000000000011'])
  })

  it('la hora de la marca y el aviso de una marca que volvió', () => {
    expect(horaDe('2026-10-25T12:31:00')).toBe('12:31')
    expect(textoVolvio(filaGrado({ ...HECHO, hechoVolvio: '2026-10-25T13:01:00' }))).toBe('Marcado «Hecho» a las 12:31, pero NSYS sigue igual')
    expect(textoVolvio(filaGrado(HECHO))).toBeNull()
  })

  it('«Copiar lista» de Grado: IMEI, producto, grado en NSYS y grado nuevo de lo pendiente', () => {
    expect(listaGrado([filaGrado(), filaGrado({ imeiSn: '350000000000033', ...HECHO })])).toBe(
      'IMEI\tProducto\tGrado en NSYS\tPoner grado\n350000000000022\tApple iPhone 14 eSIM 256GB Midnight\tA\tA100')
  })

  it('los avisos de las descargas y de «Copiar lista»', () => {
    expect(avisoPlantillaColor('NSYS_color_2026-10-25.xlsx', 2, 0)).toBe('Descargado «NSYS_color_2026-10-25.xlsx» · 2 móviles (los marcados «Hecho» no van)')
    expect(avisoPlantillaColor('NSYS_color_2026-10-25.xlsx', 1, 1))
      .toBe('Descargado «NSYS_color_2026-10-25.xlsx» · 1 móvil (los marcados «Hecho» no van). 1 sin producto en NSYS no va: búscalo a mano')
    expect(avisoPlantillaColor('NSYS_color_2026-10-25.xlsx', 2, 0, 1))
      .toBe('Descargado «NSYS_color_2026-10-25.xlsx» · 2 móviles (los marcados «Hecho» no van). 1 con «compruébalo» (en amarillo): míralo antes de subirlo')
    expect(avisoPlantillaAltas('NSYS_altas_2026-10-25.xlsx', 2))
      .toBe('Descargado «NSYS_altas_2026-10-25.xlsx» · 2 móviles. Rellena en el Excel lo que va en rojo antes de subirlo')
    expect(avisoCopiado(3)).toBe('Copiado: 3 móviles con su grado nuevo. Cuando los cambies en NSYS, márcalos «Hecho»')
  })

  it('el último trabajo, el modelo del taller y el de NSYS', () => {
    expect(textoUltimoTrabajo(filaAlta())).toBe('R20261006_57 · Reparación')
    expect(textoUltimoTrabajo(filaAlta({ ultimoTrabajo: 'AP20261020_3', categoria: 'PULIDO', abierto: true }))).toBe('AP20261020_3 · Pulido · asignado')
    expect(modeloDelTaller(filaAlta())).toBe('iPhone 14')
    expect(modeloDelTaller(filaAlta({ modelo: null }))).toBe('—')
    expect(modeloDeFila(filaGrado())).toBe('iPhone 14 256GB')
    expect(modeloDeFila(filaRevisar())).toBe('iPhone 14 512GB')
  })

  it('los textos de cada tarjeta', () => {
    expect(NOMBRE).toEqual({ color: 'Cambio de color', grado: 'Cambio de grado', altas: 'No está en NSYS', revisar: 'Revisar a mano' })
    expect(EXPLICACION.grado).toBe('Cambia el grado: se corrige aparte en NSYS, uno a uno. Si el móvil también cambia de color, primero el color.')
    expect(VACIA.altas).toBe('Todos los móviles del taller están en NSYS.')
    expect(AYUDA.color).toMatch(/^Móviles a los que el taller ha cambiado el color\. En NSYS: bórralos y súbelos otra vez/)
  })
})
