import { describe, expect, it } from 'vitest'
import type { MovilStock } from '@/shared/api/client'
import { trabajo, visto } from '../test/fabrica'
import type { Movil } from './modelo'
import {
  avisoDescargado, bloquesRevisar, cifraRevisar, cifraSubir, coincide, cuentaRevisar, cuentaSubir, descripcion, elegidoPorImei, esA, esB,
  excelRevisar, excelSubir, filtrar, imeiBuscado, listaRevisar, listaSubir, MAX_A, nombreExcel, palabrasClave, pasoSubir, PULSA_QR,
  sinCoincidencias, textoCifra,
  gradoVendible, tieneGrado, totalQueRevisar, type GrupoRevisar,
} from './queRevisar'

let n = 0
/** Un móvil en stock con un IMEI nuevo; por defecto (fábrica), un iPhone 13 128GB Azul A en Listos con 6 días. */
const m = (p: Partial<MovilStock>): Movil => visto({ imeiSn: `3500000000${String(++n).padStart(5, '0')}`, ...p })

const P15 = { modelo: '15pro', modeloMaestro: '15 PRO', capacidad: '256GB', color: 'Titanio natural' }
const E14 = { modelo: '14', modeloMaestro: '14', capacidad: '128GB', color: 'Medianoche', esEsim: true }
const F14 = { ...E14, esEsim: false }
const A13 = { modelo: '13', modeloMaestro: '13', capacidad: '128GB', color: 'Azul' }
const A13_512 = { ...A13, capacidad: '512GB' }
const B12 = { modelo: '12', modeloMaestro: '12', capacidad: '64GB', color: 'Blanco' }
const R13M = { modelo: '13mini', modeloMaestro: '13 MINI', capacidad: '128GB', color: 'Rosa' }
const G12P = { modelo: '12pro', modeloMaestro: '12 PRO', capacidad: '128GB', color: 'Grafito' }
const N11 = { modelo: '11', modeloMaestro: '11', capacidad: '64GB', color: 'Negro' }
const N16 = { modelo: '16', modeloMaestro: '16', capacidad: '128GB', color: 'Negro' }
const G13P = { modelo: '13pro', modeloMaestro: '13 PRO', capacidad: '256GB', color: 'Grafito' }
const P13P = { modelo: '13pro', modeloMaestro: '13 PRO', capacidad: '1TB', color: 'Plata' }

// Los casos del prototipo aprobado (spec §7).
const STOCK: Movil[] = [
  m({ ...P15, grado: 'n/a', dias: 12 }), m({ ...P15, grado: 'n/a', dias: 41 }),
  m({ ...P15, grado: 'n/a', dias: 23, ubicacion: 'Taller · Reparación', trabajos: [trabajo({ tecnico: 'Técnico A' })] }),
  m({ ...P15, grado: 'n/a', dias: 5 }),
  m({ ...E14, grado: 'n/a' }), m({ ...E14, grado: 'n/a' }), m({ ...E14, grado: 'B', bateriaNueva: true }), m({ ...E14, grado: 'ID' }),
  m({ ...F14, grado: 'A' }), m({ ...F14, grado: 'A' }), m({ ...F14, grado: 'A-', bateriaNueva: true }),
  ...[1, 2, 3, 4, 5].map(() => m({ ...A13, grado: 'n/a' })), m({ ...A13, grado: 'A+' }),
  m({ ...A13_512, grado: 'B' }),
  m({ ...A13_512, grado: 'B', ubicacion: 'Taller · Pulir', trabajos: [trabajo({ categoria: 'PULIDO', tecnico: 'Técnico C' })] }),
  m({ ...B12, grado: 'n/a' }), m({ ...B12, grado: 'MsB' }),
  m({ ...R13M, grado: 'n/a' }), m({ ...R13M, grado: 'n/a' }), m({ ...R13M, grado: 'A' }), m({ ...R13M, grado: 'A' }),
  m({ ...G12P, grado: 'n/a', ubicacion: 'Taller · Glass', trabajos: [trabajo({ categoria: 'GLASS', tecnico: 'Técnico B' })] }),
  m({ ...N11, grado: 'n/a' }), m({ ...N11, grado: 'n/a' }), m({ ...N11, grado: 'A' }), m({ ...N11, grado: 'B' }),
  m({ ...N11, grado: 'B', bateriaNueva: true }),
  m({ ...N16, grado: '' }), m({ ...N16, grado: 'n/a' }), m({ ...N16, grado: 'F' }),
  m({ ...G13P, grado: 'n/a' }), m({ ...G13P, grado: 'n/a' }), m({ ...G13P, grado: 'NR' }),
  m({ ...P13P, grado: 'n/a' }),
  m({ ...A13, color: 'Verde', grado: 'n/a', estado: 'DE_PEDIDO' }), m({ ...A13, color: 'Verde', grado: 'n/a', estado: 'NO_CUENTA' }),
]

