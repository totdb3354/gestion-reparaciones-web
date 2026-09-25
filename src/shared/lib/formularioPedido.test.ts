import { describe, expect, it } from 'vitest'
import { abrirNuevoOtroPedido, abrirNuevoPedido, cerrarFormularioPedido, formularioPedido } from './formularioPedido'
import { reiniciarStores } from './store'

/** Spec 4b P1: Stock actual, Pedidos y la campana abren el formulario de alta llamando al store; el host del shell
 *  (FormulariosPedido, Task 15) pinta el que diga. */
describe('formularioPedido', () => {
  it('empieza cerrado', () => {
    expect(formularioPedido.get()).toBeNull()
  })
  it('abrirNuevoPedido abre el formulario de compra con su precarga', () => {
    abrirNuevoPedido({ modo: 'componentes', idsCom: [11, 12] })
    expect(formularioPedido.get()).toEqual({ tipo: 'compra', precarga: { modo: 'componentes', idsCom: [11, 12] } })
    abrirNuevoPedido({ modo: 'solicitudes', urgentes: [], preventivas: [] })
    expect(formularioPedido.get()).toEqual({ tipo: 'compra', precarga: { modo: 'solicitudes', urgentes: [], preventivas: [] } })
    abrirNuevoPedido({ modo: 'vacio' })
    expect(formularioPedido.get()).toEqual({ tipo: 'compra', precarga: { modo: 'vacio' } })
  })
  it('abrirNuevoOtroPedido abre el de otros y cerrarFormularioPedido lo cierra', () => {
    abrirNuevoOtroPedido()
    expect(formularioPedido.get()).toEqual({ tipo: 'otro' })
    cerrarFormularioPedido()
    expect(formularioPedido.get()).toBeNull()
  })
  it('reiniciarStores (cierre de sesión) lo deja cerrado', () => {
    abrirNuevoPedido({ modo: 'vacio' })
    reiniciarStores()
    expect(formularioPedido.get()).toBeNull()
  })
})
