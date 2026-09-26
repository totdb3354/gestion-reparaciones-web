import { describe, expect, it } from 'vitest'
import { glass, normal, resumen } from '../test/fabrica'
import { CABECERAS_ASIGNACIONES, filaAsignacionCsv, NOMBRE_CSV_ASIGNACIONES } from './csv'

// Índices de las columnas, en el orden de CABECERAS_ASIGNACIONES.
const TIPO = 1
const TECNICO = 2
const MODELO = 4
const FECHA = 5
const COMENTARIO = 6
const CLIENTE = 7
const ASIGNADO_POR = 8
const URGENTE = 9
const CHASIS = 10
const POR_CERRAR = 11
const ENTREGADO = 12
const EN_ESPERA = 13

describe('CSV de Asignaciones (calco de filaAsignacion del hotfix 0.16.3)', () => {
  it('nombre del fichero y las 14 cabeceras exactas en orden', () => {
    expect(NOMBRE_CSV_ASIGNACIONES).toBe('reparaciones_pendientes')
    expect(CABECERAS_ASIGNACIONES).toEqual([
      'ID', 'Tipo', 'Técnico', 'IMEI', 'Modelo', 'Fecha asignación', 'Comentario', 'Cliente', 'Asignado por', 'Urgente',
      'Chasis', 'Por cerrar', 'Entregado', 'En espera de pieza',
    ])
  })

  it('fila completa de una reparación: todos los campos, fecha en hora de Madrid y "Sí" en las marcas', () => {
    const r = resumen({
      idRep: 'A20260916_1', imei: '000000000000000', nombreTecnico: 'tecnico-a', modelo: '14', fechaAsig: '2026-09-16T07:02:00',
      comentarioAsignacion: 'Pantalla rota', cliente: 'Cliente A', nombreTecnicoAsigna: 'tecnico-b', urgente: true, esChasis: true,
      porCerrar: true, glassAbierta: true, glassEntregadoAt: '2026-09-16T08:42:00', glassTecnicoNombre: 'tecnico-c',
      esSolicitud: 1, estadoSolicitud: 'PENDIENTE', stockSolicitud: 0,
    })
    expect(filaAsignacionCsv(r)).toEqual([
      'A20260916_1', 'Reparación', 'tecnico-a', '="000000000000000"', 'iPhone 14', '16/09/2026 09:02', 'Pantalla rota', 'Cliente A',
      'tecnico-b', 'Sí', 'Sí', 'Sí', '16/09/2026 10:42', 'Sí',
    ])
  })

  it('fecha de asignación en invierno: UTC+1', () => {
    expect(filaAsignacionCsv(resumen({ fechaAsig: '2026-01-15T07:02:00' }))[FECHA]).toBe('15/01/2026 08:02')
  })

  it('tipo por prefijo: A → Reparación, AG → Glass, AP → Pulido', () => {
    expect(filaAsignacionCsv(resumen({ idRep: 'A20260916_1' }))[TIPO]).toBe('Reparación')
    expect(filaAsignacionCsv(resumen({ idRep: 'AG20260916_2' }))[TIPO]).toBe('Glass')
    expect(filaAsignacionCsv(resumen({ idRep: 'AP20260916_3' }))[TIPO]).toBe('Pulido')
  })

  it('nulos: técnico, modelo, comentario y cliente vacíos; "Asignado por" nulo es "—"', () => {
    // El contrato declara nombreTecnico no nulo; el JavaFX lo protege igual (`!= null ? … : ""`) y aquí también.
    const fila = filaAsignacionCsv(resumen({
      nombreTecnico: null as unknown as string, modelo: null, comentarioAsignacion: null, cliente: null, nombreTecnicoAsigna: null,
    }))
    expect(fila[TECNICO]).toBe('')
    expect(fila[MODELO]).toBe('')
    expect(fila[COMENTARIO]).toBe('')
    expect(fila[CLIENTE]).toBe('')
    expect(fila[ASIGNADO_POR]).toBe('—')
    expect(filaAsignacionCsv(resumen({ modelo: '' }))[MODELO]).toBe('')
  })

  it('marcas a false son "No"', () => {
    const fila = filaAsignacionCsv(resumen({ urgente: false, esChasis: false, porCerrar: false }))
    expect([fila[URGENTE], fila[CHASIS], fila[POR_CERRAR]]).toEqual(['No', 'No', 'No'])
  })

  it('Entregado: fecha de la entrega en A y AG, vacío sin entrega y en pulidos', () => {
    expect(filaAsignacionCsv(normal(true, '2026-08-28T08:42:00'))[ENTREGADO]).toBe('28/08/2026 10:42')
    expect(filaAsignacionCsv(glass('2026-08-28T08:42:00'))[ENTREGADO]).toBe('28/08/2026 10:42')
    expect(filaAsignacionCsv(normal(true, null))[ENTREGADO]).toBe('')
    expect(filaAsignacionCsv(resumen({ idRep: 'AP20260828_1', entregadoAt: '2026-08-28T08:42:00' }))[ENTREGADO]).toBe('')
  })

  it('en espera de pieza: sin solicitud No; solicitud sin gestionar Sí; gestionada sin stock Sí; gestionada con stock No', () => {
    const espera = (p: Parameters<typeof resumen>[0]) => filaAsignacionCsv(resumen(p))[EN_ESPERA]
    expect(espera({ esSolicitud: 0, estadoSolicitud: null, stockSolicitud: 0 })).toBe('No')
    expect(espera({ esSolicitud: 2, estadoSolicitud: 'PENDIENTE', stockSolicitud: 5 })).toBe('Sí')
    expect(espera({ esSolicitud: 1, estadoSolicitud: 'GESTIONADA', stockSolicitud: 0 })).toBe('Sí')
    expect(espera({ esSolicitud: 1, estadoSolicitud: 'GESTIONADA', stockSolicitud: 3 })).toBe('No')
  })
})
