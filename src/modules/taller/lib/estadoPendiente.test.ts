import { describe, expect, it } from 'vitest'
import { glass, normal, resumen } from '../test/fabrica'
import { badgesEstado } from './estadoPendiente'

const HOY = '2026-08-28'
const textos = (r: Parameters<typeof badgesEstado>[0]) => badgesEstado(r, HOY).map((b) => b.texto)

describe('badgesEstado (calco de la celda Estado de PendientesTecnicoController)', () => {
  it('Normal sola por defecto; Urgente sin Normal; Por cerrar encima', () => {
    expect(textos(resumen())).toEqual(['Normal'])
    expect(textos(resumen({ urgente: true }))).toEqual(['Urgente'])
    expect(textos(resumen({ porCerrar: true }))).toEqual(['Por cerrar', 'Normal'])
    expect(textos(resumen({ urgente: true, porCerrar: true }))).toEqual(['Urgente', 'Por cerrar'])
  })
  it('entrega: "→ X" en reparaciones entregadas y "Llegó" en glass, entre Por cerrar y el estado', () => {
    expect(textos({ ...normal(true, '2026-08-28T08:42:00'), porCerrar: true })).toEqual(['Por cerrar', '→ Técnico H', 'Normal'])
    const b = badgesEstado(glass('2026-08-28T08:42:00'), HOY)
    expect(b.map((x) => x.texto)).toEqual(['Llegó 10:42', 'Normal'])
    expect(b[0].tooltip).toBe('Bajado por Técnico J, 28/08 10:42')
    expect(b[0].clases).toContain('bg-entrega-bg')
  })
  it('Incidencia manda sobre solicitud; Recibido / En camino / Solicitud con sub-etiqueta y tooltip', () => {
    expect(textos(resumen({ esIncidencia: true, esSolicitud: 1 }))).toEqual(['Incidencia'])
    const recibido = badgesEstado(resumen({ esSolicitud: 1, estadoSolicitud: 'GESTIONADA', stockSolicitud: 2, tiposSolicitud: 'Batería' }), HOY)
    expect(recibido.map((x) => x.texto)).toEqual(['Recibido'])
    expect(recibido[0].sub).toBe('Batería')
    expect(recibido[0].tooltip).toBe('Batería')
    expect(textos(resumen({ esSolicitud: 1, enCamino: true }))).toEqual(['En camino'])
    const varias = badgesEstado(resumen({ esSolicitud: 2, tiposSolicitud: 'Batería, Pantalla' }), HOY)
    expect(varias.map((x) => x.texto)).toEqual(['Solicitud'])
    expect(varias[0].sub).toBe('2 piezas')
    expect(varias[0].tooltip).toBe('Batería, Pantalla')
    expect(varias[0].clases).toContain('bg-fila-solicitud-bg')
  })
})