describe('«Qué revisar»: qué grado tiene cada móvil (spec 0.9.25 §2.3)', () => {
  it('con grado: A±, B±, C con o sin Ms, Ms solo, ID, F, FD y RMA; sin grado, lo demás', () => {
    for (const g of ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'MsA', 'msB', 'Ms', 'ID', 'F', 'Fd', 'RMA', ' A ']) expect(tieneGrado(g), g).toBe(true)
    for (const g of ['n/a', 'N/A', '', null, undefined, 'NR', 'Z']) expect(tieneGrado(g), String(g)).toBe(false)
  })

  it('A es A+, A o A- sin Ms; B para subir es exactamente B', () => {
    for (const g of ['A+', 'A', 'A-', 'a']) expect(esA(g), g).toBe(true)
    for (const g of ['MsA', 'B', 'n/a', null]) expect(esA(g), String(g)).toBe(false)
    for (const g of ['B', 'b']) expect(esB(g), g).toBe(true)
    for (const g of ['B+', 'B-', 'MsB', 'A', null]) expect(esB(g), String(g)).toBe(false)
    expect(MAX_A).toBe(0)
  })
})

describe('«Qué revisar»: F, FD y RMA no cuentan como grado (spec 0.9.25 §10.8)', () => {
  it('gradoVendible: los grados con los que se puede vender; F, FD, RMA y lo sin grado, no', () => {
    for (const g of ['A+', 'A', 'B', 'C', 'MsB', 'Ms', 'ID']) expect(gradoVendible(g), g).toBe(true)
    for (const g of ['F', 'Fd', 'FD', 'RMA', 'n/a', '', null]) expect(gradoVendible(g), String(g)).toBe(false)
  })
})

/** Lo que importa de un modelo-color de «Revisar sin grado»: cuál es y sus dos cuentas. */
const resumen = (g: GrupoRevisar) => ({ grupo: descripcion(g), pendientes: g.pendientes, conTecnico: g.conTecnico })

