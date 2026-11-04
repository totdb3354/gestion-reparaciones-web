import { describe, expect, it } from 'vitest'
import type { MovilStock } from '@/shared/api/client'
import { trabajo, visto } from '../test/fabrica'
import type { Movil } from './modelo'
import {
  cifraRevisar, cifraSubir, coincide, descripcion, esA, esB, filtrar, imeiBuscado, listaRevisar, listaSubir, MAX_A, palabrasClave,
  pasoSubir, sinCoincidencias, textoCifra, textoRevisar, textoSubir, tieneGrado, tituloA, totalQueRevisar,
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
    expect(MAX_A).toBe(1)
  })
})

describe('«Qué revisar»: Revisar sin grado (spec 0.9.25 §2.4, §2.6 y §2.7)', () => {
  it('por motivo y, dentro, modelo del más nuevo, el físico antes que el eSIM, capacidad como número; fuera lo que no es stock y con 2 A', () => {
    const lista = listaRevisar(STOCK)
    expect(lista.map((g) => [g.motivo, descripcion(g)])).toEqual([
      ['NADA', 'iPhone 15 Pro 256 GB Titanio natural'],
      ['NADA', 'iPhone 13 Pro 256 GB Grafito'],
      ['NADA', 'iPhone 13 Pro 1 TB Plata'],
      ['NADA', 'iPhone 12 Pro 128 GB Grafito'],
      ['NINGUN_A', 'iPhone 16 128 GB Negro'],
      ['NINGUN_A', 'iPhone 14 eSIM 128 GB Medianoche'],
      ['NINGUN_A', 'iPhone 12 64 GB Blanco'],
      ['UN_A', 'iPhone 13 128 GB Azul'],
      ['UN_A', 'iPhone 11 64 GB Negro'],
    ])
  })

  it('las cuentas: pendientes sin los del técnico, A en stock y con grado (vacío y «NR» sin grado; F, ID y MsB con grado)', () => {
    const [p15, g13p, , g12p, n16, e14, b12, a13] = listaRevisar(STOCK)
    expect(p15).toMatchObject({ pendientes: 3, conTecnico: 1, a: 0, conGrado: 0 })
    expect(g13p).toMatchObject({ pendientes: 3, conTecnico: 0, conGrado: 0 })
    expect(g12p).toMatchObject({ pendientes: 0, conTecnico: 1 })
    expect(n16).toMatchObject({ pendientes: 2, conGrado: 1, a: 0 })
    expect(e14).toMatchObject({ pendientes: 2, conGrado: 2, a: 0 })
    expect(b12).toMatchObject({ pendientes: 1, conGrado: 1 })
    expect(a13).toMatchObject({ pendientes: 5, a: 1, gradosA: ['A+'], conGrado: 1 })
    expect(tituloA(a13)).toBe('1 A+')
    expect(tituloA(e14)).toBe('Ningún A')
  })

  it('los móviles de un grupo: solo los sin grado, los de más días primero', () => {
    const [p15, , , , n16] = listaRevisar(STOCK)
    expect(p15.moviles.map((x) => x.dias)).toEqual([41, 23, 12, 5])
    expect(n16.moviles.map((x) => x.grado)).toEqual(['', 'n/a'])
  })

  it('las cifras de la tarjeta: modelos-color con algo pendiente y sus móviles (el que solo tiene el técnico no cuenta)', () => {
    expect(cifraRevisar(listaRevisar(STOCK))).toEqual({ grupos: 8, moviles: 19 })
    expect(textoCifra({ grupos: 8, moviles: 19 })).toBe('modelos-color · 19 móviles')
    expect(textoCifra({ grupos: 1, moviles: 1 })).toBe('modelo-color · 1 móvil')
  })

  it('sin capacidad ni color, la descripción solo dice el modelo', () => {
    expect(descripcion(listaRevisar([m({ capacidad: null, color: null, grado: 'n/a' })])[0])).toBe('iPhone 13')
  })

  it('«Copiar lista»: lo pendiente, en el orden de la tabla', () => {
    expect(textoRevisar(listaRevisar(STOCK))).toBe([
      '🔍 REVISAR PRIORITARIO\niPhone 15 Pro 256 GB Titanio natural\nSin grado: 3 · Nada con grado',
      '🔍 REVISAR PRIORITARIO\niPhone 13 Pro 256 GB Grafito\nSin grado: 3 · Nada con grado',
      '🔍 REVISAR PRIORITARIO\niPhone 13 Pro 1 TB Plata\nSin grado: 1 · Nada con grado',
      '🔍 REVISAR PRIORITARIO\niPhone 16 128 GB Negro\nSin grado: 2 · Ningún A',
      '🔍 REVISAR PRIORITARIO\niPhone 14 eSIM 128 GB Medianoche\nSin grado: 2 · Ningún A',
      '🔍 REVISAR PRIORITARIO\niPhone 12 64 GB Blanco\nSin grado: 1 · Ningún A',
      '🔍 REVISAR PRIORITARIO\niPhone 13 128 GB Azul\nSin grado: 5 · Solo 1 A',
      '🔍 REVISAR PRIORITARIO\niPhone 11 64 GB Negro\nSin grado: 2 · Solo 1 A',
    ].join('\n\n'))
  })

  it('del mismo modelo, el físico antes que el eSIM aunque tenga más capacidad', () => {
    expect(listaRevisar([m({ ...E14, grado: 'n/a' }), m({ ...F14, capacidad: '256GB', grado: 'n/a' })]).map(descripcion))
      .toEqual(['iPhone 14 256 GB Medianoche', 'iPhone 14 eSIM 128 GB Medianoche'])
  })
})

