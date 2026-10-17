import { describe, expect, it } from 'vitest'
import { eventoRastro } from '../test/fabrica'
import { fechaRastro, hayAntesDelHistorico, verEvento } from './rastro'

describe('textos del rastro (spec pieza 1 §9.3)', () => {
  it('fechas: con hora o solo el día', () => {
    expect(fechaRastro('2026-09-12T13:01:00', false)).toBe('12/09/2026 13:01')
    expect(fechaRastro('2023-03-14T00:00:00', true)).toBe('14/03/2023')
  })

  it('cada tipo de evento', () => {
    expect(verEvento(eventoRastro())).toMatchObject({ titulo: 'Pasa a Listos', detalle: 'Desde: Taller · Glass', color: 'bg-fila-recibido-brd' })
    expect(verEvento(eventoRastro({ a: null, aNsys: 'Pedidos realizados', de: 'Listos' })).titulo).toBe('De pedido (vendido, pendiente de envío)')
    expect(verEvento(eventoRastro({ a: null, aNsys: 'Desguace' })).titulo).toBe('Pasa a Desguace · sale del stock')
    expect(verEvento(eventoRastro({ tipo: 'ENTRADA', de: null, a: null, aNsys: null, soloDia: true })).titulo).toBe('Entra en el lote BT-9001')
    expect(verEvento(eventoRastro({ tipo: 'REENTRADA', a: 'BT-9002' })).titulo).toBe('Vuelve a entrar (lote BT-9002)')
    expect(verEvento(eventoRastro({ tipo: 'GRADO', de: 'C100', a: 'A100' }))).toMatchObject({ titulo: 'Se le pone el grado A · batería nueva', detalle: 'Antes: C · batería nueva' })
    expect(verEvento(eventoRastro({ tipo: 'GRADO', de: 'C', a: 'B' }))).toMatchObject({ titulo: 'Se le pone el grado B', detalle: 'Antes: C' })
    expect(verEvento(eventoRastro({ tipo: 'PRODUCTO', de: 'Blue', a: 'Pink' })).detalle).toBe('Blue → Pink')
    expect(verEvento(eventoRastro({ tipo: 'ESTADO', de: 'InProcess', a: 'Available' })).titulo).toBe('Estado en NSYS: Available')
    expect(verEvento(eventoRastro({ tipo: 'VENTA', soloDia: true })).detalle).toBe('Del fichero de NSYS: solo se sabe el día')
    expect(verEvento(eventoRastro({ tipo: 'VENTA_DESHECHA', a: 'Available' })).titulo).toBe('Venta deshecha en NSYS')
    expect(verEvento(eventoRastro({ fuente: 'ERP', tipo: 'TRABAJO_ASIGNADO', idRep: 'AG1', tecnico: 'Técnico 3', categoria: 'GLASS' })).titulo)
      .toBe('Trabajo de glass asignado a Técnico 3')
    expect(verEvento(eventoRastro({ fuente: 'ERP', tipo: 'TRABAJO_TERMINADO', idRep: 'G1', tecnico: 'Técnico 3', categoria: 'GLASS' })))
      .toMatchObject({ titulo: 'Glass terminado', detalle: 'Técnico 3' })
  })

  it('la nota del histórico sale si hay eventos de antes de dic. 2023', () => {
    expect(hayAntesDelHistorico([eventoRastro(), eventoRastro({ fecha: '2023-03-14T00:00:00', soloDia: true })])).toBe(true)
    expect(hayAntesDelHistorico([eventoRastro({ fecha: '2023-12-01T09:00:00' })])).toBe(false)
  })
})
