import { describe, expect, it } from 'vitest'
import { lineaDePrueba as l } from './datosPrueba'
import {
  abiertosDe, agruparEnBloques, avisoBloque, claveBloque, destinoSugeridoEdicion, destinosMover, entradasMenuBloque, estaDesplegado,
  estaSola, lineasQueCambian, motivoNoCambia, ordenarPorBloques, resumenEstados, SIN_BLOQUE, situacion, textoLineas,
  textoMoverYaPedida, textoYaPedidasJuntar, textoYaPedidasSeparar, totalBloque,
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
    expect(b.lineas.map((x) => x.idCompra)).toEqual([1, 2, 3])
  })

  it('una línea sin bloque va al grupo «Sin bloque»', () => {
    expect(claveBloque(l({ idBloque: null }))).toBe(SIN_BLOQUE)
  })

  it('ordena bloques por fecha y número descendentes, «Sin bloque» al final; dentro, líneas ascendentes', () => {
    const todas = [
      l({ idCompra: 1, ...B39 }), l({ idCompra: 2, ...B40 }), l({ idCompra: 3, idBloque: null, fechaBloque: null }),
      l({ idCompra: 4, ...B41, fechaPedido: '2026-10-09T12:00:00' }), l({ idCompra: 5, ...B41, fechaPedido: '2026-10-09T11:00:00' }),
    ]
    expect(ordenarPorBloques(todas, agruparEnBloques(todas)).map((x) => x.idCompra)).toEqual([5, 4, 2, 1, 3])
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
    expect(lineasQueCambian(b, 'confirmar').map((x) => x.idCompra)).toEqual([1])
    expect(lineasQueCambian(b, 'recibir').map((x) => x.idCompra)).toEqual([2])
    expect(lineasQueCambian(b, 'cancelar').map((x) => x.idCompra)).toEqual([2])
    expect(lineasQueCambian(b, 'borrar').map((x) => x.idCompra)).toEqual([1])
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
      'Confirmar bloque (1)', 'Recibir todo (1)', '—', 'Añadir líneas…', 'Separar líneas…', 'Juntar con…', 'Añadir nota…', '—',
      'Cancelar bloque (1)', 'Borrar bloque',
    ])
    const porTexto = (t: string) => entradas.find((e) => e !== 'separador' && e.texto === t)
    expect(porTexto('Juntar con…')).toMatchObject({ deshabilitada: true, motivo: 'no hay otro bloque de este proveedor' })
    expect(porTexto('Borrar bloque')).toMatchObject({ deshabilitada: true, motivo: 'hay líneas ya pedidas', peligro: true })
    expect(porTexto('Separar líneas…')).toMatchObject({ deshabilitada: false, motivo: null })
  })
  it('menú de un bloque de una sola línea pendiente y con nota', () => {
    const solo = agruparEnBloques([l({ notaBloque: 'Ped. 1' })]).get('41')!
    const entradas = entradasMenuBloque(solo, 2).filter((e) => e !== 'separador')
    expect(entradas.find((e) => e.accion === 'recibir')).toMatchObject({ texto: 'Recibir todo (0)', deshabilitada: true, motivo: 'nada en camino' })
    expect(entradas.find((e) => e.accion === 'separar')).toMatchObject({ deshabilitada: true, motivo: 'solo tiene una línea' })
    expect(entradas.find((e) => e.accion === 'nota')).toMatchObject({ texto: 'Editar nota…' })
    expect(entradas.find((e) => e.accion === 'borrar')).toMatchObject({ deshabilitada: false })
  })
})

describe('mover y destinos', () => {
  const todas = [
    l({ idCompra: 1, ...B41 }), l({ idCompra: 2, ...B41, estado: 'en_camino' }),
    l({ idCompra: 3, ...B40 }), l({ idCompra: 4, ...B39, estado: 'recibido' }),
    l({ idCompra: 5, idBloque: 50, fechaBloque: '2026-10-09T09:00:00', idProv: 2, nombreProveedor: 'Proveedor B' }),
  ]
  const bloques = agruparEnBloques(todas)
  it('destinos: los del mismo proveedor sin el propio, del más reciente al más antiguo', () => {
    expect(destinosMover(todas[0], bloques)).toEqual([
      { idBloque: 40, texto: 'Bloque 40', detalle: '08/10 · 1 línea · abierto' },
      { idBloque: 39, texto: 'Bloque 39', detalle: '08/10 · 1 línea · terminado' },
    ])
  })
  it('como mucho 8 destinos', () => {
    const muchas = Array.from({ length: 11 }, (_, i) => l({ idCompra: i + 1, idBloque: 100 + i, fechaBloque: `2026-10-0${(i % 9) + 1}T10:00:00` }))
    expect(destinosMover(muchas[0], agruparEnBloques(muchas))).toHaveLength(8)
  })
  it('sola en su bloque, abiertos y destino sugerido al editar', () => {
    expect(estaSola(todas[2], bloques)).toBe(true)
    expect(estaSola(todas[0], bloques)).toBe(false)
    expect(abiertosDe(bloques, 1).map((b) => b.idBloque)).toEqual([40])
    expect(destinoSugeridoEdicion(todas[2], 2, bloques)).toBe(50)
    expect(destinoSugeridoEdicion(todas[1], 2, bloques)).toBeNull()
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