describe('«Qué revisar»: Subir B a A (spec 0.9.25 §2.5)', () => {
  it('B y B100 de modelos con 0 o 1 A, en el orden de los modelos; el MsB no sale', () => {
    const lista = listaSubir(STOCK)
    expect(lista.map(descripcion)).toEqual(['iPhone 14 eSIM 128 GB Medianoche', 'iPhone 13 512 GB Azul', 'iPhone 11 64 GB Negro'])
    expect(lista.map(({ b, bTecnico, b100, b100Tecnico }) => [b, bTecnico, b100, b100Tecnico])).toEqual([[0, 0, 1, 0], [1, 1, 0, 0], [1, 0, 1, 0]])
    expect(lista[2].moviles.map(pasoSubir)).toEqual(['B → A', 'B100 → A100'])
    expect(cifraSubir(lista)).toEqual({ grupos: 3, moviles: 4 })
    expect(totalQueRevisar(listaRevisar(STOCK), lista)).toBe(11)
  })

  it('«Copiar lista»: sin la parte que valga 0 y sin el del técnico', () => {
    expect(textoSubir(listaSubir(STOCK))).toBe([
      '⬆️ SUBIR DE GRADO\niPhone 14 eSIM 128 GB Medianoche\nB100 → A100: 1',
      '⬆️ SUBIR DE GRADO\niPhone 13 512 GB Azul\nB → A: 1',
      '⬆️ SUBIR DE GRADO\niPhone 11 64 GB Negro\nB → A: 1 · B100 → A100: 1',
    ].join('\n\n'))
  })
})

describe('«Qué revisar»: buscar por palabras clave (spec 0.9.25 §3.6)', () => {
  // SKU e IMEI puestos a mano: la fábrica les da a todos el SKU «i13128AzulA».
  const BUSCA: Movil[] = [
    m({ ...A13, grado: 'n/a', sku: null, imeiSn: '350000000012345' }), m({ ...A13, grado: 'A+', sku: 'i13128AzulA+' }),
    m({ ...N11, grado: 'n/a', sku: null }), m({ ...N11, grado: 'B', sku: 'i1164NegroB' }),
    m({ ...P13P, grado: 'n/a', sku: null }), m({ ...E14, grado: 'n/a', sku: null }),
    m({ ...P15, color: 'Púrpura', grado: 'n/a', sku: null }),
  ]
  const busca = (texto: string) => filtrar(listaRevisar(BUSCA), palabrasClave(texto)).map(descripcion)

  it('las palabras clave: sin mayúsculas, sin acentos y sin espacios de más', () => {
    expect(palabrasClave('  13 Pro   256 ')).toEqual(['13', 'pro', '256'])
    expect(palabrasClave('Púrpura')).toEqual(['purpura'])
    expect(palabrasClave('   ')).toEqual([])
  })

  it('sin palabras, todos en su orden; cada palabra tiene que estar en la descripción (también «1tb», «128gb», «esim» o sin acento)', () => {
    expect(busca('')).toEqual([
      'iPhone 15 Pro 256 GB Púrpura', 'iPhone 14 eSIM 128 GB Medianoche', 'iPhone 13 Pro 1 TB Plata', 'iPhone 11 64 GB Negro',
      'iPhone 13 128 GB Azul',
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
    expect(filtrar(listaSubir(BUSCA), palabrasClave('negro')).map(descripcion)).toEqual(['iPhone 11 64 GB Negro'])
  })

  it('por el IMEI de un móvil de la lista, solo con 6 caracteres o más', () => {
    expect(busca('012345')).toEqual(['iPhone 13 128 GB Azul'])
    expect(busca('2345')).toEqual([])
    const [a13] = filtrar(listaRevisar(BUSCA), ['012345'])
    expect(a13.moviles.filter((x) => imeiBuscado(x, ['012345'])).map((x) => x.imeiSn)).toEqual(['350000000012345'])
    expect(coincide(a13, ['2345'])).toBe(false)
  })

  it('el texto sin coincidencias', () => {
    expect(sinCoincidencias('  13 negro ')).toBe('Ningún modelo-color con «13 negro».')
  })
})
