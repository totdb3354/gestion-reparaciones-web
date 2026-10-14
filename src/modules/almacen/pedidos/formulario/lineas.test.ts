import { describe, expect, it } from 'vitest'
import { COMPONENTES, preventiva, urgente } from './datosPrueba'
import type { Componente } from '@/shared/api/client'
import {
  aplicarPrevision, avisoSinPedido, avisoSinLista, avisoNadaQuePedir, sinLista, cuantasPrevision, avisoOmitidas, cambiarLinea, cuerpoLoteCompras, cuerpoLoteOtros, lineaCompraVacia, lineaOtroVacia, precargaInicial,
  cantidadPrevista, elegirPieza, loQueFalta, avisoRepetida, ponerCantidadesPrevistas,
  precargarComponentes, precargarSolicitudes, quitarLinea, siguienteId, textoDescartar, validarLineasCompra, validarLineasOtro,
  type LineaCompra, type LineaOtro,
} from './lineas'

const completa = (cambio: Partial<LineaCompra> = {}): LineaCompra => ({ id: 1, idCom: 2, idProv: 1, cantidad: '2', precio: '12,5', urgente: false, ...cambio })
const otra = (cambio: Partial<LineaOtro> = {}): LineaOtro => ({ id: 1, concepto: 'Cinta de embalar', idProv: 1, cantidad: '3', precio: '1,5', urgente: false, ...cambio })

describe('líneas vacías', () => {
  it('cantidad 1, precio 0,00, sin proveedor ni urgente; la de compra admite un componente', () => {
    expect(lineaCompraVacia(3)).toEqual({ id: 3, idCom: null, idProv: null, cantidad: '1', precio: '0,00', urgente: false })
    expect(lineaCompraVacia(4, 2)).toEqual({ id: 4, idCom: 2, idProv: null, cantidad: '1', precio: '0,00', urgente: false })
    expect(lineaOtroVacia(1)).toEqual({ id: 1, concepto: '', idProv: null, cantidad: '1', precio: '0,00', urgente: false })
  })
})

describe('precargas', () => {
  it('precargarComponentes: una línea por id, en orden, con el componente y cantidad 1', () => {
    expect(precargarComponentes([2, 1, 5], COMPONENTES)).toEqual([lineaCompraVacia(1, 2), lineaCompraVacia(2, 1), lineaCompraVacia(3, 2)])
  })
  it('precargarComponentes: un slave lleva el id de su master; un slave con el master inactivo queda vacío', () => {
    expect(precargarComponentes([5], COMPONENTES)).toEqual([lineaCompraVacia(1, 2)])
    const inactivo = COMPONENTES.map((c) => (c.idCom === 2 ? { ...c, activo: false } : c))
    expect(precargarComponentes([5], inactivo)).toEqual([lineaCompraVacia(1)])
  })
  it('precargarComponentes: un slave cuyo master es a su vez slave (cadena) no es pedible: línea vacía', () => {
    const cadena = [...COMPONENTES, { ...COMPONENTES[3], idCom: 6, tipo: 'bat-z', idComMaster: 5 }]
    expect(precargarComponentes([6], cadena)).toEqual([lineaCompraVacia(1)])
  })
  it('precargarComponentes: inactivo o desconocido → línea vacía (calco)', () => {
    expect(precargarComponentes([4, 99], COMPONENTES)).toEqual([lineaCompraVacia(1), lineaCompraVacia(2)])
  })
  it('precargarSolicitudes: agrupa por componente, urgentes primero y en su orden, cantidad = nº de solicitudes; cuenta las omitidas', () => {
    const r = precargarSolicitudes(
      [urgente(10, 2), urgente(11, 1), urgente(12, 2), urgente(13, 4)],
      [preventiva(20, 5), preventiva(21, 1), preventiva(22, 4)],
      COMPONENTES,
    )
    expect(r.lineas).toEqual([
      { ...lineaCompraVacia(1, 2), cantidad: '3' },
      { ...lineaCompraVacia(2, 1), cantidad: '2' },
    ])
    expect(r.omitidas).toBe(2)
  })
  it('precargarSolicitudes: master y slave del mismo grupo se juntan en una línea con la suma, en el orden de la primera aparición', () => {
    const r = precargarSolicitudes([urgente(10, 1), urgente(11, 5)], [preventiva(20, 2)], COMPONENTES)
    expect(r.lineas).toEqual([{ ...lineaCompraVacia(1, 1), cantidad: '1' }, { ...lineaCompraVacia(2, 2), cantidad: '2' }])
    expect(r.omitidas).toBe(0)
  })
  it('precargarSolicitudes: sin inactivos no omite nada; listas vacías → sin líneas', () => {
    expect(precargarSolicitudes([urgente(10, 1)], [], COMPONENTES)).toEqual({ lineas: [lineaCompraVacia(1, 1)], omitidas: 0 })
    expect(precargarSolicitudes([], [], COMPONENTES)).toEqual({ lineas: [], omitidas: 0 })
  })
  it('precargaInicial: vacío sin líneas; componentes y solicitudes delegan', () => {
    expect(precargaInicial({ modo: 'vacio' }, COMPONENTES)).toEqual({ lineas: [], omitidas: 0 })
    expect(precargaInicial({ modo: 'componentes', idsCom: [1] }, COMPONENTES)).toEqual({ lineas: [lineaCompraVacia(1, 1)], omitidas: 0 })
    expect(precargaInicial({ modo: 'solicitudes', urgentes: [urgente(10, 4)], preventivas: [preventiva(20, 2)] }, COMPONENTES))
      .toEqual({ lineas: [lineaCompraVacia(1, 2)], omitidas: 1 })
  })
  it('avisoOmitidas: texto de D10 con n > 0; null con 0', () => {
    expect(avisoOmitidas(2)).toBe('2 solicitud(es) de componentes desactivados no se han añadido y siguen pendientes.')
    expect(avisoOmitidas(0)).toBeNull()
  })
})

