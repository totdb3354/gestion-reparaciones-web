import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
// eslint-disable-next-line no-restricted-imports -- solo "Descargar CSV" necesita el AppLayout real (TopBar/UserMenu); ver su uso más abajo.
import { AppLayout } from '@/app/shell/AppLayout'
import { server } from '@/test/server'
import { renderConProviders, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import * as csv from '@/shared/lib/csv'
import { reiniciarEstadoTaller } from '../estado'
import { resumen, tecnico } from '../test/fabrica'
import { HistorialPage } from './HistorialPage'

const filas = [
  resumen({ idRep: 'R20260916_6', imei: '358800000000131', modelo: '14', nombreTecnico: 'tecnico_i', idTec: 5, nombreTecnicoAsigna: 'Técnico M', fechaAsig: '2026-09-16T07:00:00', fechaFin: '2026-09-16T07:00:00', tipoComponente: 'otroi14', observaciones: 'cerrar' }),
  resumen({ idRep: 'R20260915_133', imei: '351900000000041', modelo: '16', nombreTecnico: 'tecnico_b', idTec: 6, fechaAsig: '2026-09-15T15:00:00', fechaFin: '2026-09-15T15:00:00', tipoComponente: 'bati16', esReutilizado: true, esIncidencia: true, incidencia: 'no enciende' }),
  resumen({ idRep: 'R20260910_1', imei: '351900000000041', modelo: '16', nombreTecnico: 'tecnico_i', idTec: 5, fechaAsig: '2026-09-10T10:00:00', fechaFin: '2026-09-11T10:00:00', tipoComponente: 'lcdi16negra', esIncidencia: true, esResuelto: true, incidencia: 'pantalla', idRepAnterior: 'R20260916_6' }),
]
const tecnicos = [tecnico({ idTec: 5, nombre: 'tecnico_i' }), tecnico({ idTec: 6, nombre: 'tecnico_b' }), tecnico({ idTec: 7, nombre: 'tecnico_n', activo: false })]

beforeEach(() => {
  reiniciarEstadoTaller()
  server.use(
    http.get('*/api/reparaciones/historial', () => HttpResponse.json(filas)),
    http.get('*/api/glass/historial', () => HttpResponse.json([])),
    http.get('*/api/tecnicos', () => HttpResponse.json(tecnicos)),
    http.get('*/api/tecnicos/activos', () => HttpResponse.json(tecnicos.filter((t) => t.activo))),
    // El test del CSV monta <AppLayout/>: su SubNav pinta el badge de "Pendientes" del supertécnico (BadgePendientes),
    // que pide esto aparte de los datos del propio Historial (como en la Task 14).
    http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json({ reparaciones: 0, glass: 0, pulidos: 0 })),
  )
})
const abrir = (sesion = SESION_SUPER) => renderConProviders(<HistorialPage tipo="REPARACION" />, { sesion, ruta: '/reparaciones/historial' })