describe('«Qué revisar»: Revisar sin grado, como «Solo n/a» de la hoja (spec 0.9.25 §10.10, §2.6 y §2.7)', () => {
  it('entra un modelo-color con algo sin grado y nada con un grado vendible; F, FD y RMA no cuentan como grado', () => {
    const con = (...grados: string[]) => listaRevisar(grados.map((grado) => m({ ...N16, grado }))).map(resumen)
    expect(con('n/a', 'A')).toEqual([])
    expect(con('n/a', 'B')).toEqual([])
    for (const g of ['A+', 'A-', 'B+', 'B-', 'C', 'MsA', 'MsB', 'Ms', 'ID']) expect(con('n/a', 'n/a', g), g).toEqual([])
    expect(con('n/a', 'F', 'FD', 'RMA')).toEqual([{ grupo: 'iPhone 16 128 GB Negro', pendientes: 1, conTecnico: 0 }])
    expect(con('n/a', 'n/a', '')).toEqual([{ grupo: 'iPhone 16 128 GB Negro', pendientes: 3, conTecnico: 0 }])
    expect(con('F', 'RMA')).toEqual([])
  })

  it('cada modelo-color lleva sus móviles y solo dos cuentas, pendientes y con técnico: sin motivo, «Con grado» ni pedidos', () => {
    const [g] = listaRevisar([m({ ...N16, grado: 'n/a' })])
    expect(Object.keys(g).sort()).toEqual(['a', 'capacidad', 'clave', 'color', 'conTecnico', 'esEsim', 'modelo', 'moviles', 'pendientes', 'skus'])
  })

  it('primero lo que más queda sin revisar y, a igualdad, por modelo; los del técnico no cuentan; fuera lo que tiene grado y lo que no es stock', () => {
    expect(listaRevisar(STOCK).map(resumen)).toEqual([
      { grupo: 'iPhone 15 Pro 256 GB Titanio natural', pendientes: 3, conTecnico: 1 },
      { grupo: 'iPhone 13 Pro 256 GB Grafito', pendientes: 3, conTecnico: 0 },
      { grupo: 'iPhone 16 128 GB Negro', pendientes: 2, conTecnico: 0 },
      { grupo: 'iPhone 13 Pro 1 TB Plata', pendientes: 1, conTecnico: 0 },
      { grupo: 'iPhone 12 Pro 128 GB Grafito', pendientes: 0, conTecnico: 1 },
    ])
  })

  it('a igualdad de pendientes, el orden de §2.7: modelo del más nuevo, el físico antes que el eSIM, la capacidad como número y el color', () => {
    const lista = listaRevisar([
      m({ ...A13, capacidad: '1TB', grado: 'n/a' }), m({ ...A13, color: 'Verde', grado: 'n/a' }), m({ ...A13, grado: 'n/a' }),
      m({ ...A13, capacidad: '256GB', grado: 'n/a' }), m({ ...E14, grado: 'n/a' }), m({ ...F14, grado: 'n/a' }), m({ ...P15, grado: 'n/a' }),
    ])
    expect(lista.map(resumen)).toEqual([
      { grupo: 'iPhone 15 Pro 256 GB Titanio natural', pendientes: 1, conTecnico: 0 },
      { grupo: 'iPhone 14 128 GB Medianoche', pendientes: 1, conTecnico: 0 },
      { grupo: 'iPhone 14 eSIM 128 GB Medianoche', pendientes: 1, conTecnico: 0 },
      { grupo: 'iPhone 13 128 GB Azul', pendientes: 1, conTecnico: 0 },
      { grupo: 'iPhone 13 128 GB Verde', pendientes: 1, conTecnico: 0 },
      { grupo: 'iPhone 13 256 GB Azul', pendientes: 1, conTecnico: 0 },
      { grupo: 'iPhone 13 1 TB Azul', pendientes: 1, conTecnico: 0 },
    ])
  })

  it('un modelo-color con todos sus n/a con técnico va al final con 0 pendientes, aunque su modelo sea más nuevo', () => {
    const lista = listaRevisar([
      m({ ...N16, grado: 'n/a', trabajos: [trabajo()] }), m({ ...N16, grado: 'n/a', trabajos: [trabajo({ categoria: 'GLASS' })] }),
      m({ ...N11, grado: 'n/a' }),
      m({ ...A13, grado: 'n/a' }), m({ ...A13, grado: 'n/a', trabajos: [trabajo()] }), m({ ...A13, grado: 'n/a' }),
    ])
    expect(lista.map(resumen)).toEqual([
      { grupo: 'iPhone 13 128 GB Azul', pendientes: 2, conTecnico: 1 },
      { grupo: 'iPhone 11 64 GB Negro', pendientes: 1, conTecnico: 0 },
      { grupo: 'iPhone 16 128 GB Negro', pendientes: 0, conTecnico: 2 },
    ])
  })

  it('los móviles de un grupo: solo los sin grado, los de más días primero', () => {
    const [p15, , n16] = listaRevisar(STOCK)
    expect(p15.moviles.map((x) => x.dias)).toEqual([41, 23, 12, 5])
    expect(n16.moviles.map((x) => x.grado)).toEqual(['', 'n/a'])
  })

  it('las cifras de la tarjeta: modelos-color con algo pendiente y sus móviles (el que solo tiene el técnico no cuenta)', () => {
    expect(cifraRevisar(listaRevisar(STOCK))).toEqual({ grupos: 4, moviles: 9 })
    expect(textoCifra({ grupos: 4, moviles: 9 })).toBe('modelos-color · 9 móviles')
    expect(textoCifra({ grupos: 1, moviles: 1 })).toBe('modelo-color · 1 móvil')
  })

  it('sin capacidad ni color, la descripción solo dice el modelo', () => {
    expect(descripcion(listaRevisar([m({ capacidad: null, color: null, grado: 'n/a' })])[0])).toBe('iPhone 13')
  })

  it('del mismo modelo, el físico antes que el eSIM aunque tenga más capacidad', () => {
    expect(listaRevisar([m({ ...E14, grado: 'n/a' }), m({ ...F14, capacidad: '256GB', grado: 'n/a' })]).map(descripcion))
      .toEqual(['iPhone 14 256 GB Medianoche', 'iPhone 14 eSIM 128 GB Medianoche'])
  })
})

