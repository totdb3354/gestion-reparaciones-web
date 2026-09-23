import { describe, expect, it } from 'vitest'
import { construirLote } from './lote'
import { entrada, estado, IMEI_1, IMEI_2 } from './estado/fabrica'

describe('construirLote', () => {
  it('un teléfono por IMEI y una asignación por entrada verde × técnico, más el pulido', () => {
    const s = estado({
      rep: [entrada({ seq: 1, imei: IMEI_1, asignada: true, modelo: '12', tecnicos: [3, 4], comentario: ' ojo ', esChasis: true, idCli: 5 }),
        entrada({ seq: 2, imei: IMEI_2 })],   // roja: no viaja
      glass: [entrada({ seq: 3, imei: IMEI_1, tipo: 'GLASS', asignada: true, modelo: '12', tecnicos: [6], idCli: 5, esChasis: true })],
      pulido: [{ seq: 4, imei: IMEI_2, idTec: 7, comentario: '', idCli: null, sinCliente: true }],
    })
    expect(construirLote(s)).toEqual({
      telefonos: [
        { imei: IMEI_1, modelo: '12', idCli: 5, clienteExplicito: false },
        { imei: IMEI_2, modelo: null, idCli: null, clienteExplicito: true },
      ],
      asignaciones: [
        { imei: IMEI_1, categoria: 'R', idTec: 3, comentario: 'ojo', esChasis: true },
        { imei: IMEI_1, categoria: 'R', idTec: 4, comentario: 'ojo', esChasis: true },
        { imei: IMEI_1, categoria: 'G', idTec: 6, comentario: null, esChasis: false },
        { imei: IMEI_2, categoria: 'P', idTec: 7, comentario: null, esChasis: false },
      ],
    })
  })
  it('un IMEI en pulido y en reparación conserva el modelo de la reparación', () => {
    const s = estado({
      pulido: [{ seq: 1, imei: IMEI_1, idTec: 7, comentario: '', idCli: null, sinCliente: false }],
      rep: [entrada({ seq: 2, imei: IMEI_1, asignada: true, modelo: '12', tecnicos: [3] })],
    })
    expect(construirLote(s).telefonos).toEqual([{ imei: IMEI_1, modelo: '12', idCli: null, clienteExplicito: false }])
  })
})
