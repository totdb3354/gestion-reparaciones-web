import { ChartColumn, ScrollText, UserCog, Users } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import { gruposNav } from './navegacion'

const resumen = (grupos: ReturnType<typeof gruposNav>) => grupos.map((g) => [g.id, g.titulo, g.enlaces.map((e) => e.label)])

describe('grupos de la columna lateral (0.9.14)', () => {
  it('técnico: Reparaciones con Pendientes, Stock solo con «Stock actual» (0.9.16), Estadísticas › Rendimiento y Clientes › Listado, sin Gestión', () => {
    expect(resumen(gruposNav(SESION_TEC))).toEqual([
      ['reparaciones', 'Reparaciones', ['Pendientes', 'Historial', 'IMEIs']],
      ['stock', 'Stock', ['Stock actual']],
      ['estadisticas', 'Estadísticas', ['Rendimiento']],
      ['clientes', 'Clientes', ['Listado']],
    ])
  })

  it('supertécnico: Asignaciones y Pendientes en Reparaciones, Stock con Pedidos y Proveedores, sin Gestión', () => {
    const grupos = gruposNav(SESION_SUPER)
    expect(grupos.map((g) => g.id)).toEqual(['reparaciones', 'stock', 'telefonos', 'estadisticas', 'clientes'])
    expect(grupos[0].enlaces.map((e) => e.label)).toEqual(['Asignaciones', 'Pendientes', 'Historial', 'IMEIs'])
    expect(grupos[1].enlaces.map((e) => e.label)).toEqual(['Stock actual', 'Pedidos', 'Proveedores'])
    expect(grupos[2].enlaces.map((e) => [e.label, e.to])).toEqual([['Stock de teléfonos', '/telefonos/stock']])
  })

  it('admin: Gestión al final con Técnicos y Logs', () => {
    const grupos = gruposNav(SESION_ADMIN)
    expect(grupos[0].enlaces.map((e) => e.label)).toEqual(['Asignaciones', 'Historial', 'IMEIs'])
    const gestion = grupos[grupos.length - 1]
    expect([gestion.id, gestion.titulo]).toEqual(['gestion', 'Gestión'])
    expect(gestion.enlaces.map((e) => [e.label, e.to])).toEqual([
      ['Técnicos', '/gestion/tecnicos'],
      ['Logs', '/gestion/logs'],
    ])
  })

  it('Rendimiento, Listado, Técnicos y Logs llevan sus iconos', () => {
    const enlaces = gruposNav(SESION_ADMIN).flatMap((g) => g.enlaces)
    const de = (label: string) => enlaces.find((e) => e.label === label)
    expect([de('Rendimiento')?.to, de('Rendimiento')?.icono]).toEqual(['/estadisticas', ChartColumn])
    expect([de('Listado')?.to, de('Listado')?.icono]).toEqual(['/clientes', Users])
    expect(de('Técnicos')?.icono).toBe(UserCog)
    expect(de('Logs')?.icono).toBe(ScrollText)
  })

  it('sin sesión: sin Gestión y sin números', () => {
    const grupos = gruposNav(null)
    expect(grupos.map((g) => g.id)).toEqual(['reparaciones', 'stock', 'estadisticas', 'clientes'])
    expect(grupos.flatMap((g) => g.enlaces).some((e) => e.badge)).toBe(false)
  })
})