describe('«Qué revisar»: Subir B a A, solo con ningún A (spec 0.9.25 §10.11)', () => {
  it('B y B100 de modelos sin ningún A, en el orden de los modelos; el MsB no sale ni el que tiene un A', () => {
    const lista = listaSubir(STOCK)
    expect(lista.map(descripcion)).toEqual(['iPhone 14 eSIM 128 GB Medianoche', 'iPhone 13 512 GB Azul'])
    expect(lista.map(({ b, bTecnico, b100, b100Tecnico }) => [b, bTecnico, b100, b100Tecnico])).toEqual([[0, 0, 1, 0], [1, 1, 0, 0]])
    expect(lista.map((g) => g.a)).toEqual([0, 0])
    expect(cifraSubir(lista)).toEqual({ grupos: 2, moviles: 2 })
    expect(totalQueRevisar(listaRevisar(STOCK), lista)).toBe(6)
  })

  const subir = (...grados: Partial<MovilStock>[]) => listaSubir(grados.map((g) => m({ ...N11, ...g }))).map(descripcion)
  const NEGRO = ['iPhone 11 64 GB Negro']

  it('con un A (A, A+ o A-, con o sin batería nueva) y un B o un B100, ya no sale', () => {
    expect(subir({ grado: 'A' }, { grado: 'B' })).toEqual([])
    expect(subir({ grado: 'A+' }, { grado: 'B' })).toEqual([])
    expect(subir({ grado: 'A-', bateriaNueva: true }, { grado: 'B', bateriaNueva: true })).toEqual([])
    expect(subir({ grado: 'A' }, { grado: 'B', bateriaNueva: true })).toEqual([])
  })

  it('con ningún A y un B, o solo un B100, sale', () => {
    expect(subir({ grado: 'B' })).toEqual(NEGRO)
    expect(subir({ grado: 'B', bateriaNueva: true })).toEqual(NEGRO)
    expect(subir({ grado: 'B' }, { grado: 'n/a' }, { grado: 'MsA' })).toEqual(NEGRO)
    const [g] = listaSubir([m({ ...N11, grado: 'B', dias: 2 }), m({ ...N11, grado: 'B', bateriaNueva: true, dias: 1 })])
    expect(g.moviles.map(pasoSubir)).toEqual(['B → A', 'B100 → A100'])
  })

  it('un A con técnico también cuenta: el modelo-color no sale', () => {
    expect(subir({ grado: 'A', trabajos: [trabajo({ tecnico: 'Técnico A' })] }, { grado: 'B' })).toEqual([])
  })
})

describe('«Qué revisar»: el Excel (spec 0.9.25 §10.3 y §10.10)', () => {
  it('«Revisar sin grado»: cinco columnas, una fila por modelo-color con sus pendientes, en el orden de la lista y con «Revisado» vacía', () => {
    const lista = listaRevisar([
      m({ ...N16, grado: 'n/a', imeiSn: '350000000000207' }),
      m({ ...P15, grado: 'n/a', imeiSn: '350000000000201' }),
      m({ ...P15, grado: 'n/a', imeiSn: '350000000000202' }),
      m({ ...P15, grado: 'n/a', imeiSn: '350000000000204' }),
      m({ ...P15, grado: 'n/a', imeiSn: '350000000000203', trabajos: [trabajo({ tecnico: 'Técnico A' })] }),
      m({ ...G12P, grado: 'n/a', imeiSn: '350000000000208', trabajos: [trabajo({ tecnico: 'Técnico B' })] }),
    ])
    expect(excelRevisar(lista)).toEqual({
      hoja: 'Revisar sin grado',
      columnas: ['Modelo', 'Capacidad', 'Color', 'Sin grado', 'Revisado'],
      filas: [
        ['iPhone 15 Pro', '256 GB', 'Titanio natural', '3', ''],
        ['iPhone 16', '128 GB', 'Negro', '1', ''],
      ],
    })
  })

  it('«Subir B a A»: seis columnas, una fila por modelo-color con sus B y B100 sin los del técnico, y «Hecho» vacía', () => {
    const lista = listaSubir([
      m({ ...N11, grado: 'B', imeiSn: '350000000000301' }),
      m({ ...N11, grado: 'B', bateriaNueva: true, imeiSn: '350000000000302', ubicacion: 'Taller · Pulir',
        trabajos: [trabajo({ categoria: 'PULIDO', tecnico: 'Técnico C' })] }),
      m({ ...N11, grado: 'B', bateriaNueva: true, imeiSn: '350000000000303' }),
      m({ ...B12, grado: 'B', imeiSn: '350000000000304', trabajos: [trabajo({ tecnico: 'Técnico C' })] }),
    ])
    expect(excelSubir(lista)).toEqual({
      hoja: 'Subir B a A',
      columnas: ['Modelo', 'Capacidad', 'Color', 'B', 'B100', 'Hecho'],
      filas: [['iPhone 11', '64 GB', 'Negro', '1', '1', '']],
    })
  })

  it('el nombre del fichero lleva el día de Madrid, y el aviso cuántos modelos-color', () => {
    expect(nombreExcel('revisar', new Date('2026-11-04T23:30:00Z'))).toBe('Que_revisar_sin_grado_2026-11-05.xlsx')
    expect(nombreExcel('subir', new Date('2026-11-04T10:00:00Z'))).toBe('Que_revisar_subir_B_a_A_2026-11-04.xlsx')
    expect(avisoDescargado(1)).toBe('Descargado: 1 modelo-color')
    expect(avisoDescargado(12)).toBe('Descargado: 12 modelos-color')
  })
})

