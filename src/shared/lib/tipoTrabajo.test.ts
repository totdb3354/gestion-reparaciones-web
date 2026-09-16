import { describe, expect, it } from 'vitest'
import { TIPO_TRABAJO, tipoDe } from './tipoTrabajo'

describe('tipoTrabajo (calco de TipoTrabajo.desde)', () => {
  it('deriva el tipo del prefijo, asignaciones e historial', () => {
    expect(tipoDe('A20260828_1')).toBe('REPARACION')
    expect(tipoDe('R20260828_1')).toBe('REPARACION')
    expect(tipoDe('AG20260828_1')).toBe('GLASS')
    expect(tipoDe('G20260828_1')).toBe('GLASS')
    expect(tipoDe('AP20260828_1')).toBe('PULIDO')
    expect(tipoDe('P20260828_1')).toBe('PULIDO')
    expect(tipoDe(null)).toBe('REPARACION')
  })
  it('etiquetas y paletas por tipo', () => {
    expect(TIPO_TRABAJO.REPARACION.etiqueta).toBe('Reparación')
    expect(TIPO_TRABAJO.GLASS.etiqueta).toBe('Glass')
    expect(TIPO_TRABAJO.PULIDO.etiqueta).toBe('Pulido')
    expect(TIPO_TRABAJO.GLASS.clases).toContain('bg-tipo-glass-bg')
  })
})
