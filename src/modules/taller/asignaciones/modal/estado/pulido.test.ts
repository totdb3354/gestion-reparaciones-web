import { describe, expect, it } from 'vitest'
import { pulidoCliente, pulidoClienteBd, pulidoComentario, pulidoEscanear, pulidoPegar, pulidoQuitar, pulidoSeleccionar,
  pulidoTecArriba, pulidoTecnico } from './pulido'
import { entrada, estado, filaTabla, IMEI_1, IMEI_2 } from './fabrica'

const conPulido = () => pulidoEscanear(pulidoTecArriba(estado({ pestana: 'PULIDO' }), 5), IMEI_1)

describe('pulido', () => {
  it('añade con el técnico de arriba, comentario vacío, lo selecciona y pide el cliente de BD', () => {
    const r = conPulido()
    expect(r.pulido[0]).toEqual({ seq: 1, imei: IMEI_1, idTec: 5, comentario: '', idCli: null, sinCliente: false })
    expect(r.pulidoSel).toBe(1)
    expect(r.efectos).toEqual([{ id: 1, tipo: 'clientePulido', seq: 1, imei: IMEI_1 }])
  })
  it('el técnico de arriba puede faltar y cambiarlo no toca las filas ya añadidas', () => {
    const r = pulidoTecArriba(conPulido(), 6)
    expect(r.pulido[0].idTec).toBe(5)
    expect(pulidoEscanear(estado({ pestana: 'PULIDO' }), IMEI_1).pulido[0].idTec).toBeNull()
  })
  it('repetido: mensaje', () => {
    expect(pulidoEscanear(conPulido(), IMEI_1).mensajePulido).toEqual({ texto: 'Ese IMEI ya está en la lista de pulido.', tono: 'error' })
  })
  it('no bloquea al técnico que ya tiene ese IMEI en pulido (D4: lo frena el lote)', () => {
    const s = pulidoTecArriba(estado({ pestana: 'PULIDO', tabla: [filaTabla({ idRep: 'AP1', imei: IMEI_1, idTec: 5 })] }), 5)
    expect(pulidoEscanear(s, IMEI_1).pulido[0].idTec).toBe(5)
  })
  it('pegado: selecciona la última y avisa con su texto corto', () => {
    const r = pulidoPegar(conPulido(), IMEI_1 + IMEI_2)
    expect(r.pulidoSel).toBe(2)
    expect(r.mensajePulido).toEqual({ texto: '1 IMEIs añadidos · 1 ya estaban.', tono: 'ok' })
    expect(pulidoPegar(estado(), '1'.repeat(16)).mensajePulido).toEqual({ texto: 'Algún IMEI del pegado está corrupto.', tono: 'error' })
  })
  it('detalle: técnico, comentario y cliente de la fila seleccionada', () => {
    let r = pulidoTecnico(conPulido(), 7)
    r = pulidoComentario(r, 'con cuidado')
    expect(r.pulido[0]).toMatchObject({ idTec: 7, comentario: 'con cuidado' })
  })
  it('elegir cliente en pulido: decisión manual, pegajoso y propagación a las otras colas', () => {
    const s = { ...conPulido(), rep: [entrada({ seq: 9, imei: IMEI_1 })] }
    const r = pulidoCliente(s, { idCli: 4, sin: false })
    expect(r.clienteManual[IMEI_1]).toEqual({ idCli: 4, sin: false })
    expect(r.clienteDefault).toEqual({ idCli: 4, sin: false })
    expect(r.rep[0].idCli).toBe(4)
  })
  it('seleccionar aplica el pegajoso si la fila no tiene decisión', () => {
    const s = { ...conPulido(), clienteDefault: { idCli: 8, sin: false }, pulidoSel: null }
    expect(pulidoSeleccionar(s, 1).pulido[0].idCli).toBe(8)
  })
  it('cliente de BD: manda salvo decisión manual', () => {
    expect(pulidoClienteBd(conPulido(), 1, 3).pulido[0].idCli).toBe(3)
    const manual = { ...conPulido(), clienteManual: { [IMEI_1]: { idCli: null, sin: true } } }
    expect(pulidoClienteBd(manual, 1, 3).pulido[0].idCli).toBeNull()
  })
  it('quitar la seleccionada vacía el detalle', () => {
    const r = pulidoQuitar(conPulido(), 1)
    expect([r.pulido, r.pulidoSel]).toEqual([[], null])
  })
})