describe('«Qué revisar»: buscar por palabras clave (spec 0.9.25 §3.6)', () => {
  // SKU e IMEI puestos a mano: la fábrica les da a todos el SKU «i13128AzulA». El F y el RMA no sacan su modelo-color de
  // «Revisar sin grado» (§10.10), y sus SKU sirven para buscarlo; el B12 solo está en «Subir B a A».
  const BUSCA: Movil[] = [
    m({ ...A13, grado: 'n/a', sku: null, imeiSn: '350000000012345' }), m({ ...A13, grado: 'F', sku: 'i13128AzulF' }),
    m({ ...N11, grado: 'n/a', sku: null }), m({ ...N11, grado: 'RMA', sku: 'i1164NegroRMA' }),
    m({ ...P13P, grado: 'n/a', sku: null }), m({ ...E14, grado: 'n/a', sku: null }),
    m({ ...P15, color: 'Púrpura', grado: 'n/a', sku: null }),
    m({ ...B12, grado: 'B', sku: 'i1264BlancoB' }),
  ]
  const busca = (texto: string) => filtrar(listaRevisar(BUSCA), palabrasClave(texto)).map(descripcion)

  it('las palabras clave: sin mayúsculas, sin acentos y sin espacios de más', () => {
    expect(palabrasClave('  13 Pro   256 ')).toEqual(['13', 'pro', '256'])
    expect(palabrasClave('Púrpura')).toEqual(['purpura'])
    expect(palabrasClave('   ')).toEqual([])
  })

  it('sin palabras, todos en su orden; cada palabra tiene que estar en la descripción (también «1tb», «128gb», «esim» o sin acento)', () => {
    expect(busca('')).toEqual([
      'iPhone 15 Pro 256 GB Púrpura', 'iPhone 14 eSIM 128 GB Medianoche', 'iPhone 13 Pro 1 TB Plata', 'iPhone 13 128 GB Azul',
      'iPhone 11 64 GB Negro',
    ])
    expect(busca('13 pro')).toEqual(['iPhone 13 Pro 1 TB Plata'])
    expect(busca('1tb')).toEqual(['iPhone 13 Pro 1 TB Plata'])
    expect(busca('14 esim')).toEqual(['iPhone 14 eSIM 128 GB Medianoche'])
    expect(busca('purpura')).toEqual(['iPhone 15 Pro 256 GB Púrpura'])
    expect(busca('128 gb')).toEqual(['iPhone 14 eSIM 128 GB Medianoche', 'iPhone 13 128 GB Azul'])
    expect(busca('128gb')).toEqual(['iPhone 14 eSIM 128 GB Medianoche', 'iPhone 13 128 GB Azul'])
    expect(busca('13 negro')).toEqual([])
  })

  it('por el SKU de cualquiera de sus móviles, también los que no están en la lista', () => {
    expect(busca('i13128azul')).toEqual(['iPhone 13 128 GB Azul'])
    expect(busca('I1164Negro')).toEqual(['iPhone 11 64 GB Negro'])
    expect(filtrar(listaSubir(BUSCA), palabrasClave('blanco')).map(descripcion)).toEqual(['iPhone 12 64 GB Blanco'])
    expect(filtrar(listaSubir(BUSCA), palabrasClave('i1264')).map(descripcion)).toEqual(['iPhone 12 64 GB Blanco'])
  })

  it('por el IMEI de un móvil de la lista, solo con 6 caracteres o más', () => {
    expect(busca('012345')).toEqual(['iPhone 13 128 GB Azul'])
    expect(busca('2345')).toEqual([])
    const [a13] = filtrar(listaRevisar(BUSCA), ['012345'])
    expect(a13.moviles.filter((x) => imeiBuscado(x, ['012345'])).map((x) => x.imeiSn)).toEqual(['350000000012345'])
    expect(coincide(a13, ['2345'])).toBe(false)
  })

  it('un número es una pieza entera: «12» no encuentra «128 GB», «512 GB» ni el SKU de otro modelo', () => {
    const lista = listaRevisar([
      m({ ...B12, grado: 'n/a', sku: null }), m({ ...A13, grado: 'n/a', sku: 'i13128AzulA' }),
      m({ ...E14, capacidad: '512GB', grado: 'n/a', sku: 'i14esim512MedianocheA' }),
    ])
    const busca = (texto: string) => filtrar(lista, palabrasClave(texto)).map(descripcion)
    expect(busca('iphone 12')).toEqual(['iPhone 12 64 GB Blanco'])
    expect(busca('12')).toEqual(['iPhone 12 64 GB Blanco'])
    expect(busca('iphone12')).toEqual(['iPhone 12 64 GB Blanco'])
    expect(busca('512')).toEqual(['iPhone 14 eSIM 512 GB Medianoche'])
  })

  it('una palabra con letras busca por el principio de cada pieza, y el SKU por su principio', () => {
    const lista = listaRevisar([m({ ...P15, grado: 'n/a', sku: null }), m({ ...A13, grado: 'n/a', sku: 'i13128AzulA' })])
    const busca = (texto: string) => filtrar(lista, palabrasClave(texto)).map(descripcion)
    expect(busca('tit')).toEqual(['iPhone 15 Pro 256 GB Titanio natural'])
    expect(busca('tanio')).toEqual([])
    expect(busca('titanionat')).toEqual(['iPhone 15 Pro 256 GB Titanio natural'])
    expect(busca('i13128')).toEqual(['iPhone 13 128 GB Azul'])
    expect(busca('128azul')).toEqual([])
  })

  it('por el código del modelo pegado («15pro», «12mini»), sin que «12» encuentre «128»', () => {
    const lista = listaRevisar([
      m({ ...P15, grado: 'n/a', sku: null }), m({ ...A13, grado: 'n/a', sku: null }),
      m({ modelo: '12mini', modeloMaestro: '12 MINI', capacidad: '64GB', color: 'Rosa', grado: 'n/a', sku: null }),
    ])
    const busca = (texto: string) => filtrar(lista, palabrasClave(texto)).map(descripcion)
    expect(busca('15pro')).toEqual(['iPhone 15 Pro 256 GB Titanio natural'])
    expect(busca('12mini')).toEqual(['iPhone 12 Mini 64 GB Rosa'])
    expect(busca('12')).toEqual(['iPhone 12 Mini 64 GB Rosa'])
  })

  it('el texto sin coincidencias', () => {
    expect(sinCoincidencias('  13 negro ')).toBe('Ningún modelo-color con «13 negro».')
  })
})

