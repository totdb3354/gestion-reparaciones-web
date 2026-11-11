import { describe, expect, it } from 'vitest'
import { fila } from '../test/fabrica'
import { COLUMNAS, TEXTO_NIVEL, claseCelda, filtrarColumnas, haceUnMes, rangoDe, recuento, textoMotivo, valores, vigente } from './filas'

describe('textoMotivo', () => {
  it.each([
    ['NO_EN_NSYS', null, 'no está en NSYS'],
    ['EN_OTRA_FILA', null, 'ya está en otro pedido'],
    ['MODELO', 'i14128AzulA', 'otro modelo, capacidad o eSIM: es i14128AzulA'],
    ['MODELO', null, 'otro modelo, capacidad o eSIM'],
    ['COLOR_O_GRADO', 'i13128RosaA', 'otro color o grado: es i13128RosaA'],
    ['COLOR_O_GRADO', null, 'otro color o grado'],
    ['GRADO_NO_VENDIBLE', null, 'ese grado no se vende'],
    ['SKU_DESCONOCIDO', null, 'el maestro no conoce este SKU'],
    ['EN_TALLER', null, 'en el taller'],
    ['MS', null, 'es un Ms'],
    ['B_POR_A', null, 'B por A'],
  ])('%s (%s) → %s', (motivo, skuMovil, esperado) => {
    expect(textoMotivo(fila({ motivo, skuMovil }))).toBe(esperado)
  })

  it('sin motivo, null', () => {
    expect(textoMotivo(fila())).toBeNull()
  })
})

describe('claseCelda', () => {
  it('enviada gana, con o sin IMEI', () => {
    expect(claseCelda(fila({ enviada: true }))).toBe('enviada')
    expect(claseCelda(fila({ enviada: true, imei: '350000000000001', nivel: 'MAL' }))).toBe('enviada')
  })
  it('sin IMEI, vacía', () => expect(claseCelda(fila())).toBe('vacia'))
  it('por nivel', () => {
    const imei = '350000000000001'
    expect(claseCelda(fila({ imei, nivel: 'OK' }))).toBe('ok')
    expect(claseCelda(fila({ imei, nivel: 'AVISO' }))).toBe('aviso')
    expect(claseCelda(fila({ imei, nivel: 'MAL' }))).toBe('mal')
    expect(claseCelda(fila({ imei, nivel: null }))).toBe('ok')
  })
})

describe('recuento', () => {
  it('cuenta total, sin enviar y sin IMEI (solo entre las sin enviar)', () => {
    const filas = [
      fila({ idFila: 1, enviada: true }), fila({ idFila: 2, imei: '350000000000001' }), fila({ idFila: 3 }), fila({ idFila: 4 }),
    ]
    expect(recuento(filas)).toEqual({ total: 4, sinEnviar: 3, sinImei: 2 })
  })
  it('vacío', () => expect(recuento([])).toEqual({ total: 0, sinEnviar: 0, sinImei: 0 }))
})

describe('constantes', () => {
  it('columnas y textos de nivel', () => {
    expect([...COLUMNAS]).toEqual(['Fecha', 'Plataforma', 'SKU', 'IMEI', 'Pedido', 'Fecha compra'])
    expect(TEXTO_NIVEL[3]).toBe('hay que transformarlo')
  })
})

describe('haceUnMes', () => {
  it('el mismo día del mes anterior, o el último si no existe', () => {
    expect(haceUnMes('2026-11-10')).toBe('2026-10-10')
    expect(haceUnMes('2026-01-15')).toBe('2025-12-15')
    expect(haceUnMes('2026-03-31')).toBe('2026-02-28')
    expect(haceUnMes('2028-03-31')).toBe('2028-02-29')
  })
})