describe('validarLineasCompra', () => {
  it('sin líneas: "Añade al menos una línea."', () => {
    expect(validarLineasCompra([])).toBe('Añade al menos una línea.')
  })
  it('por línea, en orden: componente → proveedor → cantidad → precio', () => {
    const mala: LineaCompra = { id: 1, idCom: null, idProv: null, cantidad: '0', precio: '-1', urgente: false }
    expect(validarLineasCompra([mala])).toBe('Línea 1: selecciona un componente.')
    expect(validarLineasCompra([{ ...mala, idCom: 2 }])).toBe('Línea 1: selecciona un proveedor.')
    expect(validarLineasCompra([{ ...mala, idCom: 2, idProv: 1 }])).toBe('Línea 1: la cantidad debe ser mayor que 0.')
    expect(validarLineasCompra([{ ...mala, idCom: 2, idProv: 1, cantidad: '2' }])).toBe('Línea 1: el precio no puede ser negativo.')
    expect(validarLineasCompra([completa()])).toBeNull()
  })
  it('cantidad: "0", "abc", "" y "1,5" fallan; precio: "-1" y "abc" fallan, "0" y "12,5" pasan', () => {
    for (const cantidad of ['0', 'abc', '', '1,5']) expect(validarLineasCompra([completa({ cantidad })])).toBe('Línea 1: la cantidad debe ser mayor que 0.')
    for (const precio of ['-1', 'abc']) expect(validarLineasCompra([completa({ precio })])).toBe('Línea 1: el precio no puede ser negativo.')
    for (const precio of ['0', '12,5', '12.5', '0,00']) expect(validarLineasCompra([completa({ precio })])).toBeNull()
  })
  it('para en la primera línea que falla, con su número (1-based)', () => {
    expect(validarLineasCompra([completa(), completa({ id: 2, idProv: null }), completa({ id: 3, idCom: null })])).toBe('Línea 2: selecciona un proveedor.')
  })
})

