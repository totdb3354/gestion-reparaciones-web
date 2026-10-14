import { describe, expect, it } from 'vitest'
import { claveLinea, idPedido } from '../reglas'
import { lineaDePrueba as l, otroDePrueba as o } from './datosPrueba'
import {
  abiertosDe, agruparEnBloques, avisoBloque, claveBloque, destinoSugeridoEdicion, destinosMover, entradasMenuBloque, estaDesplegado,
  estaSola, etiquetaLinea, lineasQueCambian, motivoNoCambia, ordenarPorBloques, otrosDe, resumenEstados, SIN_BLOQUE, sePuedeMover, sinPrecio, situacion, textoDesmarcadas,
  textoLineas, textoLineasBloque, textoQueda, textoSinPrecio, textoMoverYaPedida, textoYaPedidasJuntar, textoYaPedidasSeparar, totalBloque, vivosDelProveedor,
} from './reglas'

const B41 = { idBloque: 41, fechaBloque: '2026-10-09T10:00:00' }
const B40 = { idBloque: 40, fechaBloque: '2026-10-08T10:00:00' }
const B39 = { idBloque: 39, fechaBloque: '2026-10-08T10:00:00' }

describe('agrupar y ordenar', () => {
  it('agrupa por bloque con los datos de la cabecera y las líneas por fecha de pedido e id', () => {
    const bloques = agruparEnBloques([
      l({ idCompra: 3, ...B41, fechaPedido: '2026-10-09T12:00:00', notaBloque: 'Ped. 1' }),
      l({ idCompra: 2, ...B41, fechaPedido: '2026-10-09T10:00:00', notaBloque: 'Ped. 1' }),
      l({ idCompra: 1, ...B41, fechaPedido: '2026-10-09T10:00:00', notaBloque: 'Ped. 1' }),
    ])
    const b = bloques.get('41')!
    expect(b).toMatchObject({ clave: '41', idBloque: 41, idProv: 1, nombreProveedor: 'Proveedor A', fecha: '2026-10-09T10:00:00', nota: 'Ped. 1', antiguo: false })
    expect(b.lineas.map(idPedido)).toEqual([1, 2, 3])
  })

  it('una línea sin bloque va al grupo «Sin bloque»', () => {
    expect(claveBloque(l({ idBloque: null }))).toBe(SIN_BLOQUE)
  })

  it('ordena bloques por fecha y, a igual fecha, por número, descendentes: uno de número más alto y fecha anterior va después (0.9.15); «Sin bloque» al final; dentro, líneas ascendentes', () => {
    const todas = [
      l({ idCompra: 1, ...B39 }), l({ idCompra: 2, ...B40 }), l({ idCompra: 3, idBloque: null, fechaBloque: null }),
      l({ idCompra: 4, ...B41, fechaPedido: '2026-10-09T12:00:00' }), l({ idCompra: 5, ...B41, fechaPedido: '2026-10-09T11:00:00' }),
      l({ idCompra: 6, idBloque: 42, fechaBloque: '2026-10-01T10:00:00' }),
    ]
    expect(ordenarPorBloques(todas, agruparEnBloques(todas)).map(idPedido)).toEqual([5, 4, 2, 1, 6, 3])
  })
  it('un bloque antiguo de número alto y fecha vieja va tras los actuales también entre los del proveedor (0.9.15)', () => {
    const bloques = agruparEnBloques([
      l({ idCompra: 1, ...B41 }),
      l({ idCompra: 2, idBloque: 90, fechaBloque: '2026-07-01T10:00:00', bloqueAntiguo: true, estado: 'en_camino' }),
    ])
    expect(vivosDelProveedor(bloques, 1).map((b) => b.idBloque)).toEqual([41, 90])
  })
})