describe('rangoDe', () => {
  // 15 de marzo de 2026, a mediodia (Madrid)
  const hoy = new Date('2026-03-15T11:00:00Z')
  it('cada periodo', () => {
    expect(rangoDe('mes', hoy)).toEqual({ desde: '2026-02-15', hasta: '2026-03-15' })
    expect(rangoDe('tres-meses', hoy)).toEqual({ desde: '2025-12-15', hasta: '2026-03-15' })
    expect(rangoDe('anio', hoy)).toEqual({ desde: '2026-01-01', hasta: '2026-03-15' })
    expect(rangoDe('todo', hoy)).toEqual({ desde: '2000-01-01', hasta: '2026-03-15' })
    expect(rangoDe('rango', hoy, { desde: '2026-01-10', hasta: '2026-02-20' })).toEqual({ desde: '2026-01-10', hasta: '2026-02-20' })
  })
  it('tres meses atras recorta al ultimo dia del mes', () => {
    expect(rangoDe('tres-meses', new Date('2026-05-31T10:00:00Z')).desde).toBe('2026-02-28')
  })
  it('usa el dia de Madrid, no el UTC', () => {
    expect(rangoDe('mes', new Date('2026-03-14T23:30:00Z')).hasta).toBe('2026-03-15')
  })
})

describe('rangoDe: bordes', () => {
  it('1 de enero y 29 de febrero', () => {
    const ene = new Date('2026-01-01T12:00:00Z')
    expect(rangoDe('mes', ene)).toEqual({ desde: '2025-12-01', hasta: '2026-01-01' })
    expect(rangoDe('tres-meses', ene).desde).toBe('2025-10-01')
    expect(rangoDe('anio', ene).desde).toBe('2026-01-01')
    const bis = new Date('2028-02-29T12:00:00Z')
    expect(rangoDe('mes', bis).desde).toBe('2028-01-29')
    expect(rangoDe('tres-meses', bis).desde).toBe('2027-11-29')
  })
  it('un rango con una fecha vacia o al reves vuelve al ultimo mes', () => {
    const hoy = new Date('2026-03-15T11:00:00Z')
    const mes = { desde: '2026-02-15', hasta: '2026-03-15' }
    expect(rangoDe('rango', hoy, { desde: '', hasta: '' })).toEqual(mes)
    expect(rangoDe('rango', hoy, { desde: '2026-01-01', hasta: '' })).toEqual(mes)
    expect(rangoDe('rango', hoy, { desde: '2026-03-01', hasta: '2026-01-01' })).toEqual(mes)
    expect(rangoDe('rango', hoy)).toEqual(mes)
  })
})

describe('valores y filtrarColumnas', () => {
  const filas = [
    fila({ idFila: 1, plataforma: 'Web', sku: 'b2' }),
    fila({ idFila: 2, plataforma: 'Amazon', sku: 'a1', imei: '350000000000001' }),
    fila({ idFila: 3, plataforma: 'Web', sku: 'a1', enviada: true }),
    fila({ idFila: 4, plataforma: 'Web', sku: 'c3', imei: '350000000000002' }),
  ]
  const vacio = { plataformas: new Set<string>(), skus: new Set<string>(), soloSinImei: false }
  it('valores: distintos y ordenados', () => {
    expect(valores(filas, 'plataforma')).toEqual(['Amazon', 'Web'])
    expect(valores(filas, 'sku')).toEqual(['a1', 'b2', 'c3'])
  })
  it('sin filtros devuelve las mismas filas', () => {
    expect(filtrarColumnas(filas, vacio)).toEqual(filas)
  })
  it('por plataforma y sku, combinados, reutilizando los objetos', () => {
    const r = filtrarColumnas(filas, { ...vacio, plataformas: new Set(['Web']) })
    expect(r.map((f) => f.idFila)).toEqual([1, 3, 4])
    expect(r[0]).toBe(filas[0])
    expect(filtrarColumnas(filas, { ...vacio, plataformas: new Set(['Web']), skus: new Set(['a1', 'c3']) }).map((f) => f.idFila)).toEqual([3, 4])
  })
  it('solo sin IMEI: sin enviar y sin IMEI', () => {
    expect(filtrarColumnas(filas, { ...vacio, soloSinImei: true }).map((f) => f.idFila)).toEqual([1])
  })
  it('un valor elegido que ya no existe se ignora', () => {
    expect(filtrarColumnas(filas, { ...vacio, plataformas: new Set(['Ya no esta']) })).toEqual(filas)
    expect(filtrarColumnas(filas, { ...vacio, plataformas: new Set(['Ya no esta', 'Amazon']) }).map((f) => f.idFila)).toEqual([2])
  })
  it('vigente: la seleccion que sigue existiendo', () => {
    expect([...vigente(new Set(['a', 'x']), ['a', 'b'])]).toEqual(['a'])
  })
})