describe('validarLineasOtro', () => {
  it('concepto en blanco (tras trim) primero; después proveedor, cantidad y precio con los textos de siempre', () => {
    expect(validarLineasOtro([])).toBe('Añade al menos una línea.')
    expect(validarLineasOtro([otra({ concepto: '   ', idProv: null })])).toBe('Línea 1: el concepto no puede estar vacío.')
    expect(validarLineasOtro([otra({ idProv: null })])).toBe('Línea 1: selecciona un proveedor.')
    expect(validarLineasOtro([otra({ cantidad: '0' })])).toBe('Línea 1: la cantidad debe ser mayor que 0.')
    expect(validarLineasOtro([otra({ precio: '-0,5' })])).toBe('Línea 1: el precio no puede ser negativo.')
    expect(validarLineasOtro([otra()])).toBeNull()
  })
})

describe('cuerpos de lote', () => {
  it('cuerpoLoteCompras: convierte los textos ("12,5" → 12.5, "3" → 3) y lleva solo las solicitudes cuyo componente tiene línea', () => {
    const lineas = [completa({ idCom: 2, cantidad: '3', urgente: true }), completa({ id: 2, idCom: 5, idProv: 2, cantidad: '1', precio: '0' })]
    const origen = { urgentes: [urgente(10, 2), urgente(11, 1), urgente(12, 2)], preventivas: [preventiva(20, 5), preventiva(21, 1)] }
    expect(cuerpoLoteCompras(lineas, origen, COMPONENTES)).toEqual({
      lineas: [
        { idCom: 2, idProv: 1, cantidad: 3, esUrgente: true, precioUnidad: 12.5 },
        { idCom: 5, idProv: 2, cantidad: 1, esUrgente: false, precioUnidad: 0 },
      ],
      solicitudes: { urgentes: [10, 12], preventivas: [20] },
      destinos: null,
    })
  })
  it('cuerpoLoteCompras: las solicitudes de un slave viajan si su master tiene línea y no si su grupo no tiene ninguna', () => {
    const origen = { urgentes: [urgente(10, 5), urgente(11, 1)], preventivas: [preventiva(20, 5), preventiva(21, 1)] }
    expect(cuerpoLoteCompras([completa({ idCom: 2 })], origen, COMPONENTES).solicitudes).toEqual({ urgentes: [10], preventivas: [20] })
    expect(cuerpoLoteCompras([completa({ idCom: 1 })], origen, COMPONENTES).solicitudes).toEqual({ urgentes: [11], preventivas: [21] })
  })
  it('cuerpoLoteCompras: sin origen, solicitudes vacías', () => {
    expect(cuerpoLoteCompras([completa()], null, COMPONENTES).solicitudes).toEqual({ urgentes: [], preventivas: [] })
  })
  it('cuerpoLoteOtros: concepto recortado y números convertidos', () => {
    expect(cuerpoLoteOtros([otra({ concepto: '  Cinta de embalar  ', urgente: true })])).toEqual({
      lineas: [{ idProv: 1, concepto: 'Cinta de embalar', cantidad: 3, esUrgente: true, precioUnidad: 1.5 }],
    })
  })
})

describe('edición de la lista', () => {
  it('cambiarLinea cambia solo esa línea; quitarLinea la quita; siguienteId = máximo + 1 (1 con la lista vacía)', () => {
    const ls = [lineaCompraVacia(1), lineaCompraVacia(3)]
    expect(cambiarLinea(ls, 3, { idProv: 2 })).toEqual([lineaCompraVacia(1), { ...lineaCompraVacia(3), idProv: 2 }])
    expect(quitarLinea(ls, 1)).toEqual([lineaCompraVacia(3)])
    expect(siguienteId(ls)).toBe(4)
    expect(siguienteId([])).toBe(1)
  })
})

describe('textoDescartar', () => {
  it('singular con una línea y plural con N', () => {
    expect(textoDescartar(1)).toBe('Se descartará la línea del pedido.')
    expect(textoDescartar(3)).toBe('Se descartarán las 3 líneas del pedido.')
  })
})

