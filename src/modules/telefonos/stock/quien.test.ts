import { describe, expect, it } from 'vitest'
import type { MovilStock } from '@/shared/api/client'
import { AHORA, movil, trabajo } from '../test/fabrica'
import { CON_DESCUADRE, quienLoTiene, SIN_ASIGNAR } from './quien'

const q = (p: Partial<MovilStock>) => quienLoTiene(movil(p), AHORA)

describe('«Quién lo tiene» (spec 0.9.18 §4.7)', () => {
  it('una reparación: el técnico, y el detalle con su fecha', () => {
    const r = q({ ubicacion: 'Taller · Reparación', trabajos: [trabajo({ tecnico: 'Técnico 1' })] })
    expect(r.texto).toBe('Técnico 1')
    expect(r.etiquetas).toEqual(['Técnico 1'])
    expect(r.titulo).toBe('Reparación de Técnico 1 desde el 16/10')
    expect(r.enCaja).toBe(false)
    expect(r.descuadre).toBe(false)
  })

  it('reparación y glass sin entregar, en ese orden aunque la glass venga antes', () => {
    const r = q({ ubicacion: 'Taller · Reparación', trabajos: [
      trabajo({ categoria: 'GLASS', tecnico: 'Técnico 3', desde: '2026-10-15T12:00:00' }), trabajo({ tecnico: 'Técnico 1' })] })
    expect(r.texto).toBe('Técnico 1 · glass Técnico 3 sin entregar')
    expect(r.titulo).toBe('Reparación de Técnico 1 desde el 16/10 · Glass de Técnico 3 desde el 15/10: el móvil aún no le ha llegado')
    expect(r.etiquetas).toEqual(['Técnico 1', 'Técnico 3'])
  })

  it('solo glass: «llegó» con la hora si es de hoy y con el día si no', () => {
    const hoy = q({ ubicacion: 'Taller · Glass', trabajos: [trabajo({ categoria: 'GLASS', tecnico: 'Técnico 3', entregado: '2026-10-16T10:30:00' })] })
    expect(hoy.texto).toBe('Técnico 3 (glass) llegó 10:30')
    expect(hoy.titulo).toBe('Glass de Técnico 3 desde el 16/10: el móvil le llegó a las 10:30')
    expect(hoy.partes[0].entrega).toEqual({ texto: 'llegó 10:30', llego: true })
    const ayer = q({ ubicacion: 'Taller · Glass', trabajos: [trabajo({ categoria: 'GLASS', tecnico: 'Técnico 3', entregado: '2026-10-15T18:05:00' })] })
    expect(ayer.texto).toBe('Técnico 3 (glass) llegó 15/10')
    expect(ayer.titulo).toBe('Glass de Técnico 3 desde el 16/10: el móvil le llegó el 15/10 a las 18:05')
  })

  it('pulido', () => {
    const r = q({ ubicacion: 'Taller · Pulir', trabajos: [trabajo({ categoria: 'PULIDO', tecnico: 'Técnico 2' })] })
    expect(r.texto).toBe('Técnico 2 (pulido)')
    expect(r.titulo).toBe('Pulido de Técnico 2 desde el 16/10')
  })

  it('en una caja de taller sin trabajos: en caja, sin asignar', () => {
    const r = q({ ubicacion: 'Taller · Glass' })
    expect(r.enCaja).toBe(true)
    expect(r.texto).toBe('⚠ En caja, sin asignar')
    expect(r.etiquetas).toEqual([SIN_ASIGNAR])
    expect(r.titulo).toBe('Está en una caja de taller y nadie lo tiene asignado')
  })

  it('un móvil de pedido no está en la caja, aunque su última caja sea de taller', () => {
    const r = q({ ubicacion: 'Taller · Glass', estado: 'DE_PEDIDO' })
    expect(r.enCaja).toBe(false)
    expect(r.texto).toBe('—')
  })

  it('descuadre: trabajo abierto hace más de 60 minutos con el móvil en Listos', () => {
    // AHORA es el 16/10 a las 13:43 en Madrid; 12:42 son 61 minutos.
    const listos = q({ ubicacion: 'Listos', trabajos: [trabajo({ desde: '2026-10-16T12:42:00' })] })
    expect(listos.descuadre).toBe(true)
    expect(listos.texto).toBe('⚠ Técnico 1: trabajo abierto')
    expect(listos.etiquetas).toEqual(['Técnico 1', CON_DESCUADRE])
    expect(listos.titulo).toBe('Reparación de Técnico 1 desde el 16/10 · NSYS dice "Listos", pero hay un trabajo abierto. ¿Falta cerrarlo o mover la caja?')
  })

  it('un móvil de pedido con trabajo abierto no es descuadre: tiene dueño, pero se repara hasta el Released (0.9.18.1)', () => {
    // El trabajo por defecto es de las 09:00: 4 h 43 min antes de AHORA.
    const r = q({ ubicacion: 'Taller · Reparación', estado: 'DE_PEDIDO', trabajos: [trabajo()] })
    expect(r.descuadre).toBe(false)
    expect(r.texto).toBe('Técnico 1')
    expect(r.etiquetas).toEqual(['Técnico 1'])
    expect(r.titulo).toBe('Reparación de Técnico 1 desde el 16/10')
  })

  it('tampoco si la última caja que se conoce del móvil de pedido es Listos (0.9.18.1)', () => {
    const r = q({ ubicacion: 'Listos', estado: 'DE_PEDIDO', trabajos: [trabajo()] })
    expect(r.descuadre).toBe(false)
    expect(r.texto).toBe('Técnico 1')
  })

  it('con 60 minutos justos todavía no es descuadre: la caja de NSYS llega con retraso', () => {
    const r = q({ ubicacion: 'Listos', trabajos: [trabajo({ desde: '2026-10-16T12:43:00' })] })
    expect(r.descuadre).toBe(false)
    expect(r.texto).toBe('Técnico 1')
  })

  it('fuera de taller y sin trabajos: una raya, sin etiquetas ni detalle', () => {
    const r = q({ ubicacion: 'En revisión' })
    expect(r.texto).toBe('—')
    expect(r.etiquetas).toEqual([])
    expect(r.titulo).toBe('')
  })

  it('el descuadre nombra solo a quien lleva más de 60 minutos; el filtro Técnico sigue con todos', () => {
    // 12:42 son 61 minutos antes de las 13:43; 13:33, 10 minutos.
    const r = q({ ubicacion: 'Listos', trabajos: [
      trabajo({ tecnico: 'Técnico 1', desde: '2026-10-16T12:42:00' }),
      trabajo({ categoria: 'PULIDO', tecnico: 'Técnico 2', desde: '2026-10-16T13:33:00' })] })
    expect(r.descuadre).toBe(true)
    expect(r.texto).toBe('⚠ Técnico 1: trabajo abierto')
    expect(r.etiquetas).toEqual(['Técnico 1', 'Técnico 2', CON_DESCUADRE])
  })

  it('una respuesta sin trabajos (servidor 0.9.17) no rompe la pantalla', () => {
    const sinTrabajos = { ...movil({ ubicacion: 'Listos' }), trabajos: undefined } as unknown as MovilStock
    const r = quienLoTiene(sinTrabajos, AHORA)
    expect(r.texto).toBe('—')
    expect(r.etiquetas).toEqual([])
  })
})
