import { describe, expect, it } from 'vitest'
import { resumen } from '../test/fabrica'
import { CABECERAS_PULIDOS_PENDIENTES, filaPulidoPendiente, NOMBRE_CSV_PULIDOS_PENDIENTES } from './csvPulidos'

describe('CSV pulidos_pendientes (0.9.21: «Capacidad» y «Color» detrás de «Modelo»)', () => {
  it('nombre y cabeceras', () => {
    expect(NOMBRE_CSV_PULIDOS_PENDIENTES).toBe('pulidos_pendientes')
    expect(CABECERAS_PULIDOS_PENDIENTES).toEqual(['ID', 'IMEI', 'Modelo', 'Capacidad', 'Color', 'Fecha asig.', 'Comentario'])
  })

  it('la fila, con «Modelo» solo el modelo; sin NSYS ni modelo, vacías', () => {
    const r = resumen({ idRep: 'AP20261022_1', imei: '350000000000001', modelo: '13', capacidad: '128GB', color: 'Azul',
      fechaAsig: '2026-10-22T08:00:00', comentarioAsignacion: 'rayado' })
    expect(filaPulidoPendiente(r)).toEqual(['AP20261022_1', '="350000000000001"', 'iPhone 13', '128GB', 'Azul', '22/10/2026 10:00', 'rayado'])
    expect(filaPulidoPendiente({ ...r, modelo: null, capacidad: null, color: null, comentarioAsignacion: null }))
      .toEqual(['AP20261022_1', '="350000000000001"', '', '', '', '22/10/2026 10:00', ''])
  })
})