describe('pedido automático (spec 0.9.6 §4.4)', () => {
  const comp = (o: Partial<Componente>): Componente => ({
    idCom: 1, tipo: 'x', fechaRegistro: '2026-09-01T10:00:00', updatedAt: '2026-09-01T10:00:00', stock: 0, stockMinimo: 1,
    activo: true, enCamino: 0, ultimoPedido: null, idComMaster: null, consumoDiario: 0.3, pedir60: 0, autoPedido: false, pendiente: null, proveedores: null, ...o,
  })
  // lcd (1) marcada y pide 16; bat (2) marcada sin pedido; cam (3) sin marcar; bat-y (5) slave de bat, hereda la marca.
  const ACTIVOS = [
    comp({ idCom: 1, tipo: 'lcd', autoPedido: true, pedir60: 16, proveedores: [7] }),
    comp({ idCom: 2, tipo: 'bat', autoPedido: true, pedir60: 0, proveedores: [7] }),
    comp({ idCom: 3, tipo: 'cam', autoPedido: false, pedir60: 9 }),
    comp({ idCom: 5, tipo: 'bat-y', autoPedido: true, pedir60: 0, proveedores: [7], idComMaster: 2 }),
  ]

  it('cuenta las marcadas que necesitan pedido, una vez por grupo', () => {
    expect(cuantasPrevision(ACTIVOS, 7)).toBe(1)
    expect(cuantasPrevision([...ACTIVOS, comp({ idCom: 6, tipo: 'mc', autoPedido: true, pedir60: 2, proveedores: [7] })], 7)).toBe(2)
  })

  it('añade las marcadas sin línea con su cantidad y el proveedor general, y salta las que no necesitan pedido', () => {
    const r = aplicarPrevision([], ACTIVOS, 7)
    expect(r.lineas).toEqual([{ id: 1, idCom: 1, idProv: 7, cantidad: '16', precio: '0,00', urgente: false }])
    expect(r.sinPedido).toBe(1)
  })

  it('en una línea suya o de «Por repartir» sube la cantidad sin bajarla, y la de «Por repartir» pasa a este proveedor; la de otro proveedor no se toca (2026-10-13)', () => {
    const lineas: LineaCompra[] = [
      { id: 1, idCom: 1, idProv: null, cantidad: '3', precio: '0,00', urgente: true },
      { id: 2, idCom: 2, idProv: 9, cantidad: '4', precio: '1,50', urgente: false },
      { id: 3, idCom: 3, idProv: null, cantidad: '1', precio: '0,00', urgente: false },
    ]
    const r = aplicarPrevision(lineas, ACTIVOS, 7)
    expect(r.lineas).toEqual([
      { id: 1, idCom: 1, idProv: 7, cantidad: '16', precio: '0,00', urgente: true },
      { id: 2, idCom: 2, idProv: 9, cantidad: '4', precio: '1,50', urgente: false },
      { id: 3, idCom: 3, idProv: null, cantidad: '1', precio: '0,00', urgente: false },
    ])
    // bat (2) ya va a otro proveedor (9) y su previsión es 0: a este no le falta nada.
    expect(r.sinPedido).toBe(1)
  })

  it('una cantidad no válida en una línea marcada pasa a la previsión, o a 1 si la previsión es 0', () => {
    const r = aplicarPrevision([
      { id: 1, idCom: 1, idProv: 7, cantidad: 'abc', precio: '0,00', urgente: false },
      { id: 2, idCom: 2, idProv: 7, cantidad: '', precio: '0,00', urgente: false },
    ], ACTIVOS, 7)
    expect(r.lineas.map((l) => l.cantidad)).toEqual(['16', '1'])
  })

  it('pulsar dos veces deja lo mismo', () => {
    const una = aplicarPrevision([], ACTIVOS, 7)
    expect(aplicarPrevision(una.lineas, ACTIVOS, 7)).toEqual(una)
  })

  it('las desactivadas y las no marcadas no entran', () => {
    const desactivada = comp({ idCom: 4, activo: false, autoPedido: true, pedir60: 5, proveedores: [7] })
    expect(aplicarPrevision([], [desactivada, comp({ idCom: 3, autoPedido: false, pedir60: 9 })], 7)).toEqual({ lineas: [], sinPedido: 0 })
    expect(cuantasPrevision([desactivada], 7)).toBe(0)
  })

  it('aviso de las marcadas sin pedido', () => {
    expect(avisoSinPedido(0)).toBeNull()
    expect(avisoSinPedido(1)).toBe('1 pieza marcada no necesita pedido.')
    expect(avisoSinPedido(3)).toBe('3 piezas marcadas no necesitan pedido.')
  })
})