describe('situación, resumen, total y aviso', () => {
  const bloque = (...lineas: ReturnType<typeof l>[]) => agruparEnBloques(lineas).get('41')!
  it('abierto, en curso y terminado', () => {
    expect(situacion(bloque(l({ idCompra: 1 }), l({ idCompra: 2 })))).toBe('abierto')
    expect(situacion(bloque(l({ idCompra: 1 }), l({ idCompra: 2, estado: 'recibido' })))).toBe('en curso')
    expect(situacion(bloque(l({ idCompra: 1, estado: 'recibido' }), l({ idCompra: 2, estado: 'cancelado' })))).toBe('terminado')
  })
  it('desplegado: lo manual manda; si no, con filtros siempre y sin filtros solo los vivos', () => {
    const terminado = bloque(l({ estado: 'recibido' }))
    expect(estaDesplegado(terminado, false, {})).toBe(false)
    expect(estaDesplegado(terminado, true, {})).toBe(true)
    expect(estaDesplegado(terminado, false, { 41: true })).toBe(true)
    expect(estaDesplegado(bloque(l()), false, { 41: false })).toBe(false)
  })
  it('resumen en el orden de los estados, solo los que hay', () => {
    const b = bloque(l({ idCompra: 1, estado: 'recibido' }), l({ idCompra: 2 }), l({ idCompra: 3, estado: 'en_camino' }), l({ idCompra: 4, estado: 'en_camino' }))
    expect(resumenEstados(b)).toEqual([{ estado: 'pendiente', n: 1 }, { estado: 'en_camino', n: 2 }, { estado: 'recibido', n: 1 }])
  })
  it('total sin las canceladas y ⚠ con una urgente en camino', () => {
    const b = bloque(l({ idCompra: 1, cantidad: 2, precioEur: 10 }), l({ idCompra: 2, cantidad: 5, precioEur: 1, estado: 'cancelado' }))
    expect(totalBloque(b)).toBe(20)
    expect(avisoBloque(b)).toBe(false)
    expect(avisoBloque(bloque(l({ esUrgente: true, estado: 'en_camino' })))).toBe(true)
  })
})

