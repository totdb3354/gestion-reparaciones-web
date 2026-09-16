import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Route } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
// eslint-disable-next-line no-restricted-imports -- solo "Descargar CSV" necesita el AppLayout real (TopBar/UserMenu); ver su uso más abajo.
import { AppLayout } from '@/app/shell/AppLayout'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER, SESION_TEC } from '@/test/render'
import * as csv from '@/shared/lib/csv'
import { reiniciarEstadoTaller } from '../estado'
import { glass, normal, resumen } from '../test/fabrica'
import { PendientesPage } from './PendientesPage'

const filas = [
  resumen({ idRep: 'A20260915_29', imei: '355400000000111', modelo: '14plus', cliente: 'CLIENTE F', nombreTecnicoAsigna: 'Técnico E', urgente: true, fechaAsig: '2026-09-15T08:53:00' }),
  { ...normal(true, null), idRep: 'A20260916_12', imei: '355100000000101', modelo: '14', esChasis: true, cliente: 'AMAZON', fechaAsig: '2026-09-16T07:02:00' },
  resumen({ idRep: 'A20260916_1', imei: '353400000000081', modelo: '15pro', cliente: null, esSolicitud: 2, tiposSolicitud: 'Batería, Pantalla', fechaAsig: '2026-09-16T06:50:00' }),
  resumen({ idRep: 'A20260916_2', imei: '350200000000011', esIncidencia: true, porCerrar: true, cliente: null }),
]

beforeEach(() => {
  reiniciarEstadoTaller()
  server.use(
    http.get('*/api/reparaciones/asignaciones', () => HttpResponse.json(filas)),
    http.get('*/api/glass/asignaciones', () => HttpResponse.json([])),
    http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([])),
    http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json({ reparaciones: 4, glass: 0, pulidos: 120 })),
  )
})

const abrir = (sesion = SESION_TEC, ruta = '/reparaciones/pendientes') => renderConProviders(<PendientesPage tipo="REPARACION" />, { sesion, ruta })