describe('previsión por proveedor (spec 2026-10-11 §5.2)', () => {
  const c = (idCom: number, extra: Partial<Componente>): Componente => ({ ...COMPONENTES[0], idCom, tipo: `p-${idCom}`, idComMaster: null, activo: true, ...extra })
  const ACTIVOS: Componente[] = [
    c(1, { autoPedido: true, pedir60: 16, proveedores: [1] }),
    c(2, { autoPedido: true, pedir60: 0, proveedores: [1, 2] }),
    c(3, { autoPedido: true, pedir60: 4, proveedores: [2] }),
    c(4, { autoPedido: true, pedir60: 5, proveedores: [] }),
    c(5, { autoPedido: false, pedir60: 9, proveedores: [1] }),
    c(6, { autoPedido: true, pedir60: 7, proveedores: null }),
  ]

  it('N cuenta solo las marcadas de la lista del proveedor con algo que pedir; sin proveedor, 0', () => {
    expect(cuantasPrevision(ACTIVOS, 1)).toBe(1)
    expect(cuantasPrevision(ACTIVOS, 2)).toBe(1)
    expect(cuantasPrevision(ACTIVOS, null)).toBe(0)
  })

  it('aplicarPrevision solo añade las del proveedor, con él y su cantidad, y cuenta las que no necesitan pedido', () => {
    const r = aplicarPrevision([], ACTIVOS, 1)
    expect(r.lineas).toEqual([{ ...lineaCompraVacia(1, 1), idProv: 1, cantidad: '16' }])
    expect(r.sinPedido).toBe(1)
  })

  it('sinLista cuenta las marcadas con algo que pedir y la lista vacía (no las que no traen lista)', () => {
    expect(sinLista(ACTIVOS)).toBe(1)
  })

  it('avisos', () => {
    expect(avisoSinLista(0)).toBeNull()
    expect(avisoSinLista(1)).toBe('1 pieza en Auto con algo que pedir no está en la lista de ningún proveedor.')
    expect(avisoSinLista(3)).toBe('3 piezas en Auto con algo que pedir no están en la lista de ningún proveedor.')
    expect(avisoNadaQuePedir('ACME')).toBe('Nada que pedir a ACME según la previsión.')
  })
})