describe('acciones de bloque', () => {
  const b = agruparEnBloques([
    l({ idCompra: 1 }), l({ idCompra: 2, estado: 'en_camino' }), l({ idCompra: 3, estado: 'parcial', cantidad: 2, cantidadRecibida: 1 }),
    l({ idCompra: 4, estado: 'recibido' }), l({ idCompra: 5, estado: 'cancelado' }),
  ]).get('41')!
  it('qué líneas cambia cada acción', () => {
    expect(lineasQueCambian(b, 'confirmar').map(idPedido)).toEqual([1])
    expect(lineasQueCambian(b, 'recibir').map(idPedido)).toEqual([2])
    expect(lineasQueCambian(b, 'cancelar').map(idPedido)).toEqual([2])
    expect(lineasQueCambian(b, 'borrar').map(idPedido)).toEqual([1])
  })
  it('motivos de las que no cambian (spec §6.5)', () => {
    const [p, e, pa, r, c] = b.lineas
    expect([e, pa, r, c].map((x) => motivoNoCambia(x, 'confirmar'))).toEqual(['ya en camino', 'ya parcial', 'ya recibido', 'cancelado'])
    expect([p, pa, r, c].map((x) => motivoNoCambia(x, 'recibir'))).toEqual([
      'pendiente: aún no se ha pedido', 'parcial (1/2): usa «Recibir resto» en su fila', 'ya recibido', 'cancelado',
    ])
    expect([p, pa, r, c].map((x) => motivoNoCambia(x, 'cancelar'))).toEqual([
      'pendiente: se borra, no se cancela', 'parcial: usa «Cerrar sin resto» en su fila', 'ya recibido', 'ya cancelado',
    ])
  })
  it('menú del bloque con contadores, motivos y peligro', () => {
    const entradas = entradasMenuBloque(b, 0)
    expect(entradas.map((e) => (e === 'separador' ? '—' : e.texto))).toEqual([
      'Confirmar bloque (1)', 'Recibir todo (1)', '—', 'Añadir líneas…', 'Añadir previsión…', 'Separar líneas…', 'Juntar con…', 'Añadir nota…',
      'Exportar bloque en CSV', '—', 'Cancelar bloque (1)', 'Borrar bloque',
    ])
    const porTexto = (t: string) => entradas.find((e) => e !== 'separador' && e.texto === t)
    expect(porTexto('Juntar con…')).toMatchObject({ deshabilitada: true, motivo: 'no hay otro bloque vivo de este proveedor' })
    expect(porTexto('Borrar bloque')).toMatchObject({ deshabilitada: true, motivo: 'hay líneas ya pedidas', peligro: true })
    expect(porTexto('Separar líneas…')).toMatchObject({ deshabilitada: false, motivo: null })
  })
  it('«Añadir previsión…» va justo tras «Añadir líneas…» y en un bloque vivo está disponible', () => {
    const textos = entradasMenuBloque(b, 0).map((e) => (e === 'separador' ? '—' : e.texto))
    const i = textos.indexOf('Añadir líneas…')
    expect(textos[i + 1]).toBe('Añadir previsión…')
    const entrada = entradasMenuBloque(b, 0).find((e) => e !== 'separador' && e.accion === 'prevision')
    expect(entrada).toMatchObject({ deshabilitada: false, peligro: false })
  })
  it('un bloque terminado está cerrado: sin añadir, previsión, separar ni juntar', () => {
    const terminado = [...agruparEnBloques([
      l({ idCompra: 1, idBloque: 60, estado: 'recibido' }), l({ idCompra: 2, idBloque: 60, estado: 'cancelado' }),
    ]).values()][0]
    const porAccion = (a: string) => entradasMenuBloque(terminado, 3).find((e) => e !== 'separador' && e.accion === a)
    for (const accion of ['anadir', 'prevision', 'separar', 'juntar']) {
      expect(porAccion(accion)).toMatchObject({ deshabilitada: true, motivo: 'el bloque está terminado' })
    }
    expect(porAccion('nota')).toMatchObject({ deshabilitada: false })
  })
  it('menú de un bloque de una sola línea pendiente y con nota', () => {
    const solo = agruparEnBloques([l({ notaBloque: 'Ped. 1' })]).get('41')!
    const entradas = entradasMenuBloque(solo, 2).filter((e) => e !== 'separador')
    expect(entradas.find((e) => e.accion === 'recibir')).toMatchObject({ texto: 'Recibir todo (0)', deshabilitada: true, motivo: 'nada en camino' })
    expect(entradas.find((e) => e.accion === 'separar')).toMatchObject({ deshabilitada: true, motivo: 'solo tiene una línea' })
    expect(entradas.find((e) => e.accion === 'nota')).toMatchObject({ texto: 'Editar nota…' })
    expect(entradas.find((e) => e.accion === 'borrar')).toMatchObject({ deshabilitada: false })
  })
  it('«Exportar bloque en CSV» sale también en un bloque terminado (0.9.13)', () => {
    const terminado = [...agruparEnBloques([l({ idCompra: 1, idBloque: 60, estado: 'recibido' })]).values()][0]
    expect(entradasMenuBloque(terminado, 0).find((e) => e !== 'separador' && e.accion === 'exportar'))
      .toMatchObject({ texto: 'Exportar bloque en CSV', deshabilitada: false, motivo: null, peligro: false })
  })
  it('sin permiso de edición el menú solo lleva «Exportar bloque en CSV» (0.9.13)', () => {
    expect(entradasMenuBloque(b, 0, false)).toEqual([
      { accion: 'exportar', texto: 'Exportar bloque en CSV', deshabilitada: false, motivo: null, peligro: false },
    ])
  })
  it('textos de las líneas desmarcadas (0.9.13)', () => {
    expect(textoQueda('confirmar')).toBe('se queda pendiente')
    expect(textoQueda('recibir')).toBe('se queda en camino')
    expect(textoQueda('cancelar')).toBe('se queda en camino')
    expect(textoDesmarcadas('recibir', 1)).toBe('Se queda en camino 1 línea: la desmarcada no cambia.')
    expect(textoDesmarcadas('cancelar', 3)).toBe('Se quedan en camino 3 líneas: las desmarcadas no cambian.')
    expect(textoDesmarcadas('confirmar', 1)).toBe('Se queda pendiente 1 línea: la desmarcada no cambia.')
    expect(textoDesmarcadas('confirmar', 2)).toBe('Se quedan pendientes 2 líneas: las desmarcadas no cambian.')
  })
})

