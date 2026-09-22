import { screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { resumen, tecnico } from '../test/fabrica'
import { AsignacionesPage } from './AsignacionesPage'

// Una fila por categoría, en el orden en que las devuelve el servidor (reparación, glass, pulido) y con los tres
// rangos del orden de prioridad repartidos a contrapelo: la urgente llega la segunda y la de cliente la tercera.
const reparacion = resumen({ idRep: 'A20260916_1', imei: '000000000000001', cliente: null })
const glass = resumen({ idRep: 'AG20260916_2', imei: '000000000000002', cliente: null, urgente: true })
const pulido = resumen({ idRep: 'AP20260916_3', imei: '000000000000003', cliente: 'CLIENTE A' })

beforeEach(() => {
  server.use(
    http.get('*/api/reparaciones/asignaciones', () => HttpResponse.json([reparacion])),
    http.get('*/api/glass/asignaciones', () => HttpResponse.json([glass])),
    http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([pulido])),
    http.get('*/api/tecnicos/activos', () => HttpResponse.json([tecnico({ idTec: 4, nombre: 'Técnico A' })])),
  )
})

const abrir = () => renderConProviders(<AsignacionesPage />, { sesion: SESION_SUPER, ruta: '/reparaciones/asignaciones' })

describe('AsignacionesPage', () => {
  it('muestra el título y el contador filtrado', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Asignaciones pendientes' })).toBeInTheDocument()
    // findByText: el título es estático y sale en el primer render, antes de que resuelvan los GET de los que
    // depende el contador (mismo motivo que en PendientesPage.test.tsx).
    expect(await screen.findByText('3 asignaciones')).toBeInTheDocument()
    // El modal "Asignar trabajos" es el sub-proyecto 3b: el botón está en su sitio, deshabilitado y con el tooltip
    // en el envoltorio, que es quien recibe el hover.
    const asignar = screen.getByRole('button', { name: 'Asignar' })
    expect(asignar).toBeDisabled()
    expect(asignar.parentElement).toHaveAttribute('title', 'Disponible en el siguiente sub-proyecto')
    expect(await screen.findByText(/^Actualizado /)).toBeInTheDocument()
  })

  it('pinta las tres categorías en la misma tabla', async () => {
    abrir()
    expect(await screen.findByText('A20260916_1')).toBeInTheDocument()
    expect(screen.getByText('AG20260916_2')).toBeInTheDocument()
    expect(screen.getByText('AP20260916_3')).toBeInTheDocument()
  })

  it('las urgentes salen primero', async () => {
    abrir()
    await screen.findByText('A20260916_1')
    const ids = screen.getAllByRole('row').slice(1).map((f) => within(f).getAllByRole('cell')[0].textContent)
    expect(ids).toEqual(['AG20260916_2', 'AP20260916_3', 'A20260916_1'])
  })

  it('la tabla no se puede ordenar por columna', async () => {
    abrir()
    await screen.findByText('A20260916_1')
    const cabeceras = screen.getAllByRole('columnheader')
    expect(cabeceras).toHaveLength(11)
    for (const c of cabeceras) expect(within(c).queryByRole('button')).not.toBeInTheDocument()
  })
})