describe('«Qué revisar»: Revisar sin grado en dos bloques (spec 0.9.25 §10.13)', () => {
  const g = (clave: string, pendientes: number, conTecnico = 0): GrupoRevisar => ({
    clave, modelo: clave, capacidad: '128GB', color: 'Azul', esEsim: false, a: 0, skus: [], moviles: [], pendientes, conTecnico,
  })
  const [g5, g3, g2, g1, g0] = [g('a', 5), g('b', 3), g('c', 2), g('d', 1), g('e', 0, 1)]

  it('parte en «3 o más» y «Menos de 3», con los de 0 al final del segundo, y titula cada bloque con sus cifras', () => {
    expect(bloquesRevisar([g5, g3, g2, g1, g0])).toEqual([
      { titulo: '3 o más sin revisar · 2 modelos-color · 8 móviles', grupos: [g5, g3] },
      { titulo: 'Menos de 3 sin revisar · 3 modelos-color · 3 móviles', grupos: [g2, g1, g0] },
    ])
  })

  it('un bloque sin grupos no sale', () => {
    expect(bloquesRevisar([g5, g3])).toEqual([{ titulo: '3 o más sin revisar · 2 modelos-color · 8 móviles', grupos: [g5, g3] }])
    expect(bloquesRevisar([g2, g0])).toEqual([{ titulo: 'Menos de 3 sin revisar · 2 modelos-color · 2 móviles', grupos: [g2, g0] }])
    expect(bloquesRevisar([])).toEqual([])
  })

  it('en singular cuando toca', () => {
    expect(bloquesRevisar([g1])).toEqual([{ titulo: 'Menos de 3 sin revisar · 1 modelo-color · 1 móvil', grupos: [g1] }])
    expect(bloquesRevisar([g('x', 3)])).toEqual([{ titulo: '3 o más sin revisar · 1 modelo-color · 3 móviles', grupos: [g('x', 3)] }])
  })
})