describe('mover y destinos', () => {
  const todas = [
    l({ idCompra: 1, ...B41 }), l({ idCompra: 2, ...B41, estado: 'en_camino' }),
    l({ idCompra: 3, ...B40 }), l({ idCompra: 4, ...B39, estado: 'recibido' }),
    l({ idCompra: 5, idBloque: 50, fechaBloque: '2026-10-09T09:00:00', idProv: 2, nombreProveedor: 'Proveedor B' }),
  ]
  const bloques = agruparEnBloques(todas)
  it('destinos: los bloques vivos del mismo proveedor sin el propio, de mayor a menor número (el 39, terminado, no)', () => {
    expect(destinosMover(todas[0], bloques)).toEqual([
      { idBloque: 40, texto: 'Bloque 40', detalle: '08/10 · 1 línea · abierto' },
    ])
    expect(vivosDelProveedor(bloques, 1).map((b) => b.idBloque)).toEqual([41, 40])
  })
  it('sin tope: todos los vivos del proveedor', () => {
    const muchas = Array.from({ length: 11 }, (_, i) => l({ idCompra: i + 1, idBloque: 100 + i, fechaBloque: `2026-10-0${(i % 9) + 1}T10:00:00` }))
    expect(destinosMover(muchas[0], agruparEnBloques(muchas))).toHaveLength(10)
  })

  it('solo se mueven las líneas vivas', () => {
    expect(['pendiente', 'en_camino', 'parcial', 'recibido', 'cancelado'].map((estado) => sePuedeMover(l({ estado }))))
      .toEqual([true, true, true, false, false])
  })
  it('sola en su bloque, abiertos y destino sugerido al editar', () => {
    expect(estaSola(todas[2], bloques)).toBe(true)
    expect(estaSola(todas[0], bloques)).toBe(false)
    expect(abiertosDe(bloques, 1).map((b) => b.idBloque)).toEqual([40])
    expect(destinoSugeridoEdicion(todas[2], 2, bloques)).toBe(50)
    expect(destinoSugeridoEdicion(todas[1], 2, bloques)).toBeNull()
  })
  it('abiertosDe: un bloque antiguo abierto va detrás de uno actual aunque sea más reciente (0.9.15)', () => {
    const bloques = agruparEnBloques([
      l({ idCompra: 1, idBloque: 50, fechaBloque: '2026-10-15T09:00:00' }),
      l({ idCompra: 2, idBloque: 60, fechaBloque: '2026-10-15T10:00:00', bloqueAntiguo: true }),
    ])
    expect(abiertosDe(bloques, 1).map((b) => b.idBloque)).toEqual([50, 60])
    expect(destinoSugeridoEdicion(l({ idCompra: 9, idProv: 2, idBloque: 70 }), 1, bloques)).toBe(50)
  })
})

describe('textos', () => {
  it('líneas, mover una ya pedida y avisos de separar y juntar', () => {
    expect(textoLineas(1)).toBe('1 línea')
    expect(textoLineas(3)).toBe('3 líneas')
    expect(textoMoverYaPedida(l({ idCompra: 7, estado: 'en_camino' }), 40)).toBe(
      'La línea lcd-x-negro (ID 7) está en camino. ¿Moverla al Bloque 40 igualmente?\nEl stock no cambia. El movimiento queda apuntado en el registro de actividad.',
    )
    expect(textoMoverYaPedida(l({ idCompra: 7, estado: 'recibido' }), null)).toContain('¿Moverla a un bloque nuevo igualmente?')
    expect(textoYaPedidasSeparar(1)).toBe('1 línea de las marcadas ya se pidió: el movimiento quedará apuntado en el registro.')
    expect(textoYaPedidasSeparar(2)).toBe('2 líneas de las marcadas ya se pidieron: el movimiento quedará apuntado en el registro.')
    expect(textoYaPedidasJuntar(41, 1)).toBe('El Bloque 41 tiene 1 línea ya pedida: el movimiento quedará apuntado en el registro.')
    expect(textoYaPedidasJuntar(41, 2)).toBe('El Bloque 41 tiene 2 líneas ya pedidas: el movimiento quedará apuntado en el registro.')
  })
})

describe('líneas recibidas sin precio (2026-10-13)', () => {
  it('cuenta las recibidas con P.Unit. o EUR a 0; las pendientes o en camino a 0 no', () => {
    const b = [...agruparEnBloques([
      l({ idCompra: 1, idBloque: 70, estado: 'recibido', precioUnidadPedido: 0, precioEur: 0 }),
      l({ idCompra: 2, idBloque: 70, estado: 'recibido' }),
      l({ idCompra: 3, idBloque: 70, estado: 'pendiente', precioUnidadPedido: 0, precioEur: 0 }),
      l({ idCompra: 4, idBloque: 70, estado: 'en_camino', precioUnidadPedido: 0, precioEur: 0 }),
    ]).values()][0]
    expect(sinPrecio(b)).toBe(1)
  })
  it('texto del tooltip', () => {
    expect(textoSinPrecio(1)).toBe('1 línea recibida sin precio: ponlo con «Editar».')
    expect(textoSinPrecio(3)).toBe('3 líneas recibidas sin precio: ponlo con «Editar».')
  })
})