describe('cantidad prevista y piezas repetidas (0.9.9, 2026-10-13)', () => {
  // lcd-x-negro (1) pide 16; bat-x (2) no pide nada; bat-y (5) es slave de bat-x.
  const ACTIVOS: Componente[] = COMPONENTES.map((c) => (c.idCom === 1 ? { ...c, pedir60: 16 } : { ...c, pedir60: 0 }))

  it('cantidadPrevista: «Pedir 60 d» si es > 0; si no, null', () => {
    expect(cantidadPrevista(1, ACTIVOS)).toBe(16)
    expect(cantidadPrevista(2, ACTIVOS)).toBeNull()
    expect(cantidadPrevista(99, ACTIVOS)).toBeNull()
    expect(cantidadPrevista(1, COMPONENTES)).toBeNull()            // sin previsión calculada (pedir60 ausente)
  })

  it('elegir una pieza con previsión pone su cantidad si la línea seguía con el 1 de entrada', () => {
    const r = elegirPieza([lineaCompraVacia(1)], 1, 1, ACTIVOS)
    expect(r.repetida).toBeNull()
    expect(r.lineas).toEqual([{ ...lineaCompraVacia(1), idCom: 1, cantidad: '16' }])
  })

  it('con la cantidad ya cambiada, o sin previsión, solo cambia la pieza', () => {
    expect(elegirPieza([{ ...lineaCompraVacia(1), cantidad: '3' }], 1, 1, ACTIVOS).lineas[0]).toMatchObject({ idCom: 1, cantidad: '3' })
    expect(elegirPieza([lineaCompraVacia(1)], 1, 2, ACTIVOS).lineas[0]).toMatchObject({ idCom: 2, cantidad: '1' })
  })

  it('una pieza que ya está en otra línea: se quita la línea nueva y se devuelve la que queda con su número', () => {
    const lineas = [{ ...lineaCompraVacia(1, 1), cantidad: '16' }, lineaCompraVacia(2, 2), lineaCompraVacia(3)]
    const r = elegirPieza(lineas, 3, 1, ACTIVOS)
    expect(r.lineas.map((l) => l.id)).toEqual([1, 2])
    expect(r.lineas[0].cantidad).toBe('16')
    expect(r.repetida).toEqual({ id: 1, n: 1 })
    // Cambiar la pieza de una línea a otra que ya estaba, igual; el número es el de la línea que queda tras quitar.
    const r2 = elegirPieza(lineas, 1, 2, ACTIVOS)
    expect(r2.lineas.map((l) => l.id)).toEqual([2, 3])
    expect(r2.repetida).toEqual({ id: 2, n: 1 })
  })

  it('elegir en una línea la pieza que ya tenía no es repetida', () => {
    const r = elegirPieza([{ ...lineaCompraVacia(1, 1), cantidad: '4' }], 1, 1, ACTIVOS)
    expect(r.repetida).toBeNull()
    expect(r.lineas[0].cantidad).toBe('4')
  })

  it('aviso de repetida, con el proveedor del recuadro o «Por repartir»', () => {
    expect(avisoRepetida('lcd-x-negro', 'ACME', 3)).toBe('lcd-x-negro ya está en el pedido a ACME (línea 3).')
    expect(avisoRepetida('lcd-x-negro', null, 1)).toBe('lcd-x-negro ya está en «Por repartir» (línea 1).')
  })

  // flex-x (6), pieza local de estos tests: pide 7.
  const CON_SIETE: Componente[] = [...ACTIVOS, { ...COMPONENTES[0], idCom: 6, tipo: 'flex-x', pedir60: 7 }]

  it('cambiar de pieza con la cantidad automática la recalcula: A (16) → B sin previsión, 1; A → C, 7', () => {
    const conA = elegirPieza([lineaCompraVacia(1)], 1, 1, CON_SIETE).lineas
    expect(conA[0]).toMatchObject({ idCom: 1, cantidad: '16' })
    const conB = elegirPieza(conA, 1, 2, CON_SIETE).lineas
    expect(conB[0]).toMatchObject({ idCom: 2, cantidad: '1' })
    expect(elegirPieza(conB, 1, 6, CON_SIETE).lineas[0]).toMatchObject({ idCom: 6, cantidad: '7' })
    expect(elegirPieza(conA, 1, 6, CON_SIETE).lineas[0]).toMatchObject({ idCom: 6, cantidad: '7' })
  })

  it('con la cantidad cambiada a mano, cambiar de pieza no la toca', () => {
    const aMano = [{ ...lineaCompraVacia(1, 1), cantidad: '5' }]
    expect(elegirPieza(aMano, 1, 2, CON_SIETE).lineas[0]).toMatchObject({ idCom: 2, cantidad: '5' })
    expect(elegirPieza(aMano, 1, 6, CON_SIETE).lineas[0]).toMatchObject({ idCom: 6, cantidad: '5' })
  })

  it('volver a elegir la misma pieza no cambia nada, aunque siga con 1 y tenga previsión (una línea de solicitud con 1)', () => {
    const lineas = [lineaCompraVacia(1, 1)]
    const r = elegirPieza(lineas, 1, 1, ACTIVOS)
    expect(r.repetida).toBeNull()
    expect(r.lineas).toBe(lineas)
    expect(r.lineas[0].cantidad).toBe('1')
  })

  it('ponerCantidadesPrevistas: las líneas con pieza que siguen con 1 pasan a su «Pedir 60 d»; las demás no cambian', () => {
    const lineas = [lineaCompraVacia(1, 1), lineaCompraVacia(2, 2), { ...lineaCompraVacia(3, 1), cantidad: '3' }, lineaCompraVacia(4)]
    expect(ponerCantidadesPrevistas(lineas, ACTIVOS).map((l) => l.cantidad)).toEqual(['16', '1', '3', '1'])
    // La precarga de «Pedir» no la pone: puede venir de la caché vieja; el diálogo la aplica con la lista fresca.
    expect(precargarComponentes([1], ACTIVOS)[0].cantidad).toBe('1')
  })

  it('«Pedir» de un slave: la línea va a su master y lleva la previsión del master, no la del slave', () => {
    const activos = COMPONENTES.map((c) => (c.idCom === 2 ? { ...c, pedir60: 7 } : c.idCom === 5 ? { ...c, pedir60: 0 } : c))
    expect(ponerCantidadesPrevistas(precargarComponentes([5], activos), activos).map((l) => [l.idCom, l.cantidad])).toEqual([[2, '7']])
  })
})