describe('PendientesPage (ficha docs/paridad/pendientes.md)', () => {
  it('título, contador, toggles con sufijo y columnas del TableView', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Mis asignaciones pendientes' })).toBeInTheDocument()
    // findByText en vez de getByText: el título es estático y aparece en el primer render (síncrono), antes de
    // que resuelva el GET mockeado del que depende el contador — con getByText la aserción es una carrera que
    // pierde siempre (comprobado: waitFor resuelve el heading de forma síncrona, dentro del mismo tick).
    expect(await screen.findByText('4 pendientes')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Reparaciones (4)' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Glass (0)' })).toHaveAttribute('href', '/reparaciones/pendientes/glass')
    expect(screen.getByRole('link', { name: 'Pulidos (99+)' })).toBeInTheDocument()
    const cabeceras = screen.getAllByRole('columnheader').map((c) => c.textContent)
    expect(cabeceras).toEqual(['Id Asignación', 'Tipo', 'IMEI', 'Modelo', 'Fecha asignación', 'Comentario', 'Cliente', 'Asignado por', 'Estado', ''])
    expect(screen.getByText('iPhone 14 Plus')).toBeInTheDocument()
    expect(screen.getByText('2026/09/15 10:53')).toBeInTheDocument()
  })
  it('orden urgente → con cliente → resto; borde por solicitud e incidencia; badges de estado', async () => {
    abrir()
    await screen.findByText('A20260915_29')
    const ids = screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent)
    expect(ids).toEqual(['A20260915_29', 'A20260916_12', 'A20260916_1', 'A20260916_2'])
    expect(screen.getByRole('row', { name: /A20260916_1 / })).toHaveClass('border-l-fila-solicitud-brd')
    expect(screen.getByRole('row', { name: /A20260916_2 / })).toHaveClass('border-l-fila-incidencia-brd')
    expect(screen.getByText('Urgente')).toHaveClass('bg-urgente-bg')
    expect(screen.getByText('Solicitud')).toBeInTheDocument()
    expect(screen.getByText('2 piezas')).toBeInTheDocument()
    expect(screen.getByText('Por cerrar')).toBeInTheDocument()
    expect(screen.getByText('Incidencia')).toBeInTheDocument()
    expect(screen.getByText('Chasis')).toBeInTheDocument()
    expect(screen.getByText('Glass: Técnico H')).toHaveClass('bg-tipo-glass-bg')
  })
  it('el botón "Añadir reparación" está deshabilitado con el tooltip del formulario', async () => {
    abrir()
    const botones = await screen.findAllByRole('button', { name: 'Añadir reparación' })
    expect(botones).toHaveLength(4)
    expect(botones[0]).toBeDisabled()
    expect(botones[0].parentElement).toHaveAttribute('title', 'Disponible con el formulario de reparación (siguiente entrega)')
  })
  it('filtro Tipo: casillas, etiqueta "Todas"/"N filtros" y filtrado', async () => {
    abrir()
    await screen.findByText('A20260915_29')
    await userEvent.click(screen.getByRole('button', { name: 'Tipo' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Solicitudes pieza' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Solicitudes pieza' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getByText('1 pendiente')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Solicitudes pieza' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Incidencias' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Asignaciones' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Todas' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByRole('button', { name: 'Tipo' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(5)
  })
  it('filtro IMEI: solo los de 15 dígitos filtran', async () => {
    abrir()
    await screen.findByText('A20260915_29')
    const campo = screen.getByPlaceholderText('Filtrar por IMEI')
    await userEvent.type(campo, '3554')
    expect(screen.getAllByRole('row')).toHaveLength(5)
    await userEvent.type(campo, '00000000111')
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(campo).toHaveValue('355400000000111, ')
  })
  it('menú contextual: copiar, por cerrar y "Entregar a" según la fila; PATCH por-cerrar', async () => {
    let body: unknown = null
    server.use(http.patch('*/api/reparaciones/asignaciones/A20260916_2/por-cerrar', async ({ request }) => { body = await request.json(); return new HttpResponse(null, { status: 204 }) }))
    abrir()
    await screen.findByText('A20260915_29')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('A20260916_12') })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['📋  Copiar celda', 'Marcar por cerrar', 'Entregar a Técnico H'])
    await userEvent.keyboard('{Escape}')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('A20260916_2') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Quitar por cerrar' }))
    await waitFor(() => expect(body).toEqual({ porCerrar: false }))
  })
  it('pestaña Glass: "Marcar que llegó" en la fila bloqueada, botón oculto y placeholder', async () => {
    const bloqueada = { ...glass(null), idRep: 'AG20260916_1', imei: '351111111111111', normalAbierta: true, normalTecnicoNombre: 'Técnico J' }
    server.use(http.get('*/api/glass/asignaciones', () => HttpResponse.json([bloqueada])), http.patch('*/api/reparaciones/asignaciones/AG20260916_1/llegada', () => new HttpResponse(null, { status: 204 })))
    renderConProviders(<PendientesPage tipo="GLASS" />, { sesion: SESION_TEC, ruta: '/reparaciones/pendientes/glass' })
    await screen.findByText('AG20260916_1')
    expect(screen.getByText('Rep: Técnico J')).toHaveClass('bg-tipo-reparacion-bg')
    expect(screen.queryByRole('button', { name: 'Añadir glass' })).not.toBeInTheDocument()
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('AG20260916_1') })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['📋  Copiar celda', 'Marcar que llegó'])
    await userEvent.keyboard('{Escape}')
    server.use(http.get('*/api/glass/asignaciones', () => HttpResponse.json([])))
    renderConProviders(<PendientesPage tipo="GLASS" />, { sesion: SESION_TEC, ruta: '/reparaciones/pendientes/glass' })
    expect(await screen.findByText('No tienes asignaciones pendientes')).toBeInTheDocument()
  })
  it('la papelera solo la ve el supertécnico y borra la asignación o la incidencia activa', async () => {
    let borrada: string | null = null
    server.use(
      http.get('*/api/reparaciones/asignaciones', ({ request }) => { expect(new URL(request.url).searchParams.get('tecnico')).toBe('3'); return HttpResponse.json(filas) }),
      http.delete('*/api/reparaciones/asignaciones/A20260915_29', () => { borrada = 'asig'; return new HttpResponse(null, { status: 204 }) }),
      http.delete('*/api/reparaciones/imei/350200000000011/incidencia-activa', ({ request }) => { borrada = `inc:${new URL(request.url).searchParams.get('tipo')}`; return new HttpResponse(null, { status: 204 }) }),
    )
    abrir(SESION_SUPER)
    await screen.findByText('A20260915_29')
    expect(screen.getAllByRole('columnheader')).toHaveLength(11)
    await userEvent.click(screen.getAllByRole('button', { name: 'Borrar asignación' })[0])
    const dlg = screen.getByRole('dialog', { name: 'Borrar asignación A20260915_29' })
    expect(within(dlg).getByText('El técnico dejará de verla en su lista de pendientes.')).toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Borrar asignación' }))
    await waitFor(() => expect(borrada).toBe('asig'))
    await userEvent.click(screen.getAllByRole('button', { name: 'Borrar asignación' })[3])
    expect(screen.getByText('El técnico dejará de verla en su lista de pendientes y la incidencia se marcará como no activa en la tabla principal.')).toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Borrar asignación' }))
    await waitFor(() => expect(borrada).toBe('inc:R'))
  })
  it('un técnico no ve la papelera', async () => {
    abrir()
    await screen.findByText('A20260915_29')
    expect(screen.queryByRole('button', { name: 'Borrar asignación' })).not.toBeInTheDocument()
  })
  it('"Descargar CSV" exporta las filas visibles con las cabeceras del técnico', async () => {
    const descargar = vi.spyOn(csv, 'descargarCsv').mockImplementation(() => {})
    // Adaptación (ver nota del brief): renderConProviders no deja anidar la página bajo un AppLayout real a
    // través de `ui`/`ruta` — esa combinación ya ocupa la ruta con un <Route> sin hijos, así que un <Route>
    // idéntico añadido por `rutas` para el mismo `path` pierde el desempate por posición (declarado después) y
    // nunca llegaría a montarse. Se resuelve dándole a `rutas` una ruta índice bajo ese mismo `path`: en el
    // cálculo de puntuación de react-router una ruta índice puntúa por encima de una ruta normal con el mismo
    // path, así que esta rama gana el matching y es la que se monta (comprobado: sin esto, "Hola," no aparece).
    renderConProviders(<PendientesPage tipo="REPARACION" />, {
      sesion: SESION_TEC,
      ruta: '/reparaciones/pendientes',
      rutas: (
        <Route path="/reparaciones/pendientes" element={<AppLayout />}>
          <Route index element={<PendientesPage tipo="REPARACION" />} />
        </Route>
      ),
    })
    await screen.findByText('A20260915_29')
    await userEvent.click(screen.getByRole('button', { name: /Hola,/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Descargar CSV' }))
    expect(descargar).toHaveBeenCalledTimes(1)
    const [base, cabeceras, filasCsv] = descargar.mock.calls[0]
    expect(base).toBe('mis_pendientes')
    expect(cabeceras).toEqual(['ID Reparación', 'IMEI', 'Fecha asig.', 'Fecha fin', 'Componente', 'Observaciones', 'Incidencia', 'Resuelto', 'ID Rep. anterior'])
    expect(filasCsv[0]).toEqual(['A20260915_29', '="355400000000111"', '15/09/2026 10:53', '', '', '', 'No', 'No', ''])
    descargar.mockRestore()
  })
})
