import { describe, expect, it } from 'vitest'
import { resumen } from '../test/fabrica'
import { cabecerasHistorialPulidos, filaHistorialPulido } from './csvTrabajos'

describe('CSV historial_pulidos (0.9.21: «Capacidad» y «Color» detrás de «Modelo»)', () => {
  const pulido = resumen({ idRep: 'P20261022_1', imei: '350000000000001', modelo: '13', capacidad: '128GB', color: 'Azul',
    nombreTecnico: 'Técnico 2', fechaAsig: '2026-10-22T08:00:00', fechaFin: '2026-10-22T08:30:00', comentarioAsignacion: 'rayado' })

  it('cabeceras con «Técnico» (supertécnico y admin) y sin él (técnico)', () => {
    expect(cabecerasHistorialPulidos(true)).toEqual(['ID', 'IMEI', 'Modelo', 'Capacidad', 'Color', 'Técnico', 'Fecha inicio', 'Fecha fin', 'Comentario'])
    expect(cabecerasHistorialPulidos(false)).toEqual(['ID', 'IMEI', 'Modelo', 'Capacidad', 'Color', 'Fecha inicio', 'Fecha fin', 'Comentario'])
  })

  it('la fila: el modelo solo en «Modelo» y la capacidad y el color en las suyas; sin NSYS, vacías', () => {
    expect(filaHistorialPulido(pulido, true))
      .toEqual(['P20261022_1', '="350000000000001"', 'iPhone 13', '128GB', 'Azul', 'Técnico 2', '22/10/2026 10:00', '22/10/2026 10:30', 'rayado'])
    expect(filaHistorialPulido({ ...pulido, capacidad: null, color: null }, false))
      .toEqual(['P20261022_1', '="350000000000001"', 'iPhone 13', '', '', '22/10/2026 10:00', '22/10/2026 10:30', 'rayado'])
  })
})
