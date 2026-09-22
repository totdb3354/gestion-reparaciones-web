import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { TEXTO_COPIAR_CELDA } from '@/shared/ui/MenuCopiarCelda'
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
    // El editor de cliente del menú contextual (Task 12) carga el catálogo de clientes activos con la vista.
    http.get('*/api/clientes/activos', () => HttpResponse.json([{ idCli: 1, nombre: 'CLIENTE A', activo: true, updatedAt: '2026-09-01T00:00:00' }])),
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

  it('el contador y la tabla usan la lista filtrada, y un IMEI incompleto no filtra', async () => {
    abrir()
    await screen.findByText('A20260916_1')
    const campo = screen.getByRole('textbox', { name: 'Filtrar por IMEI' })
    // Tecleando a medias la tabla no se toca: el filtro solo cuenta con los IMEIs de 15 dígitos.
    await userEvent.type(campo, '00000')
    expect(screen.getByText('3 asignaciones')).toBeInTheDocument()
    await userEvent.type(campo, '0000000001')
    expect(await screen.findByText('1 asignación')).toBeInTheDocument()
    expect(screen.getByText('A20260916_1')).toBeInTheDocument()
    expect(screen.queryByText('AG20260916_2')).not.toBeInTheDocument()
  })

  it('el clic derecho selecciona la fila y abre su menú contextual', async () => {
    abrir()
    await screen.findByText('A20260916_1')
    const fila = screen.getAllByRole('row').find((f) => within(f).queryByText('A20260916_1'))!
    fireEvent.contextMenu(within(fila).getByText('A20260916_1'))
    // El menú se abre sobre la fila pulsada y, como en el JavaFX, la deja seleccionada: así la acción no cae en otra.
    const items = (await screen.findAllByRole('menuitem')).map((i) => i.textContent)
    expect(items).toEqual([TEXTO_COPIAR_CELDA, 'Editar comentario', 'Editar cliente', 'Marcar urgente', 'Marcar chasis'])
    expect(fila).toHaveAttribute('aria-selected', 'true')
  })

  it('Limpiar filtros devuelve todas las filas', async () => {
    abrir()
    await screen.findByText('A20260916_1')
    await userEvent.type(screen.getByRole('textbox', { name: 'Filtrar por IMEI' }), '000000000000001')
    await screen.findByText('1 asignación')
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(await screen.findByText('3 asignaciones')).toBeInTheDocument()
  })
})