describe('«Qué revisar»: el panel del modelo-color elegido (spec 0.9.25 §10.14)', () => {
  const tecnico = [trabajo({ tecnico: 'Técnico A' })]

  it('la cuenta de «Revisar sin grado»: los sin grado y, aparte, los del técnico', () => {
    const [p15] = listaRevisar([m({ ...P15, grado: 'n/a' }), m({ ...P15, grado: 'n/a' }), m({ ...P15, grado: 'n/a', trabajos: tecnico })])
    expect(cuentaRevisar(p15)).toEqual({ texto: '2 sin grado', tecnico: 1 })
    const [g12] = listaRevisar([m({ ...G12P, grado: 'n/a', trabajos: tecnico })])
    expect(cuentaRevisar(g12)).toEqual({ texto: '0 sin grado', tecnico: 1 })
  })

  it('la cuenta de «Subir B a A»: B y B100 sin los del técnico y, aparte, los B y B100 del técnico', () => {
    const [b12] = listaSubir([
      m({ ...B12, grado: 'B' }), m({ ...B12, grado: 'B', bateriaNueva: true }), m({ ...B12, grado: 'B', bateriaNueva: true }),
      m({ ...B12, grado: 'B', trabajos: tecnico }), m({ ...B12, grado: 'B', bateriaNueva: true, trabajos: tecnico }),
    ])
    expect(cuentaSubir(b12)).toEqual({ texto: '1 B · 2 B100', tecnico: 2 })
    const [solo] = listaSubir([m({ ...B12, grado: 'B' })])
    expect(cuentaSubir(solo)).toEqual({ texto: '1 B · 0 B100', tecnico: 0 })
  })

  it('el texto del panel sin nada elegido', () => {
    expect(PULSA_QR).toBe('Pulsa un modelo-color para ver sus móviles.')
  })

  it('elegidoPorImei: el primer modelo-color que deja la búsqueda con un móvil de ese IMEI; sin IMEI, ninguno', () => {
    const lista = listaRevisar([
      m({ ...P15, grado: 'n/a', imeiSn: '350000000099001' }), m({ ...A13, grado: 'n/a', imeiSn: '350000000099002' }),
      m({ ...A13, grado: 'n/a', imeiSn: '350000000099003' }),
    ])
    expect(lista.map(descripcion)).toEqual(['iPhone 13 128 GB Azul', 'iPhone 15 Pro 256 GB Titanio natural'])
    expect(elegidoPorImei(lista, palabrasClave('099001'))).toBe('iPhone 15 Pro|256GB|Titanio natural')
    expect(elegidoPorImei(lista, palabrasClave('3500000000990'))).toBe('iPhone 13|128GB|Azul')
    expect(elegidoPorImei(lista, palabrasClave('15 3500000000990'))).toBe('iPhone 15 Pro|256GB|Titanio natural')
    expect(elegidoPorImei(lista, palabrasClave('13 099001'))).toBeNull()
    for (const texto of ['', '13', '99001', '123456']) expect(elegidoPorImei(lista, palabrasClave(texto)), texto).toBeNull()
  })
})
