import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
// eslint-disable-next-line no-restricted-imports -- solo "Descargar CSV" necesita el AppLayout real (TopBar/UserMenu); ver su uso más abajo.
import { AppLayout } from '@/app/shell/AppLayout'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER, SESION_TEC } from '@/test/render'
import * as csv from '@/shared/lib/csv'
import { glass, normal, resumen } from '../test/fabrica'
import { PendientesPage } from './PendientesPage'

const filas = [
  resumen({ idRep: 'A20260915_29', imei: '355400000000111', modelo: '14plus', cliente: 'CLIENTE F', nombreTecnicoAsigna: 'Técnico E', urgente: true, fechaAsig: '2026-09-15T08:53:00' }),
  { ...normal(true, null), idRep: 'A20260916_12', imei: '355100000000101', modelo: '14', esChasis: true, cliente: 'AMAZON', fechaAsig: '2026-09-16T07:02:00' },
  resumen({ idRep: 'A20260916_1', imei: '353400000000081', modelo: '15pro', cliente: null, esSolicitud: 2, tiposSolicitud: 'Batería, Pantalla', fechaAsig: '2026-09-16T06:50:00' }),
  resumen({ idRep: 'A20260916_2', imei: '350200000000011', esIncidencia: true, porCerrar: true, cliente: null }),
]

beforeEach(() => {
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
    // Los tipos de la solicitud bajo el badge se cortan con "…" dentro del ancho de la celda (Label del JavaFX).
    expect(screen.getByText('2 piezas')).toHaveClass('max-w-full', 'truncate')
    expect(screen.getByText('2 piezas').parentElement).toHaveClass('max-w-full')
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
  it('menú contextual: copiar, por cerrar y "Entregar a" según la fila; PATCH por-cerrar y entrega-glass', async () => {
    let bodyPorCerrar: unknown = null
    let bodyEntrega: unknown = null
    server.use(
      http.patch('*/api/reparaciones/asignaciones/A20260916_2/por-cerrar', async ({ request }) => { bodyPorCerrar = await request.json(); return new HttpResponse(null, { status: 204 }) }),
      http.patch('*/api/reparaciones/asignaciones/A20260916_12/entrega-glass', async ({ request }) => { bodyEntrega = await request.json(); return new HttpResponse(null, { status: 204 }) }),
    )
    abrir()
    await screen.findByText('A20260915_29')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('A20260916_12') })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['📋  Copiar celda', 'Marcar por cerrar', 'Entregar a Técnico H'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Entregar a Técnico H' }))
    await waitFor(() => expect(bodyEntrega).toEqual({ entregado: true }))
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('A20260916_2') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Quitar por cerrar' }))
    await waitFor(() => expect(bodyPorCerrar).toEqual({ porCerrar: false }))
  })
  it('pestaña Glass: "Marcar que llegó" y "Deshacer llegada" disparan su PATCH/DELETE; botón oculto y placeholder', async () => {
    const bloqueada = { ...glass(null), idRep: 'AG20260916_1', imei: '351111111111111', normalAbierta: true, normalTecnicoNombre: 'Técnico J' }
    // entregadoPor: 4 = idTec de SESION_TEC (con la que se monta esta página): opcionDeshacerLlegada solo ofrece
    // "Deshacer llegada" a quien firmó la entrega (ver entregaGlass.ts).
    const entregada = { ...glass('2026-09-16T08:00:00'), idRep: 'AG20260916_2', imei: '352222222222222', entregadoPor: 4, normalAbierta: true }
    let llegadaLlamada = false
    let deshacerLlamada = false
    server.use(
      http.get('*/api/glass/asignaciones', () => HttpResponse.json([bloqueada, entregada])),
      http.patch('*/api/reparaciones/asignaciones/AG20260916_1/llegada', () => { llegadaLlamada = true; return new HttpResponse(null, { status: 204 }) }),
      http.delete('*/api/reparaciones/asignaciones/AG20260916_2/llegada', () => { deshacerLlamada = true; return new HttpResponse(null, { status: 204 }) }),
    )
    const { unmount } = renderConProviders(<PendientesPage tipo="GLASS" />, { sesion: SESION_TEC, ruta: '/reparaciones/pendientes/glass' })
    await screen.findByText('AG20260916_1')
    expect(screen.getByText('Rep: Técnico J')).toHaveClass('bg-tipo-reparacion-bg')
    // "Añadir glass" se oculta con normalAbierta y sin entregadoAt (bloqueada); "entregada" también tiene normalAbierta,
    // pero ya tiene entregadoAt registrado, así que el botón vuelve: la glass llegó.
    expect(within(screen.getByRole('row', { name: /AG20260916_1/ })).queryByRole('button', { name: 'Añadir glass' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /AG20260916_2/ })).getByRole('button', { name: 'Añadir glass' })).toBeInTheDocument()
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('AG20260916_1') })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['📋  Copiar celda', 'Marcar que llegó'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Marcar que llegó' }))
    await waitFor(() => expect(llegadaLlamada).toBe(true))
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('AG20260916_2') })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['📋  Copiar celda', 'Deshacer llegada'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Deshacer llegada' }))
    await waitFor(() => expect(deshacerLlamada).toBe(true))
    unmount()
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
    // "Descargar CSV" vive en el menú de usuario de AppLayout (TopBar), así que aquí hace falta el layout real,
    // no solo la página: renderConProviders monta PendientesPage como ruta hija de <AppLayout/> (opción `layout`).
    renderConProviders(<PendientesPage tipo="REPARACION" />, { sesion: SESION_TEC, ruta: '/reparaciones/pendientes', layout: <AppLayout /> })
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
  it('"Descargar CSV" del supertécnico añade la columna Técnico', async () => {
    const descargar = vi.spyOn(csv, 'descargarCsv').mockImplementation(() => {})
    renderConProviders(<PendientesPage tipo="REPARACION" />, { sesion: SESION_SUPER, ruta: '/reparaciones/pendientes', layout: <AppLayout /> })
    await screen.findByText('A20260915_29')
    await userEvent.click(screen.getByRole('button', { name: /Hola,/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Descargar CSV' }))
    expect(descargar).toHaveBeenCalledTimes(1)
    const [, cabeceras, filasCsv] = descargar.mock.calls[0]
    expect(cabeceras).toEqual(['ID Reparación', 'IMEI', 'Técnico', 'Fecha asig.', 'Fecha fin', 'Componente', 'Observaciones', 'Incidencia', 'Resuelto', 'ID Rep. anterior'])
    expect(filasCsv[0]).toEqual(['A20260915_29', '="355400000000111"', 'Técnico A', '15/09/2026 10:53', '', '', '', 'No', 'No', ''])
    descargar.mockRestore()
  })
})
