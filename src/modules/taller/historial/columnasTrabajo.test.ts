import { describe, expect, it } from 'vitest'
import { columnasTrabajo } from './columnasTrabajo'

/** [id, size (minWidth del FXML, peso al estirar), maxSize (maxWidth del FXML)] de cada columna, en orden. */
const anchos = (conTipo: boolean) =>
  columnasTrabajo({ conTipo, patronFechas: 'yyyy/MM/dd', tituloId: 'Id', onIrA: () => {} }).map((c) => [c.id, c.size, c.maxSize])

const COMUNES = [
  ['id', 110, undefined],
  ['imei', 130, undefined],
  ['modelo', 100, undefined],
  ['reparador', 100, undefined],
  ['asignadoPor', 100, undefined],
  ['fechas', 110, undefined],
  ['componente', 150, undefined],
  ['observaciones', 200, 320],
  ['estado', 110, 150],
  ['incidencia', 200, 360],
  ['anterior', 150, undefined],
]

describe('columnasTrabajo: anchos de los FXML (minWidth como peso y maxWidth como tope)', () => {
  it('Historial (ReparacionView{SuperTecnico,Tecnico,Admin}.fxml): topes en Observaciones 320, Estado 150 e Incidencia 360', () => {
    expect(anchos(false)).toEqual(COMUNES)
  })

  it('detalle de IMEIs (AgrupadoView.fxml): los mismos anchos y topes, y delante Tipo con tope 120', () => {
    expect(anchos(true)).toEqual([['tipo', 100, 120], ...COMUNES])
  })
})
