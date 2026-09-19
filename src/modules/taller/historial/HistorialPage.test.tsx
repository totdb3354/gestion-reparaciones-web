import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Route } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
// eslint-disable-next-line no-restricted-imports -- "Descargar CSV" y "Cerrar Sesión" necesitan el AppLayout real (TopBar/UserMenu); ver su uso más abajo.
import { AppLayout } from '@/app/shell/AppLayout'
// eslint-disable-next-line no-restricted-imports -- el recorrido cerrar sesión → entrar con otro usuario necesita la pantalla de login real.
import { LoginPage } from '@/app/login/LoginPage'
import { server } from '@/test/server'
import { renderConProviders, renderConRouter, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import * as csv from '@/shared/lib/csv'
import { CREMA_EN_FILA_SELECCIONADA } from '@/shared/ui/DataTable'
import { CLAVE_TECNICOS_ACTIVOS } from '../api'
import { FormularioEditarRuta } from '../formulario/rutas'
import { handlersFormulario } from '../formulario/test/handlers'
import { borradorEnReposo } from '../formulario/useBorrador'
import { handlersNotificaciones } from '../notificaciones/test/handlers'
import { detalleEdicion, glass, resumen, tecnico } from '../test/fabrica'
import { HistorialPage } from './HistorialPage'

afterEach(async () => {
  cleanup()
  await borradorEnReposo()
})

const filas = [
  resumen({ idRep: 'R20260916_6', imei: '358800000000131', modelo: '14', nombreTecnico: 'tecnico_i', idTec: 5, nombreTecnicoAsigna: 'Técnico M', fechaAsig: '2026-09-16T07:00:00', fechaFin: '2026-09-16T07:00:00', tipoComponente: 'otroi14', observaciones: 'cerrar' }),
  resumen({ idRep: 'R20260915_133', imei: '351900000000041', modelo: '16', nombreTecnico: 'tecnico_b', idTec: 6, fechaAsig: '2026-09-15T15:00:00', fechaFin: '2026-09-15T15:00:00', tipoComponente: 'bati16', esReutilizado: true, esIncidencia: true, incidencia: 'no enciende' }),
  resumen({ idRep: 'R20260910_1', imei: '351900000000041', modelo: '16', nombreTecnico: 'tecnico_i', idTec: 5, fechaAsig: '2026-09-10T10:00:00', fechaFin: '2026-09-11T10:00:00', tipoComponente: 'lcdi16negra', esIncidencia: true, esResuelto: true, incidencia: 'pantalla', idRepAnterior: 'R20260916_6' }),
]
const tecnicos = [tecnico({ idTec: 5, nombre: 'tecnico_i' }), tecnico({ idTec: 6, nombre: 'tecnico_b' }), tecnico({ idTec: 7, nombre: 'tecnico_n', activo: false })]

// navigator.clipboard no existe en jsdom por defecto: mismo patrón que MenuCopiarCelda.test.tsx / copiar.test.ts
// (Object.defineProperty configurable, restaurado tras cada test a partir del descriptor original).
const descriptorClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => {
  if (descriptorClipboard) Object.defineProperty(navigator, 'clipboard', descriptorClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

beforeEach(() => {
  // <AppLayout/> con supertécnico monta la campana de la barra, que pide sus contadores y los componentes gestionados.
  server.use(...handlersNotificaciones())
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
    const { container } = abrir()
    expect(await screen.findByRole('heading', { name: 'Historial de reparaciones' })).toBeInTheDocument()
    expect(await screen.findByText('3 reparaciones')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Reparaciones' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Pulidos' })).toHaveAttribute('href', '/reparaciones/historial/pulidos')
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Id Reparación', 'IMEI teléfono', 'Modelo', 'Reparador', 'Asignado por', 'Fechas', 'Componente', 'Observaciones', 'Estado', 'Incidencia', 'Id Rep. Anterior'])
    expect(screen.getByRole('table')).toHaveClass('w-full')
    // Pesos de aplicarAnchosDetalle (`Math.max(w, w * u)`; docs/paridad/historial.md): 110·130·100·100·100·110·150·
    // 200·120·200·150 (Estado 120: su minWidth 110 del FXML nunca llega a pintarse). En ajuste "estirar" DataTable los
    // reparte en % sobre la suma (1470), calco de DataTable.test.tsx "en ajuste estirar reparte porcentajes...".
    const anchos = Array.from(container.querySelectorAll('col')).map((c) => c.style.width)
    expect(anchos).toEqual([
      expect.stringMatching(/^7\.4829/), // Id Reparación 110
      expect.stringMatching(/^8\.8435/), // IMEI teléfono 130
      expect.stringMatching(/^6\.8027/), // Modelo 100
      expect.stringMatching(/^6\.8027/), // Reparador 100
      expect.stringMatching(/^6\.8027/), // Asignado por 100
      expect.stringMatching(/^7\.4829/), // Fechas 110
      expect.stringMatching(/^10\.2040/), // Componente 150
      expect.stringMatching(/^13\.6054/), // Observaciones 200
      expect.stringMatching(/^8\.1632/), // Estado 120
      expect.stringMatching(/^13\.6054/), // Incidencia 200
      expect.stringMatching(/^10\.2040/), // Id Rep. Anterior 150
    ])
    // En la fila seleccionada el JavaFX repinta en blanco "Reutilizado" (y las fechas, CeldaFechas.test.tsx); los textos
    // con color propio sin oyente de selección lo conservan: "Sin incidencia", el texto de la incidencia, las píldoras y
    // el enlace "Id Rep. Anterior".
    expect(screen.getByText('Reutilizado')).toHaveClass('italic', CREMA_EN_FILA_SELECCIONADA)
    expect(screen.getByText('2026/09/16 09:00')).toBeInTheDocument()
    expect(screen.getAllByText('Sin incidencia')).toHaveLength(1)
    expect(screen.getByText('Sin incidencia')).not.toHaveClass(CREMA_EN_FILA_SELECCIONADA)
    expect(screen.getByText('Resuelta')).toBeInTheDocument()
    expect(screen.getByText('Resuelta')).not.toHaveClass(CREMA_EN_FILA_SELECCIONADA)
    expect(screen.getByRole('button', { name: 'R20260916_6' })).not.toHaveClass(CREMA_EN_FILA_SELECCIONADA)
    // Texto de la incidencia: #000000 abierta, #A9A9A9 resuelta (configurarColIncidencia), con tokens.
    expect(screen.getByRole('button', { name: 'no enciende' })).toHaveClass('text-texto-incidencia')
    expect(screen.getByRole('button', { name: 'no enciende' })).not.toHaveClass(CREMA_EN_FILA_SELECCIONADA)
    expect(screen.getByRole('button', { name: 'pantalla' })).toHaveClass('text-gris-borde')
    expect(screen.getByRole('row', { name: /R20260915_133/ })).toHaveClass('border-l-fila-incidencia-brd')
    expect(screen.getByRole('row', { name: /R20260910_1/ })).toHaveClass('border-l-fila-reparado-brd')
    // tablaReparaciones.setFixedCellSize(44)
    expect(screen.getByRole('row', { name: /R20260915_133/ })).toHaveStyle({ height: '44px' })
  })
  it.each([
    { rol: 'SUPERTECNICO', sesion: SESION_SUPER, inicio: '2026/09/10 12:00', fin: '→ 2026/09/11 12:00', copiado: '2026/09/11 12:00' },
    { rol: 'ADMIN', sesion: SESION_ADMIN, inicio: '2026/09/10 12:00', fin: '→ 2026/09/11 12:00', copiado: '2026/09/11 12:00' },
    { rol: 'TECNICO', sesion: SESION_TEC, inicio: '2026/09/10', fin: '→ 2026/09/11', copiado: '2026/09/11' },
  ])('Fechas del $rol en la celda y en "Copiar celda" (la de fin) con el FORMATO_FECHA de su controller: con hora en ReparacionController{SuperTecnico,Admin}, sin hora en ReparacionControllerTecnico', async ({ sesion, inicio, fin, copiado }) => {
    const escribir = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true })
    abrir(sesion)
    const fila = await screen.findByRole('row', { name: /^R20260910_1 / })
    expect(within(fila).getByText(inicio)).toBeInTheDocument()
    expect(within(fila).getByText(fin)).toBeInTheDocument()
    await userEvent.pointer({ keys: '[MouseRight]', target: within(fila).getByText(inicio) })
    await userEvent.click(await screen.findByRole('menuitem', { name: /Copiar celda/ }))
    expect(escribir).toHaveBeenCalledWith(copiado)
  })
  it('cerrar sesión y entrar con un técnico en la misma pestaña no hereda el filtro de técnico del supertécnico (el JavaFX descarta las vistas al volver al login)', async () => {
    const trabajo = (idRep: string, imei: string, idTec: number, nombreTecnico: string) =>
      resumen({ idRep, imei, idTec, nombreTecnico, nombreTecnicoAsigna: 'Técnico C', cliente: 'CLIENTE A', fechaAsig: '2026-01-01T09:00:00', fechaFin: '2026-01-01T10:00:00' })
    server.use(
      http.get('*/api/reparaciones/historial', () => HttpResponse.json([
        trabajo('R20260101_3', '350000000000011', 1, 'Técnico A'),
        trabajo('R20260101_2', '350000000000029', 2, 'Técnico B'),
        trabajo('R20260101_1', '350000000000037', 2, 'Técnico B'),
      ])),
      http.get('*/api/tecnicos', () => HttpResponse.json([tecnico({ idTec: 1, nombre: 'Técnico A' }), tecnico({ idTec: 2, nombre: 'Técnico B' })])),
      http.post('*/api/auth/login', () => HttpResponse.json({ idUsu: 90, nombreUsuario: 'tecnico1', rol: 'TECNICO', idTec: 1, token: 'jwt-tecnico1' })),
    )
    renderConProviders(<HistorialPage tipo="REPARACION" />, {
      sesion: SESION_SUPER,
      ruta: '/reparaciones/historial',
      layout: <AppLayout />,
      rutas: (
        <>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<HistorialPage tipo="REPARACION" />} />
        </>
      ),
    })
    expect(await screen.findByText('3 reparaciones')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Técnico' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Técnico B' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByText('2 reparaciones')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Hola,/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Cerrar Sesión' }))
    await userEvent.type(await screen.findByPlaceholderText('Usuario'), 'tecnico1')
    await userEvent.type(screen.getByPlaceholderText('Contraseña'), 'clave{enter}')
    // El técnico no ve el filtro de técnico: si el del supertécnico siguiera puesto, la tabla saldría filtrada sin causa visible.
    expect(await screen.findByRole('heading', { name: 'Mis reparaciones' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Técnico' })).not.toBeInTheDocument()
    expect(await screen.findByText('3 reparaciones')).toBeInTheDocument()
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
  it('el enlace Id Rep. Anterior desplaza la tabla hasta esa fila y la enfoca en cada clic, también si ya estaba seleccionada (select(i); scrollTo(i); requestFocus())', async () => {
    server.use(http.get('*/api/reparaciones/historial', () => HttpResponse.json([
      resumen({ idRep: 'R20260912_3', imei: '351900000000041', modelo: '16', nombreTecnico: 'tecnico_i', idTec: 5, fechaAsig: '2026-09-12T10:00:00', fechaFin: '2026-09-12T11:00:00', idRepAnterior: 'R20260910_1' }),
      resumen({ idRep: 'R20260911_2', imei: '358800000000131', modelo: '14', nombreTecnico: 'tecnico_i', idTec: 5, fechaAsig: '2026-09-11T10:00:00', fechaFin: '2026-09-11T11:00:00' }),
      resumen({ idRep: 'R20260910_1', imei: '351900000000041', modelo: '16', nombreTecnico: 'tecnico_b', idTec: 6, fechaAsig: '2026-09-10T10:00:00', fechaFin: '2026-09-10T11:00:00' }),
    ])))
    // jsdom no maqueta: cabecera de 40 px y filas de 44 px colocadas por su data-index debajo de ella (como en DataTable.test.tsx).
    const esFila = (el: HTMLElement) => el.tagName === 'TR' && el.dataset.index !== undefined
    const offsetTop = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      return esFila(this) ? 40 + Number(this.dataset.index) * 44 : 0
    })
    const offsetHeight = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.tagName === 'THEAD' ? 40 : esFila(this) ? 44 : 0
    })
    onTestFinished(() => { offsetTop.mockRestore(); offsetHeight.mockRestore() })
    abrir()
    const enlace = await screen.findByRole('button', { name: 'R20260910_1' })
    const contenedor = screen.getByRole('table').parentElement!
    await userEvent.click(enlace)
    expect(screen.getByRole('row', { name: /^R20260910_1 / })).toHaveAttribute('aria-selected', 'true')
    expect(contenedor.scrollTop).toBe(2 * 44) // la fila 2 justo debajo de la cabecera
    expect(contenedor).toHaveFocus()
    // El usuario vuelve arriba con la rueda y pasa al filtro de IMEI; R20260910_1 sigue seleccionada.
    contenedor.scrollTop = 0
    screen.getByPlaceholderText('Filtrar por IMEI').focus()
    await userEvent.click(enlace)
    expect(screen.getByRole('row', { name: /^R20260910_1 / })).toHaveAttribute('aria-selected', 'true')
    expect(contenedor.scrollTop).toBe(2 * 44)
    expect(contenedor).toHaveFocus()
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
  it('"Editar" navega a /reparaciones/historial/editar/<idRep> (y /glass/ en la pestaña Glass), sin confirmación previa y sin tooltip', async () => {
    const hija = [{ path: 'editar/:idRep', element: <p>FORMULARIO EDITAR</p> }]
    const rep = renderConRouter([{ path: '/reparaciones/historial', element: <HistorialPage tipo="REPARACION" />, children: hija }], { sesion: SESION_SUPER, ruta: '/reparaciones/historial' })
    await userEvent.pointer({ keys: '[MouseRight]', target: await screen.findByText('R20260915_133') })
    const editar = await screen.findByRole('menuitem', { name: 'Editar' })
    expect(editar).not.toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByTitle('Disponible con el formulario de reparación (siguiente entrega)')).not.toBeInTheDocument()
    await userEvent.click(editar)
    expect(rep.router.state.location.pathname).toBe('/reparaciones/historial/editar/R20260915_133')
    expect(await screen.findByText('FORMULARIO EDITAR')).toBeInTheDocument()
    expect(screen.getByText('R20260915_133')).toBeInTheDocument()
    rep.unmount()

    server.use(http.get('*/api/glass/historial', () => HttpResponse.json([resumen({ idRep: 'G20260916_3', tipoComponente: 'gi13', fechaFin: '2026-09-16T09:00:00' })])))
    const gl = renderConRouter([{ path: '/reparaciones/historial/glass', element: <HistorialPage tipo="GLASS" />, children: hija }], { sesion: SESION_SUPER, ruta: '/reparaciones/historial/glass' })
    await userEvent.pointer({ keys: '[MouseRight]', target: await screen.findByText('G20260916_3') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }))
    expect(gl.router.state.location.pathname).toBe('/reparaciones/historial/glass/editar/G20260916_3')
  })

  it('"Editar" abre el formulario sobre la tabla y al cerrarlo se recarga el historial', async () => {
    let cargas = 0
    server.use(...handlersFormulario({ detalle: detalleEdicion({ imei: '351900000000041' }) }))
    server.use(http.get('*/api/reparaciones/historial', () => { cargas++; return HttpResponse.json(filas) }))
    const { router } = renderConRouter(
      [{ path: '/reparaciones/historial', element: <HistorialPage tipo="REPARACION" />, children: [{ path: 'editar/:idRep', element: <FormularioEditarRuta origen="historial" /> }] }],
      { sesion: SESION_SUPER, ruta: '/reparaciones/historial' },
    )
    await userEvent.pointer({ keys: '[MouseRight]', target: await screen.findByText('R20260915_133') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }))
    expect(await screen.findByRole('dialog', { name: 'Editar reparación — R20260915_133' })).toBeInTheDocument()
    // La tabla sigue montada debajo del diálogo.
    expect(screen.getAllByText('R20260916_6').length).toBeGreaterThan(0)
    const antes = cargas
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/reparaciones/historial'))
    await waitFor(() => expect(cargas).toBeGreaterThan(antes))
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
  it('"Añadir incidencia" en un trabajo de un técnico inactivo: sin preselección, botón deshabilitado hasta elegir un activo y POST con el elegido', async () => {
    // Calco de `tecnicos.stream().filter(t -> t.getIdTec() == rep.getIdTec()).findFirst().ifPresent(cbTecnico::setValue)`
    // sobre getAllActivos(): tecnico_n (7) está inactivo, así que no se preselecciona nadie.
    let body: unknown = null
    const deTecnicoN = resumen({ idRep: 'R20260914_2', imei: '356789012345678', modelo: '13', nombreTecnico: 'tecnico_n', idTec: 7, fechaAsig: '2026-09-14T09:00:00', fechaFin: '2026-09-14T10:00:00', tipoComponente: 'bati13' })
    server.use(
      http.get('*/api/reparaciones/historial', () => HttpResponse.json([deTecnicoN])),
      http.post('*/api/reparaciones/R20260914_2/incidencia', async ({ request }) => { body = await request.json(); return new HttpResponse(null, { status: 201 }) }),
    )
    abrir()
    await userEvent.pointer({ keys: '[MouseRight]', target: await screen.findByText('R20260914_2') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Añadir incidencia' }))
    const dlg = await screen.findByRole('dialog', { name: 'Añadir incidencia' })
    const tecnicoAsignado = within(dlg).getByLabelText('Técnico asignado')
    expect(within(dlg).getAllByRole('option').map((o) => o.textContent)).toEqual(['Selecciona técnico', 'tecnico_i', 'tecnico_b'])
    expect(tecnicoAsignado).toHaveDisplayValue('Selecciona técnico')
    const boton = within(dlg).getByRole('button', { name: 'Añadir incidencia y asignar' })
    await userEvent.type(within(dlg).getByLabelText('Comentario de incidencia'), 'no carga')
    expect(boton).toBeDisabled()
    await userEvent.selectOptions(tecnicoAsignado, 'tecnico_b')
    expect(boton).toBeEnabled()
    await userEvent.click(boton)
    await waitFor(() => expect(body).toEqual({ comentario: 'no carga', imei: '356789012345678', idTec: 6 }))
  })
  it('"Añadir incidencia" con los técnicos activos llegando después de abrir: el reparador activo se preselecciona al llegar', async () => {
    let soltar!: () => void
    const llegan = new Promise<void>((resolver) => { soltar = resolver })
    server.use(http.get('*/api/tecnicos/activos', async () => { await llegan; return HttpResponse.json(tecnicos.filter((t) => t.activo)) }))
    abrir()
    await screen.findByText('R20260915_133')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getAllByText('R20260916_6')[0] })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Añadir incidencia' }))
    const dlg = await screen.findByRole('dialog', { name: 'Añadir incidencia' })
    await userEvent.type(within(dlg).getByLabelText('Comentario de incidencia'), 'sigue sin cargar')
    expect(within(dlg).getByLabelText('Técnico asignado')).toHaveDisplayValue('Selecciona técnico')
    expect(within(dlg).getByRole('button', { name: 'Añadir incidencia y asignar' })).toBeDisabled()
    soltar()
    await waitFor(() => expect(within(dlg).getByLabelText('Técnico asignado')).toHaveValue('5'))
    expect(within(dlg).getByRole('button', { name: 'Añadir incidencia y asignar' })).toBeEnabled()
  })
  it('"Añadir incidencia": si un refresco de los técnicos activos quita al elegido a mano, el desplegable vuelve a "Selecciona técnico" y el botón se deshabilita', async () => {
    const { queryClient } = abrir()
    await screen.findByText('R20260915_133')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getAllByText('R20260916_6')[0] })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Añadir incidencia' }))
    const dlg = await screen.findByRole('dialog', { name: 'Añadir incidencia' })
    const tecnicoAsignado = within(dlg).getByLabelText('Técnico asignado')
    const boton = within(dlg).getByRole('button', { name: 'Añadir incidencia y asignar' })
    await userEvent.type(within(dlg).getByLabelText('Comentario de incidencia'), 'sigue sin cargar')
    await userEvent.selectOptions(tecnicoAsignado, 'tecnico_b')
    expect(boton).toBeEnabled()
    // tecnico_b deja de estar activo y la lista se recarga con el diálogo abierto (en producción, al volver a la pestaña):
    // el id elegido ya no está entre las opciones y no se puede publicar.
    server.use(http.get('*/api/tecnicos/activos', () => HttpResponse.json(tecnicos.filter((t) => t.activo && t.idTec !== 6))))
    void queryClient.invalidateQueries({ queryKey: CLAVE_TECNICOS_ACTIVOS })
    await waitFor(() => expect(within(dlg).queryByRole('option', { name: 'tecnico_b' })).not.toBeInTheDocument())
    expect(tecnicoAsignado).toHaveDisplayValue('Selecciona técnico')
    expect(boton).toBeDisabled()
  })
  it('"Añadir incidencia": si el refresco quita al reparador preseleccionado, tampoco queda un id oculto', async () => {
    const { queryClient } = abrir()
    await screen.findByText('R20260915_133')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getAllByText('R20260916_6')[0] })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Añadir incidencia' }))
    const dlg = await screen.findByRole('dialog', { name: 'Añadir incidencia' })
    const tecnicoAsignado = within(dlg).getByLabelText('Técnico asignado')
    const boton = within(dlg).getByRole('button', { name: 'Añadir incidencia y asignar' })
    await userEvent.type(within(dlg).getByLabelText('Comentario de incidencia'), 'sigue sin cargar')
    expect(tecnicoAsignado).toHaveValue('5')
    expect(boton).toBeEnabled()
    server.use(http.get('*/api/tecnicos/activos', () => HttpResponse.json(tecnicos.filter((t) => t.activo && t.idTec !== 5))))
    void queryClient.invalidateQueries({ queryKey: CLAVE_TECNICOS_ACTIVOS })
    await waitFor(() => expect(within(dlg).queryByRole('option', { name: 'tecnico_i' })).not.toBeInTheDocument())
    expect(tecnicoAsignado).toHaveDisplayValue('Selecciona técnico')
    expect(boton).toBeDisabled()
  })
  it('el admin y el técnico solo tienen "Copiar celda"', async () => {
    abrir(SESION_ADMIN)
    await screen.findByText('R20260915_133')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getAllByText('R20260916_6')[0] })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['📋  Copiar celda'])
  })
  it('"Asignado por" no se copia, pero el resto de columnas sí (docs/paridad/historial.md no la lista entre las columnas copiables; el JavaFX de este historial no tiene ese case en textoDeCelda)', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true })
    abrir()
    await screen.findByText('R20260915_133')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('Técnico M') })
    await userEvent.click(await screen.findByRole('menuitem', { name: /Copiar celda/ }))
    expect(escribir).not.toHaveBeenCalled()
    // Contraparte positiva: sin esta aserción, nada en este archivo demostraría que el resto de columnas SÍ
    // se copian (p. ej. un texto={null} en textoCeldaTrabajo para otra columna pasaría inadvertido).
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('358800000000131') })
    await userEvent.click(await screen.findByRole('menuitem', { name: /Copiar celda/ }))
    expect(escribir).toHaveBeenCalledWith('358800000000131')
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
  it('CSV del técnico con nombre mis_reparaciones y sin columna Técnico', async () => {
    const descargar = vi.spyOn(csv, 'descargarCsv').mockImplementation(() => {})
    renderConProviders(<HistorialPage tipo="REPARACION" />, { sesion: SESION_TEC, ruta: '/reparaciones/historial', layout: <AppLayout /> })
    await screen.findByText('R20260915_133')
    await userEvent.click(screen.getByRole('button', { name: /Hola,/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Descargar CSV' }))
    const [base, cabeceras] = descargar.mock.calls[0]
    expect(base).toBe('mis_reparaciones')
    expect(cabeceras).toEqual(['ID Reparación', 'IMEI', 'Fecha asig.', 'Fecha fin', 'Componente', 'Reutilizado', 'Observaciones', 'Incidencia', 'Resuelto', 'ID Rep. anterior'])
    descargar.mockRestore()
  })
  it('toggle Glass activo, sub-etiqueta "Llegó" del reparador y CSV historial_glass', async () => {
    server.use(http.get('*/api/glass/historial', () => HttpResponse.json([glass('2026-09-16T09:30:00')])))
    const descargar = vi.spyOn(csv, 'descargarCsv').mockImplementation(() => {})
    // Sesión SUPERTECNICO (por defecto): reutiliza el mismo AppLayout+mock de contadores que el resto del
    // fichero, así que es la más barata para probar aquí el nombre historial_glass; el cálculo de mis_glass
    // (TECNICO) es el mismo `global ? … : 'mis_' + tipo` ya cubierto por "mis_reparaciones" arriba.
    renderConProviders(<HistorialPage tipo="GLASS" />, { sesion: SESION_SUPER, ruta: '/reparaciones/historial/glass', layout: <AppLayout /> })
    await screen.findByText('AG20260828_3')
    expect(screen.getByRole('link', { name: 'Glass' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Llegó 16/09 11:30')).toBeInTheDocument()
    // CeldaReparador fija #8A94A6 a "Llegó…" sin oyente de selección: sigue gris en la fila seleccionada.
    expect(screen.getByText('Llegó 16/09 11:30')).not.toHaveClass(CREMA_EN_FILA_SELECCIONADA)
    // El toggle Glass es la misma tabla del controller del rol: fechas con hora para el supertécnico.
    expect(screen.getByText('2026/09/16 09:02')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Hola,/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Descargar CSV' }))
    const [base] = descargar.mock.calls[0]
    expect(base).toBe('historial_glass')
    descargar.mockRestore()
  })
})