describe('HistorialPage (ficha docs/paridad/historial.md)', () => {
  it('título por rol, contador, toggles y columnas estiradas', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Historial de reparaciones' })).toBeInTheDocument()
    expect(await screen.findByText('3 reparaciones')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Reparaciones' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Pulidos' })).toHaveAttribute('href', '/reparaciones/historial/pulidos')
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Id Reparación', 'IMEI teléfono', 'Modelo', 'Reparador', 'Asignado por', 'Fechas', 'Componente', 'Observaciones', 'Estado', 'Incidencia', 'Id Rep. Anterior'])
    expect(screen.getByRole('table')).toHaveClass('w-full')
    expect(screen.getByText('Reutilizado')).toHaveClass('italic')
    expect(screen.getByText('2026/09/16')).toBeInTheDocument()
    expect(screen.getAllByText('Sin incidencia')).toHaveLength(1)
    expect(screen.getByText('Resuelta')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /R20260915_133/ })).toHaveClass('border-l-fila-incidencia-brd')
    expect(screen.getByRole('row', { name: /R20260910_1/ })).toHaveClass('border-l-fila-reparado-brd')
  })
  it('el técnico ve "Mis reparaciones" y no tiene filtro de técnico', async () => {
    abrir(SESION_TEC)
    expect(await screen.findByRole('heading', { name: 'Mis reparaciones' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Técnico' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pieza' })).toBeInTheDocument()
  })
  it('filtros Técnico (todos, incluidos inactivos), Pieza (categorías presentes), fechas e incidencias', async () => {
    abrir()
    // R20260916_6 aparece también como enlace "Id Rep. Anterior" de R20260910_1: se espera por R20260915_133
    // (única) para no colisionar con screen.getByText, que hace coincidencia exacta sin distinguir columna.
    await screen.findByText('R20260915_133')
    await userEvent.click(screen.getByRole('button', { name: 'Técnico' }))
    expect(screen.getByRole('checkbox', { name: 'tecnico_n' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'tecnico_i' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'tecnico_i' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: 'Pieza' }))
    expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual(['Batería', 'Otros', 'Pantalla'])
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pantalla' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getByText('1 reparación')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getAllByRole('row')).toHaveLength(4)
    await userEvent.type(screen.getByLabelText('Desde:'), '2026-09-16')
    expect(screen.getAllByRole('row')).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await userEvent.click(screen.getByRole('button', { name: 'Incidencias' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Cerradas' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Cerradas' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })
  it('el enlace Id Rep. Anterior selecciona esa fila', async () => {
    abrir()
    await screen.findByText('R20260915_133')
    await userEvent.click(screen.getByRole('button', { name: 'R20260916_6' }))
    expect(screen.getByRole('row', { name: /^R20260916_6 / })).toHaveAttribute('aria-selected', 'true')
  })
  it('menú del supertécnico y diálogo "Borrar reparación" con motivo; referenciada avisa y no abre', async () => {
    let borrado: unknown = null
    server.use(
      http.get('*/api/reparaciones/R20260915_133/referenciadora', () => HttpResponse.json({ value: null })),
      http.get('*/api/reparaciones/R20260916_6/referenciadora', () => HttpResponse.json({ value: 'R20260910_1' })),
      http.delete('*/api/reparaciones/R20260915_133', async ({ request }) => { borrado = await request.json(); return new HttpResponse(null, { status: 204 }) }),
    )
    abrir()
    await screen.findByText('R20260915_133')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('R20260915_133') })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['Editar', 'Borrar', '📋  Copiar celda', 'Cancelar incidencia'])
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Borrar' }))
    const dlg = await screen.findByRole('dialog', { name: 'Borrar reparación' })
    expect(within(dlg).getByText('Se borrará R20260915_133. Los componentes usados volverán a stock y, si resolvía una incidencia, esta quedará activa de nuevo. Escribe el motivo.')).toBeInTheDocument()
    await userEvent.type(within(dlg).getByPlaceholderText('Escribe el motivo del borrado...'), 'duplicada')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Borrar reparación' }))
    await waitFor(() => expect(borrado).toEqual({ motivo: 'duplicada' }))
    // getAllByText: R20260916_6 también es el texto del enlace "Id Rep. Anterior" de R20260910_1; el orden del
    // DOM (esta fila va antes) garantiza que el índice 0 es la celda Id de esta fila, no ese enlace.
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getAllByText('R20260916_6')[0] })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Borrar' }))
    expect(await screen.findByRole('dialog', { name: 'No se puede borrar' })).toHaveTextContent('Esta reparación está siendo referenciada. La reparación R20260910_1 apunta a esta. Bórrala primero.')
  })
  it('"Añadir incidencia": técnicos activos, reparador preseleccionado, botón habilitado con comentario y POST', async () => {
    let body: unknown = null
    server.use(http.post('*/api/reparaciones/R20260916_6/incidencia', async ({ request }) => { body = await request.json(); return new HttpResponse(null, { status: 201 }) }))
    abrir()
    await screen.findByText('R20260915_133')
    // getAllByText: ver nota equivalente más arriba (R20260916_6 coincide también con el enlace de R20260910_1).
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getAllByText('R20260916_6')[0] })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Añadir incidencia' }))
    const dlg = await screen.findByRole('dialog', { name: 'Añadir incidencia' })
    const boton = within(dlg).getByRole('button', { name: 'Añadir incidencia y asignar' })
    expect(boton).toBeDisabled()
    expect(within(dlg).getByLabelText('Técnico asignado')).toHaveValue('5')
    expect(within(dlg).queryByRole('option', { name: 'tecnico_n' })).not.toBeInTheDocument()
    await userEvent.type(within(dlg).getByLabelText('Comentario de incidencia'), 'sigue sin cargar')
    expect(boton).toBeEnabled()
    await userEvent.click(boton)
    await waitFor(() => expect(body).toEqual({ comentario: 'sigue sin cargar', imei: '358800000000131', idTec: 5 }))
  })
  it('el admin y el técnico solo tienen "Copiar celda"', async () => {
    abrir(SESION_ADMIN)
    await screen.findByText('R20260915_133')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getAllByText('R20260916_6')[0] })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['📋  Copiar celda'])
  })
  it('CSV del supertécnico con columna Técnico y nombre historial_reparaciones', async () => {
    const descargar = vi.spyOn(csv, 'descargarCsv').mockImplementation(() => {})
    // "Descargar CSV" vive en el menú de usuario de AppLayout (TopBar), así que aquí hace falta el layout real,
    // no solo la página: renderConProviders monta HistorialPage como ruta hija de <AppLayout/> (opción `layout`).
    renderConProviders(<HistorialPage tipo="REPARACION" />, { sesion: SESION_SUPER, ruta: '/reparaciones/historial', layout: <AppLayout /> })
    await screen.findByText('R20260915_133')
    await userEvent.click(screen.getByRole('button', { name: /Hola,/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Descargar CSV' }))
    const [base, cabeceras, filasCsv] = descargar.mock.calls[0]
    expect(base).toBe('historial_reparaciones')
    expect(cabeceras).toEqual(['ID Reparación', 'IMEI', 'Técnico', 'Fecha asig.', 'Fecha fin', 'Componente', 'Reutilizado', 'Observaciones', 'Incidencia', 'Resuelto', 'ID Rep. anterior'])
    expect(filasCsv[1]).toEqual(['R20260915_133', '="351900000000041"', 'tecnico_b', '15/09/2026 17:00', '15/09/2026 17:00', 'bati16', 'Sí', '', 'no enciende', 'No', ''])
    descargar.mockRestore()
  })
})
