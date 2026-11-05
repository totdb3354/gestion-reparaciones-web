import { describe, expect, it } from 'vitest'
import type { MovilStock } from '@/shared/api/client'
import { movilVendido, trabajo, visto } from '../test/fabrica'
import type { Movil } from './modelo'
import {
  avisoDescargado, cabeceraPedidos, cifraRevisar, cifraSubir, coincide, descripcion, esA, esB, excelRevisar, excelSubir, filtrar,
  imeiBuscado, listaRevisar, listaSubir, MAX_A, movilesExcel, nombreExcel, palabrasClave, pasoSubir, sinCoincidencias,
  textoCifra, tieneGrado, tituloA, tituloPedidos, totalQueRevisar,
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

describe('«Qué revisar»: Revisar sin grado (spec 0.9.25 §10.1, §2.6 y §2.7)', () => {
  it('todos los modelos-color con algo sin grado, también con 2 A («Con A»); sin pedidos, los de más pendientes primero, después por motivo y por modelo; fuera lo que no es stock', () => {
    expect(listaRevisar(STOCK).map((g) => [g.motivo, descripcion(g)])).toEqual([
      ['UN_A', 'iPhone 13 128 GB Azul'],
      ['NADA', 'iPhone 15 Pro 256 GB Titanio natural'],
      ['NADA', 'iPhone 13 Pro 256 GB Grafito'],
      ['NINGUN_A', 'iPhone 16 128 GB Negro'],
      ['NINGUN_A', 'iPhone 14 eSIM 128 GB Medianoche'],
      ['UN_A', 'iPhone 11 64 GB Negro'],
      ['CON_A', 'iPhone 13 Mini 128 GB Rosa'],
      ['NADA', 'iPhone 13 Pro 1 TB Plata'],
      ['NINGUN_A', 'iPhone 12 64 GB Blanco'],
      ['NADA', 'iPhone 12 Pro 128 GB Grafito'],
    ])
  })

  it('las cuentas: pendientes sin los del técnico, A en stock y con grado (vacío y «NR» sin grado; F, ID y MsB con grado)', () => {
    const [a13, p15, g13p, n16, e14, , r13m, , b12, g12p] = listaRevisar(STOCK)
    expect(p15).toMatchObject({ pendientes: 3, conTecnico: 1, a: 0, conGrado: 0, vendidos: 0, dePedido: 0, pedidos: 0 })
    expect(g13p).toMatchObject({ pendientes: 3, conTecnico: 0, conGrado: 0 })
    expect(g12p).toMatchObject({ pendientes: 0, conTecnico: 1 })
    expect(n16).toMatchObject({ pendientes: 2, conGrado: 1, a: 0 })
    expect(e14).toMatchObject({ pendientes: 2, conGrado: 2, a: 0 })
    expect(b12).toMatchObject({ pendientes: 1, conGrado: 1 })
    expect(a13).toMatchObject({ pendientes: 5, a: 1, gradosA: ['A+'], conGrado: 1 })
    expect(r13m).toMatchObject({ motivo: 'CON_A', pendientes: 2, a: 2, gradosA: ['A', 'A'], conGrado: 2 })
    expect(tituloA(a13)).toBe('1 A+')
    expect(tituloA(e14)).toBe('Ningún A')
  })

  it('los móviles de un grupo: solo los sin grado, los de más días primero', () => {
    const [, p15, , n16] = listaRevisar(STOCK)
    expect(p15.moviles.map((x) => x.dias)).toEqual([41, 23, 12, 5])
    expect(n16.moviles.map((x) => x.grado)).toEqual(['', 'n/a'])
  })

  it('las cifras de la tarjeta: modelos-color con algo pendiente y sus móviles (el que solo tiene el técnico no cuenta)', () => {
    expect(cifraRevisar(listaRevisar(STOCK))).toEqual({ grupos: 9, moviles: 21 })
    expect(textoCifra({ grupos: 9, moviles: 21 })).toBe('modelos-color · 21 móviles')
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

describe('«Qué revisar»: «Pedidos 15 d» (spec 0.9.25 §10.2)', () => {
  // E14: 3 vendidos. B12: 1 vendido y 1 de pedido (que también sale vendido: cuenta una vez). A13: 3 sin grado y nada pedido.
  const PEDIDOS: Movil[] = [
    m({ ...A13, grado: 'n/a' }), m({ ...A13, grado: 'n/a' }), m({ ...A13, grado: 'n/a' }),
    m({ ...B12, grado: 'n/a' }), m({ ...B12, grado: 'A', estado: 'DE_PEDIDO', imeiSn: '350000000099001' }),
    m({ ...E14, grado: 'n/a' }),
  ]
  const VENDIDOS = [
    movilVendido({ ...B12, imeiSn: '350000000099002' }), movilVendido({ ...B12, imeiSn: '350000000099001' }),
    movilVendido({ ...E14, imeiSn: '350000000099003' }), movilVendido({ ...E14, imeiSn: '350000000099004' }),
    movilVendido({ ...E14, imeiSn: '350000000099005' }), movilVendido({ ...F14, imeiSn: '350000000099006' }),
  ]

  it('los vendidos de su modelo-color (el eSIM aparte) más los de pedido van primero; después, los pendientes', () => {
    const lista = listaRevisar(PEDIDOS, VENDIDOS)
    expect(lista.map((g) => [descripcion(g), g.vendidos, g.dePedido, g.pedidos])).toEqual([
      ['iPhone 14 eSIM 128 GB Medianoche', 3, 0, 3],
      ['iPhone 12 64 GB Blanco', 1, 1, 2],
      ['iPhone 13 128 GB Azul', 0, 0, 0],
    ])
    expect(tituloPedidos(lista[0], false)).toBe('3 vendidos + 0 de pedido')
    expect(tituloPedidos(lista[1], false)).toBe('1 vendido + 1 de pedido')
  })

  it('un IMEI vendido y uno de pedido se comparan sin mayúsculas ni espacios, como en el servidor: cuenta una vez, como de pedido', () => {
    const lista = listaRevisar(
      [m({ ...B12, grado: 'n/a' }), m({ ...B12, grado: 'A', estado: 'DE_PEDIDO', imeiSn: ' ABC123' })],
      [movilVendido({ ...B12, imeiSn: 'abc123' })],
    )
    expect([lista[0].vendidos, lista[0].dePedido, lista[0].pedidos]).toEqual([0, 1, 1])
  })

  it('un vendido que hoy está en stock sigue contando como vendido (fue una venta)', () => {
    const enStock = m({ ...B12, grado: 'n/a', estado: 'STOCK', imeiSn: '350000000099777' })
    const lista = listaRevisar([enStock], [movilVendido({ ...B12, imeiSn: '350000000099777' })])
    expect([lista[0].vendidos, lista[0].dePedido, lista[0].pedidos]).toEqual([1, 0, 1])
  })

  it('sin las ventas cuentan solo los de pedido, y la cabecera y el título lo dicen', () => {
    const lista = listaRevisar(PEDIDOS)
    expect(lista.map(descripcion)).toEqual(['iPhone 12 64 GB Blanco', 'iPhone 13 128 GB Azul', 'iPhone 14 eSIM 128 GB Medianoche'])
    expect(tituloPedidos(lista[0], true)).toBe('1 de pedido (sin ventas)')
    expect(cabeceraPedidos(false)).toBe('Pedidos 15 d')
    expect(cabeceraPedidos(true)).toBe('Pedidos 15 d (sin ventas)')
  })
})

describe('«Qué revisar»: Subir B a A (spec 0.9.25 §2.5)', () => {
  it('B y B100 de modelos con 0 o 1 A, en el orden de los modelos; el MsB no sale', () => {
    const lista = listaSubir(STOCK)
    expect(lista.map(descripcion)).toEqual(['iPhone 14 eSIM 128 GB Medianoche', 'iPhone 13 512 GB Azul', 'iPhone 11 64 GB Negro'])
    expect(lista.map(({ b, bTecnico, b100, b100Tecnico }) => [b, bTecnico, b100, b100Tecnico])).toEqual([[0, 0, 1, 0], [1, 1, 0, 0], [1, 0, 1, 0]])
    expect(lista[2].moviles.map(pasoSubir)).toEqual(['B → A', 'B100 → A100'])
    expect(cifraSubir(lista)).toEqual({ grupos: 3, moviles: 4 })
    expect(totalQueRevisar(listaRevisar(STOCK), lista)).toBe(12)
  })
})

describe('«Qué revisar»: el Excel (spec 0.9.25 §10.3)', () => {
  it('«Revisar sin grado»: una fila por móvil, en el orden de la tabla, sin los del técnico y con «Revisado» vacía', () => {
    const lista = listaRevisar([
      m({ ...P15, grado: 'n/a', dias: 12, imeiSn: '350000000000201' }),
      m({ ...P15, grado: 'n/a', dias: 41, imeiSn: '350000000000202', ubicacion: 'En revisión' }),
      m({ ...P15, grado: 'n/a', dias: 23, imeiSn: '350000000000203', trabajos: [trabajo({ tecnico: 'Técnico A' })] }),
      m({ ...P15, grado: 'n/a', dias: null, imeiSn: '350000000000204' }),
      m({ ...P15, grado: 'n/a', estado: 'DE_PEDIDO', imeiSn: '350000000000205' }),
    ], [movilVendido({ ...P15, imeiSn: '350000000000206' })])
    expect(excelRevisar(lista, false)).toEqual({
      hoja: 'Revisar sin grado',
      columnas: ['Modelo', 'Capacidad', 'Color', 'IMEI', 'Ubicación', 'Días en stock', 'Pedidos 15 d', 'Revisado'],
      filas: [
        ['iPhone 15 Pro', '256 GB', 'Titanio natural', '350000000000202', 'En revisión', '41', '2', ''],
        ['iPhone 15 Pro', '256 GB', 'Titanio natural', '350000000000201', 'Listos', '12', '2', ''],
        ['iPhone 15 Pro', '256 GB', 'Titanio natural', '350000000000204', 'Listos', '—', '2', ''],
      ],
    })
    expect(movilesExcel(lista)).toBe(3)
    expect(excelRevisar(lista, true).columnas[6]).toBe('Pedidos 15 d (sin ventas)')
  })

  it('«Subir B a A»: una fila por móvil con su paso y «Hecho» vacía', () => {
    const lista = listaSubir([
      m({ ...N11, grado: 'B', dias: 25, imeiSn: '350000000000301' }),
      m({ ...N11, grado: 'B', bateriaNueva: true, dias: 11, imeiSn: '350000000000302', ubicacion: 'Taller · Pulir',
        trabajos: [trabajo({ categoria: 'PULIDO', tecnico: 'Técnico C' })] }),
      m({ ...N11, grado: 'B', bateriaNueva: true, dias: 30, imeiSn: '350000000000303' }),
      m({ ...N11, grado: 'A' }),
    ])
    expect(excelSubir(lista)).toEqual({
      hoja: 'Subir B a A',
      columnas: ['Modelo', 'Capacidad', 'Color', 'IMEI', 'Paso', 'Ubicación', 'Días en stock', 'Hecho'],
      filas: [
        ['iPhone 11', '64 GB', 'Negro', '350000000000303', 'B100 → A100', 'Listos', '30', ''],
        ['iPhone 11', '64 GB', 'Negro', '350000000000301', 'B → A', 'Listos', '25', ''],
      ],
    })
    expect(movilesExcel(lista)).toBe(2)
  })

  it('el nombre del fichero lleva el día de Madrid, y el aviso cuántos móviles', () => {
    expect(nombreExcel('revisar', new Date('2026-11-04T23:30:00Z'))).toBe('Que_revisar_sin_grado_2026-11-05.xlsx')
    expect(nombreExcel('subir', new Date('2026-11-04T10:00:00Z'))).toBe('Que_revisar_subir_B_a_A_2026-11-04.xlsx')
    expect(avisoDescargado(1)).toBe('Descargado: 1 móvil')
    expect(avisoDescargado(12)).toBe('Descargado: 12 móviles')
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