describe('lo que falta y recuadros (varios proveedores, spec 2026-10-13 §4-§5)', () => {
  // lcd-x-negro (1) pide 7, marcada en Auto; la venden ACME (1) y Proveedor B (2).
  const ACTIVOS: Componente[] = COMPONENTES.map((c) => (c.idCom === 1 ? { ...c, pedir60: 7, autoPedido: true, proveedores: [1, 2] } : c))
  const L = (id: number, idCom: number | null, idProv: number | null, cantidad = '1'): LineaCompra => ({ ...lineaCompraVacia(id, idCom), idProv, cantidad })

  it('loQueFalta: «Pedir 60 d» menos lo que va a otros proveedores; «Por repartir» no cuenta; nunca negativo', () => {
    const ls = [L(1, 1, 1, '3'), L(2, 1, null, '5')]
    expect(loQueFalta(ls, 1, 2, ACTIVOS)).toBe(4)
    expect(loQueFalta(ls, 1, 1, ACTIVOS)).toBe(7)
    expect(loQueFalta([L(1, 1, 1, '9')], 1, 2, ACTIVOS)).toBe(0)
  })

  it('«Añadir previsión» no coge de «Por repartir» una pieza a la que ya no le falta nada', () => {
    const ls = [L(1, 1, 1, '7'), L(2, 1, null, '5')]
    expect(aplicarPrevision(ls, ACTIVOS, 2)).toEqual({ lineas: ls, sinPedido: 1 })
  })

  it('elegir la pieza en el segundo proveedor pone lo que falta (7 − 3 = 4); si no falta nada, 1', () => {
    expect(elegirPieza([L(1, 1, 1, '3'), L(2, null, 2)], 2, 1, ACTIVOS).lineas[1].cantidad).toBe('4')
    expect(elegirPieza([L(1, 1, 1, '7'), L(2, null, 2)], 2, 1, ACTIVOS).lineas[1].cantidad).toBe('1')
  })

  it('una pieza solo se junta dentro de su recuadro; en otro proveedor sí puede ir; el número es el del recuadro', () => {
    const otroProveedor = elegirPieza([L(1, 1, 1, '3'), L(2, null, 2)], 2, 1, ACTIVOS)
    expect(otroProveedor.repetida).toBeNull()
    expect(otroProveedor.lineas.map((l) => [l.idCom, l.idProv])).toEqual([[1, 1], [1, 2]])
    const mismo = elegirPieza([L(1, 2, 2), L(2, 1, 1, '3'), L(3, 1, 2, '4'), L(4, null, 2)], 4, 1, ACTIVOS)
    expect(mismo.repetida).toEqual({ id: 3, n: 2 })
    expect(mismo.lineas.map((l) => l.id)).toEqual([1, 2, 3])
  })

  it('«Añadir previsión» de un recuadro: lo que falta; coge la de «Por repartir»; no toca la de otro proveedor', () => {
    expect(cuantasPrevision(ACTIVOS, 2, [L(1, 1, 1, '3')])).toBe(1)
    expect(cuantasPrevision(ACTIVOS, 2, [L(1, 1, 1, '7')])).toBe(0)
    expect(aplicarPrevision([L(1, 1, 1, '3')], ACTIVOS, 2).lineas).toEqual([L(1, 1, 1, '3'), L(2, 1, 2, '4')])
    expect(aplicarPrevision([L(1, 1, null, '2')], ACTIVOS, 2).lineas).toEqual([L(1, 1, 2, '7')])
    expect(aplicarPrevision([L(1, 1, 1, '7')], ACTIVOS, 2)).toEqual({ lineas: [L(1, 1, 1, '7')], sinPedido: 1 })
  })
})
