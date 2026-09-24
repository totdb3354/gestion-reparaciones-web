import { describe, expect, it } from 'vitest'
import { aplicarClienteBd, aplicarClienteDefault, elegirCliente, propagarCliente, sembrarCliente } from './cliente'
import { entrada, estado, IMEI_1, IMEI_2 } from './fabrica'

const fila = (imei: string) => ({ seq: 9, imei, idTec: null, comentario: '', idCli: null, sinCliente: false })

describe('cliente del modal (precedencia: manual → BD → pegajoso → vacío)', () => {
  it('siembra la decisión manual del IMEI, también "sin cliente"', () => {
    const s = estado({ clienteManual: { [IMEI_1]: { idCli: 5, sin: false }, [IMEI_2]: { idCli: null, sin: true } } })
    expect(sembrarCliente(s, entrada({ seq: 1, imei: IMEI_1 }))).toMatchObject({ idCli: 5, sinCliente: false })
    expect(sembrarCliente(s, entrada({ seq: 1, imei: IMEI_2 }))).toMatchObject({ idCli: null, sinCliente: true })
  })

  it('el pegajoso solo se aplica si no hay decisión', () => {
    const s = estado({ clienteDefault: { idCli: 7, sin: false } })
    expect(aplicarClienteDefault(s, entrada({ seq: 1, imei: IMEI_1 }))).toMatchObject({ idCli: 7 })
    expect(aplicarClienteDefault(s, entrada({ seq: 1, imei: IMEI_1, idCli: 3 }))).toMatchObject({ idCli: 3 })
    expect(aplicarClienteDefault(s, entrada({ seq: 1, imei: IMEI_1, sinCliente: true }))).toMatchObject({ idCli: null, sinCliente: true })
    expect(aplicarClienteDefault(estado(), entrada({ seq: 1, imei: IMEI_1 }))).toMatchObject({ idCli: null })
  })

  it('la BD manda salvo decisión manual del IMEI', () => {
    const e = entrada({ seq: 1, imei: IMEI_1, idCli: 7 })
    expect(aplicarClienteBd(estado(), e, 4)).toMatchObject({ idCli: 4, sinCliente: false })
    expect(aplicarClienteBd(estado({ clienteManual: { [IMEI_1]: { idCli: 7, sin: false } } }), e, 4)).toMatchObject({ idCli: 7 })
    expect(aplicarClienteBd(estado(), e, null)).toMatchObject({ idCli: 7 })
  })

  it('propaga a las tres colas, solo al IMEI', () => {
    const s = estado({
      rep: [entrada({ seq: 1, imei: IMEI_1 }), entrada({ seq: 2, imei: IMEI_2 })],
      glass: [entrada({ seq: 3, imei: IMEI_1, tipo: 'GLASS' })],
      pulido: [fila(IMEI_1)],
    })
    const r = propagarCliente(s, IMEI_1, { idCli: null, sin: true })
    expect(r.rep[0]).toMatchObject({ idCli: null, sinCliente: true })
    expect(r.rep[1]).toMatchObject({ idCli: null, sinCliente: false })
    expect(r.glass[0].sinCliente).toBe(true)
    expect(r.pulido[0].sinCliente).toBe(true)
  })

  it('elegir: pegajoso siempre, decisión manual y propagación si hay entrada cargada', () => {
    const s = estado({ rep: [entrada({ seq: 1, imei: IMEI_1 })], glass: [entrada({ seq: 2, imei: IMEI_1, tipo: 'GLASS' })], actual: 1 })
    const r = elegirCliente(s, { idCli: 5, sin: false })
    expect(r.clienteDefault).toEqual({ idCli: 5, sin: false })
    expect(r.clienteManual[IMEI_1]).toEqual({ idCli: 5, sin: false })
    expect(r.glass[0].idCli).toBe(5)
    const sinActual = elegirCliente({ ...s, actual: null }, { idCli: 5, sin: false })
    expect(sinActual.clienteManual).toEqual({})
    expect(sinActual.clienteDefault).toEqual({ idCli: 5, sin: false })
  })
})