describe('líneas mixtas: piezas y otros (0.9.15)', () => {
  /** Bloque 41: pieza 5 pendiente, pieza 2 en camino, otro 2 en camino (3 × 2 €) y otro 1 recibido sin precio. */
  const mixto = () => agruparEnBloques([
    o({ idCompraOtro: 2, estado: 'en_camino', cantidad: 3, precioEur: 2 }),
    l({ idCompra: 5 }),
    l({ idCompra: 2, estado: 'en_camino' }),
    o({ idCompraOtro: 1, estado: 'recibido', precioUnidadPedido: 0, precioEur: 0 }),
  ]).get('41')!

  it('un otro va al bloque de su idBloque; a igual fecha, las piezas antes que los otros y después el id', () => {
    expect(mixto().lineas.map(claveLinea)).toEqual(['p-2', 'p-5', 'o-1', 'o-2'])
  })
  it('situación, resumen, total y «sin precio» cuentan los dos tipos', () => {
    const b = mixto()
    expect(situacion(b)).toBe('en curso')
    expect(resumenEstados(b)).toEqual([{ estado: 'pendiente', n: 1 }, { estado: 'en_camino', n: 2 }, { estado: 'recibido', n: 1 }])
    expect(totalBloque(b)).toBe(46)
    expect(sinPrecio(b)).toBe(1)
    expect(situacion(agruparEnBloques([o({ idCompraOtro: 1 }), l({ idCompra: 1 })]).get('41')!)).toBe('abierto')
    expect(situacion(agruparEnBloques([o({ idCompraOtro: 1, estado: 'cancelado' }), l({ idCompra: 1, estado: 'recibido' })]).get('41')!)).toBe('terminado')
  })
  it('qué líneas cambia cada acción, de los dos tipos', () => {
    const b = mixto()
    expect(lineasQueCambian(b, 'recibir').map(claveLinea)).toEqual(['p-2', 'o-2'])
    expect(lineasQueCambian(b, 'confirmar').map(claveLinea)).toEqual(['p-5'])
    expect(motivoNoCambia(o({ estado: 'recibido' }), 'recibir')).toBe('ya recibido')
  })
  it('cabecera: «n líneas» o «n líneas (m otro|otros)»', () => {
    expect(textoLineasBloque(agruparEnBloques([l({ idCompra: 1 }), l({ idCompra: 2 })]).get('41')!)).toBe('2 líneas')
    expect(textoLineasBloque(agruparEnBloques([l({ idCompra: 1 }), o({ idCompraOtro: 1 })]).get('41')!)).toBe('2 líneas (1 otro)')
    expect(textoLineasBloque(mixto())).toBe('4 líneas (2 otros)')
    expect(otrosDe(mixto())).toBe(2)
  })
  it('un otro vivo se mueve como una pieza: destinos, sola y destino sugerido al editar', () => {
    const todas = [
      o({ idCompraOtro: 1 }),
      l({ idCompra: 1, idBloque: 40, fechaBloque: '2026-10-08T10:00:00' }),
      l({ idCompra: 2, idProv: 2, nombreProveedor: 'Proveedor B', idBloque: 50 }),
    ]
    const bloques = agruparEnBloques(todas)
    expect(sePuedeMover(o({ estado: 'en_camino' }))).toBe(true)
    expect(sePuedeMover(o({ estado: 'recibido' }))).toBe(false)
    expect(destinosMover(todas[0], bloques).map((d) => d.idBloque)).toEqual([40])
    expect(estaSola(todas[0], bloques)).toBe(true)
    expect(destinoSugeridoEdicion(todas[0], 2, bloques)).toBe(50)
    expect(destinoSugeridoEdicion(o({ estado: 'en_camino' }), 2, bloques)).toBeNull()
  })
  it('textos con un otro: su concepto y «O-{id}»', () => {
    expect(textoMoverYaPedida(o({ idCompraOtro: 88, estado: 'en_camino' }), 40)).toBe(
      'La línea Cinta de embalar (ID O-88) está en camino. ¿Moverla al Bloque 40 igualmente?\nEl stock no cambia. El movimiento queda apuntado en el registro de actividad.',
    )
    expect(etiquetaLinea(o({ idCompraOtro: 88 }))).toBe('Cinta de embalar (ID O-88)')
    expect(etiquetaLinea(l({ idCompra: 3, tipoComponente: 'lcd-y' }))).toBe('lcd-y (ID 3)')
  })
})
