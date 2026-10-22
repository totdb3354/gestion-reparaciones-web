import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Route } from 'react-router'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
// eslint-disable-next-line no-restricted-imports -- solo "Descargar CSV" necesita el AppLayout real (TopBar/UserMenu); ver su uso más abajo.
import { AppLayout } from '@/app/shell/AppLayout'
import { server } from '@/test/server'
import { anchosDeColumnas, simularAnchoDeTabla } from '@/test/columnas'
import { renderConProviders, SESION_ADMIN, SESION_SUPER, SESION_TEC } from '@/test/render'
import * as csv from '@/shared/lib/csv'
import { CREMA_EN_FILA_SELECCIONADA } from '@/shared/ui/DataTable'
import { filtrosImeis, ultimoImeiVisto } from '../estado'
import { handlersNotificaciones } from '../notificaciones/test/handlers'
import { resumen, tecnico } from '../test/fabrica'
import { ImeiDetallePage } from './ImeiDetallePage'
import { ImeisPage } from './ImeisPage'

const A = '351900000000041', B = '358800000000131'
const reps = [
  resumen({ idRep: 'R20260916_6', imei: B, modelo: '14', idTec: 5, nombreTecnico: 'tecnico_i', fechaAsig: '2026-09-16T07:00:00', fechaFin: '2026-09-16T07:30:00', observacionTelefono: 'tapa rayada', cliente: 'WEB', telefonoUpdatedAt: '2026-09-01T00:00:00' }),
  resumen({ idRep: 'R20260910_1', imei: A, modelo: '16', idTec: 6, nombreTecnico: 'tecnico_b', fechaAsig: '2026-09-10T10:00:00', fechaFin: '2026-09-11T10:00:00', esIncidencia: true, incidencia: 'no enciende', cliente: null, telefonoUpdatedAt: null }),
]
const glass = [resumen({ idRep: 'G20260912_1', imei: A, modelo: '16', idTec: 5, nombreTecnico: 'tecnico_i', fechaAsig: '2026-09-12T10:00:00', fechaFin: '2026-09-12T11:00:00', cliente: null })]
const pulidos = [resumen({ idRep: 'P20260913_1', imei: A, modelo: '16', idTec: 5, nombreTecnico: 'tecnico_i', fechaAsig: '2026-09-13T10:00:00', fechaFin: '2026-09-13T11:00:00', cliente: null })]

beforeEach(() => {
  // <AppLayout/> con supertécnico monta la campana de la barra, que pide sus contadores y los componentes gestionados.
  server.use(...handlersNotificaciones())
  server.use(
    http.get('*/api/reparaciones/historial', () => HttpResponse.json(reps)),
    http.get('*/api/glass/historial', () => HttpResponse.json(glass)),
    http.get('*/api/pulidos/historial', () => HttpResponse.json(pulidos)),
    http.get('*/api/tecnicos', () => HttpResponse.json([tecnico({ idTec: 5, nombre: 'tecnico_i' }), tecnico({ idTec: 6, nombre: 'tecnico_b' })])),
    // El detalle (al navegar hasta él) monta useAccionesTrabajo, que renderiza DialogoIncidencia sin condicionarlo
    // a que esté abierto: pide los técnicos activos igual que en HistorialPage.test.tsx.
    http.get('*/api/tecnicos/activos', () => HttpResponse.json([tecnico({ idTec: 5, nombre: 'tecnico_i' }), tecnico({ idTec: 6, nombre: 'tecnico_b' })])),
    http.get('*/api/clientes/activos', () => HttpResponse.json([{ idCli: 1, nombre: 'AMAZON', activo: true, updatedAt: null }, { idCli: 2, nombre: 'WEB', activo: true, updatedAt: null }])),
    // El test del CSV monta <AppLayout/>: su SubNav pinta el badge de "Pendientes" del supertécnico (BadgePendientes),
    // que pide esto aparte de los datos del propio Agrupado (como en la Task 14/16).
    http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json({ reparaciones: 0, glass: 0, pulidos: 0 })),
  )
})
const abrir = (sesion = SESION_SUPER) =>
  renderConProviders(<ImeisPage />, { sesion, ruta: '/reparaciones/imeis', rutas: <Route path="/reparaciones/imeis/:imei" element={<ImeiDetallePage />} /> })

describe('ImeisPage — maestro (ficha docs/paridad/imeis.md)', () => {
  it('título, contador, columnas, agrupación y orden por actividad', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Agrupado por IMEI' })).toBeInTheDocument()
    await screen.findByText(A)
    expect(screen.getByText('2 IMEIs')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['IMEI teléfono', 'Modelo', 'Fechas', 'Trabajos', 'Estado', 'Observación', 'Cliente'])
    const filas = screen.getAllByRole('row').slice(1)
    expect(filas[0]).toHaveTextContent(B)
    expect(filas[1]).toHaveTextContent(A)
    expect(filas[1]).toHaveTextContent('1 Rep · 1 Glass · 1 Pul')
    expect(within(filas[1]).getByText('Incidencia')).toBeInTheDocument()
    expect(filas[1]).toHaveClass('border-l-fila-incidencia-brd')
    expect(within(filas[0]).getByText('Normal')).toBeInTheDocument()
    expect(filas[0]).toHaveClass('border-l-azul-medio', 'data-[state=selected]:border-l-transparent')
    // El IMEI (negrita azul medio) pasa a blanco en la fila seleccionada, como el selListener de colImei; la píldora no.
    expect(within(filas[0]).getByText(B)).toHaveClass('font-bold', 'text-azul-medio', CREMA_EN_FILA_SELECCIONADA)
    expect(within(filas[0]).getByText('Normal')).not.toHaveClass(CREMA_EN_FILA_SELECCIONADA)
    expect(within(filas[0]).getByText('16/09/2026 09:00')).toBeInTheDocument()
    expect(within(filas[0]).getByText('→ 16/09/2026 09:30')).toBeInTheDocument()
    expect(within(filas[0]).getByText('tapa rayada')).toBeInTheDocument()
    // tabla.setFixedCellSize(44)
    expect(filas[0]).toHaveStyle({ height: '44px' })
    expect(screen.queryByText(/Actualizado/)).not.toBeInTheDocument()
  })
  it('columnas con el prefWidth del maestro como mínimo, sin columna de relleno (ajuste fluido); filas con cursor de mano y el mismo fondo al pasar', async () => {
    const { container } = abrir()
    await screen.findByText(A)
    // la tabla llena el contenedor y no baja de la suma de los mínimos (resetarModo: IMEI 180 · Modelo 150 · Fechas 130 ·
    // Trabajos 160 · Estado 130; Observación y Cliente sin prefWidth en AgrupadoView.fxml, acotado a su minWidth 150)
    expect(screen.getByRole('table')).toHaveStyle({ minWidth: '1050px' })
    expect(screen.getByRole('table')).toHaveClass('w-full')
    expect(container.querySelector('[data-relleno]')).toBeNull()
    const fila = screen.getByRole('row', { name: new RegExp(A) })
    expect(fila).toHaveClass('cursor-pointer', 'bg-fila-maestro-bg', 'hover:bg-fila-maestro-bg')
    expect(fila).not.toHaveClass('cursor-default')
    expect(fila).not.toHaveClass('hover:bg-muted/50')
  })
  it('con el contenedor medido, IMEI, Fechas y Estado quedan fijas y Modelo, Trabajos, Observación y Cliente se reparten el sobrante', async () => {
    // 1660 px: 440 para las fijas y 1220 para las de texto, el doble de sus mínimos (610)
    simularAnchoDeTabla(1660)
    const { container } = abrir()
    await screen.findByText(A)
    expect(anchosDeColumnas(container)).toEqual([180, 300, 130, 320, 130, 300, 300])
  })
  it('filtros: IMEI, Técnico, Cliente con "(Sin cliente)", Incidencias con dos casillas, Limpiar', async () => {
    abrir()
    await screen.findByText(A)
    await userEvent.type(screen.getByPlaceholderText('Filtrar por IMEI'), B)
    expect(screen.getByText('1 IMEI')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await userEvent.click(screen.getByRole('button', { name: 'Técnico' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'tecnico_b' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getByRole('row', { name: new RegExp(A) })).toHaveTextContent('1 Rep · 1 Glass · 1 Pul')
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cliente' }))
    expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual(['(Sin cliente)', 'WEB'])
    await userEvent.click(screen.getByRole('checkbox', { name: '(Sin cliente)' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getByRole('row', { name: new RegExp(A) })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await userEvent.click(screen.getByRole('button', { name: 'Incidencias' }))
    expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual(['Incidencia', 'Normal'])
    await userEvent.click(screen.getByRole('checkbox', { name: 'Normal' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Normal' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getByRole('row', { name: new RegExp(B) })).toBeInTheDocument()
  })
  it('Incidencias del maestro: al entrar se desmarca "Cerradas" (adaptarFiltrosMaestro) y con las dos casillas marcadas la etiqueta es "2 filtros", nunca "Todas"', async () => {
    abrir()
    await screen.findByText(A)
    await userEvent.click(screen.getByRole('button', { name: `Ver trabajos de ${A}` }))
    await screen.findByText(`IMEI: ${A}`)
    await userEvent.click(screen.getByRole('button', { name: 'Incidencias' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Abiertas' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Cerradas' }))
    await userEvent.keyboard('{Escape}')
    expect(filtrosImeis.get().incidencias).toEqual(new Set(['abiertas', 'cerradas']))
    await userEvent.click(screen.getByRole('button', { name: '← Volver' }))
    // El título "Agrupado por IMEI" también está en el detalle: la señal de vuelta al maestro es su filtro de IMEI.
    await screen.findByPlaceholderText('Filtrar por IMEI')
    await waitFor(() => expect(filtrosImeis.get().incidencias).toEqual(new Set(['abiertas'])))
    expect(screen.getByRole('button', { name: 'Incidencia' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Incidencia' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Normal' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: '2 filtros' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Todas' })).not.toBeInTheDocument()
    // Al volver a entrar en un detalle, "Cerradas" sigue desmarcada.
    await userEvent.click(screen.getByRole('button', { name: `Ver trabajos de ${B}` }))
    await screen.findByText(`IMEI: ${B}`)
    await userEvent.click(screen.getByRole('button', { name: '2 filtros' }))
    expect(screen.getByRole('checkbox', { name: 'Cerradas' })).toHaveAttribute('aria-checked', 'false')
  })
  it('el icono y el doble clic abren el detalle; al volver, el IMEI queda seleccionado', async () => {
    abrir()
    await screen.findByText(A)
    await userEvent.click(screen.getByRole('button', { name: `Ver trabajos de ${A}` }))
    expect(await screen.findByText(`IMEI: ${A}`)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '← Volver' }))
    // El título "Agrupado por IMEI" también está en el detalle: la señal de vuelta al maestro es su filtro de IMEI.
    await screen.findByPlaceholderText('Filtrar por IMEI')
    expect(await screen.findByRole('row', { name: new RegExp(A) })).toHaveAttribute('aria-selected', 'true')
    expect(ultimoImeiVisto.get()).toBeNull()
    await userEvent.dblClick(screen.getByText(B))
    expect(await screen.findByText(`IMEI: ${B}`)).toBeInTheDocument()
  })
  it('al volver del detalle desplaza solo la tabla del maestro, con tres filas de contexto por encima del IMEI (restaurarSeleccion)', async () => {
    // Cinco IMEIs con actividad entre la de B y la de A: A queda en la fila 6 y, con tres de contexto, arriba la fila 3.
    const intermedios = [1, 2, 3, 4, 5].map((i) =>
      resumen({ idRep: `R20260914_${i}`, imei: `35000000000000${i}`, modelo: '15', idTec: 5, nombreTecnico: 'tecnico_i', fechaAsig: `2026-09-14T0${i}:00:00`, fechaFin: `2026-09-14T0${i}:30:00`, cliente: null }),
    )
    server.use(http.get('*/api/reparaciones/historial', () => HttpResponse.json([...reps, ...intermedios])))
    // jsdom no maqueta: cabecera de 40 px y filas de 44 px colocadas por su data-index debajo de ella.
    const esFila = (el: HTMLElement) => el.tagName === 'TR' && el.dataset.index !== undefined
    const offsetTop = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      return esFila(this) ? 40 + Number(this.dataset.index) * 44 : 0
    })
    const offsetHeight = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.tagName === 'THEAD' ? 40 : esFila(this) ? 44 : 0
    })
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')
    onTestFinished(() => { offsetTop.mockRestore(); offsetHeight.mockRestore(); scrollIntoView.mockRestore() })
    abrir()
    await screen.findByText(A)
    await userEvent.click(screen.getByRole('button', { name: `Ver trabajos de ${A}` }))
    await userEvent.click(await screen.findByRole('button', { name: '← Volver' }))
    const filaA = await screen.findByRole('row', { name: new RegExp(A) })
    expect(filaA).toHaveAttribute('aria-selected', 'true')
    expect(filaA).toHaveAttribute('data-index', '6')
    // Calco de tabla.scrollTo(Math.max(0, idx - 3)): la fila 3 justo debajo de la cabecera.
    await waitFor(() => expect(screen.getByRole('table').parentElement!.scrollTop).toBe(3 * 44))
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
  it('menú del supertécnico: Copiar celda, Editar observación (PATCH con updatedAt) y 409 con su aviso', async () => {
    let body: unknown = null
    server.use(http.patch(`*/api/telefonos/${B}/observacion`, async ({ request }) => { body = await request.json(); return new HttpResponse(null, { status: 204 }) }))
    abrir()
    await screen.findByText(A)
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText(B) })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['📋  Copiar celda', 'Editar observación', 'Editar cliente'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar observación' }))
    const dlg = await screen.findByRole('dialog', { name: 'Observación del teléfono' })
    const area = within(dlg).getByLabelText(`Observación — IMEI ${B}`)
    expect(area).toHaveValue('tapa rayada')
    await userEvent.clear(area)
    await userEvent.type(area, '  tapa nueva ')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(body).toEqual({ observacion: 'tapa nueva', updatedAt: '2026-09-01T00:00:00' }))
    server.use(http.patch(`*/api/telefonos/${B}/observacion`, () => HttpResponse.json({ message: 'stale' }, { status: 409 })))
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText(B) })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar observación' }))
    let recargas = 0
    server.use(http.get('*/api/reparaciones/historial', () => { recargas++; return HttpResponse.json(reps) }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Observación del teléfono' })).getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('dialog', { name: 'Error' })).toHaveTextContent('El teléfono fue modificado por otro usuario. Se recargan los datos.')
    // Calco de AgrupadoController (dialog.close(); cargar();): con datos de otro usuario el diálogo se cierra y la lista se
    // recarga; dejarlo abierto obligaría a reintentar con el mismo updatedAt, que daría 409 siempre.
    // Por etiqueta y no por rol: con el aviso de error encima, el diálogo de debajo queda aria-hidden y *ByRole no lo nombra.
    await waitFor(() => expect(screen.queryByLabelText(`Observación — IMEI ${B}`)).not.toBeInTheDocument())
    await waitFor(() => expect(recargas).toBeGreaterThan(0))
  })
  it('"Editar observación": si el guardado falla, el diálogo sigue abierto con lo escrito; si sale bien, se cierra', async () => {
    let respuesta = () => HttpResponse.json({ message: 'No se pudo guardar la observación.' }, { status: 422 })
    let patches = 0
    server.use(http.patch(`*/api/telefonos/${B}/observacion`, () => { patches++; return respuesta() }))
    abrir()
    await userEvent.pointer({ keys: '[MouseRight]', target: await screen.findByText(B) })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar observación' }))
    const dlg = await screen.findByRole('dialog', { name: 'Observación del teléfono' })
    const area = within(dlg).getByLabelText(`Observación — IMEI ${B}`)
    await userEvent.clear(area)
    await userEvent.type(area, 'pantalla con rayas')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
    const error = await screen.findByRole('dialog', { name: 'Error' })
    expect(error).toHaveTextContent('No se pudo guardar: No se pudo guardar la observación.')
    expect(dlg).toBeInTheDocument()
    expect(area).toHaveValue('pantalla con rayas')
    await userEvent.click(within(error).getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Error' })).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Observación del teléfono' })).toBe(dlg)
    respuesta = () => new HttpResponse(null, { status: 204 })
    await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Observación del teléfono' })).not.toBeInTheDocument())
    expect(patches).toBe(2)
  })
  it('SUPERTECNICO, grupo sin fila Telefono (telefonoUpdatedAt null): solo Copiar celda', async () => {
    // Diferencia aceptada (docs/paridad/imeis.md, ImeisPage.tsx): "Editar observación"/"Editar cliente" exigen
    // updatedAt no nulo (Task 3); el grupo A no tiene fila Telefono (fixture de arriba).
    abrir()
    await screen.findByText(A)
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText(A) })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['📋  Copiar celda'])
  })
  it('"Editar cliente": "— Sin cliente —" primero, actual resaltado, Seleccionar deshabilitado hasta elegir, PATCH', async () => {
    let body: unknown = null
    server.use(http.patch(`*/api/telefonos/${B}/cliente`, async ({ request }) => { body = await request.json(); return new HttpResponse(null, { status: 204 }) }))
    abrir()
    await screen.findByText(A)
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText(B) })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar cliente' }))
    const dlg = await screen.findByRole('dialog', { name: 'Seleccionar cliente' })
    expect(within(dlg).getAllByRole('option').map((o) => o.textContent)).toEqual(['— Sin cliente —', 'AMAZON', 'WEB'])
    expect(within(dlg).getByRole('button', { name: 'WEB' })).toHaveClass('bg-seleccion-suave')
    expect(within(dlg).getByText('Nada seleccionado')).toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: 'Seleccionar' })).toBeDisabled()
    await userEvent.click(within(dlg).getByRole('button', { name: '— Sin cliente —' }))
    await userEvent.click(within(dlg).getByRole('button', { name: 'Seleccionar' }))
    await waitFor(() => expect(body).toEqual({ idCli: null, updatedAt: '2026-09-01T00:00:00' }))
  })
  it('"Editar cliente": elegir un cliente real (no "— Sin cliente —") hace PATCH con su idCli', async () => {
    let body: unknown = null
    server.use(http.patch(`*/api/telefonos/${B}/cliente`, async ({ request }) => { body = await request.json(); return new HttpResponse(null, { status: 204 }) }))
    abrir()
    await screen.findByText(A)
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText(B) })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar cliente' }))
    const dlg = await screen.findByRole('dialog', { name: 'Seleccionar cliente' })
    await userEvent.click(within(dlg).getByRole('button', { name: 'AMAZON' }))
    await userEvent.click(within(dlg).getByRole('button', { name: 'Seleccionar' }))
    await waitFor(() => expect(body).toEqual({ idCli: 1, updatedAt: '2026-09-01T00:00:00' }))
  })
  it('el técnico solo tiene Copiar celda', async () => {
    abrir(SESION_TEC)
    await screen.findByText(A)
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText(B) })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['📋  Copiar celda'])
  })
  it('el admin solo tiene Copiar celda', async () => {
    abrir(SESION_ADMIN)
    await screen.findByText(A)
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText(B) })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['📋  Copiar celda'])
  })
  it('CSV agrupado_resumen con los grupos visibles', async () => {
    const descargar = vi.spyOn(csv, 'descargarCsv').mockResolvedValue(undefined)
    // "Descargar CSV" vive en el menú de usuario de AppLayout (TopBar), así que aquí hace falta el layout real,
    // no solo la página: renderConProviders monta ImeisPage como ruta hija de <AppLayout/> (opción `layout`).
    renderConProviders(<ImeisPage />, { sesion: SESION_SUPER, ruta: '/reparaciones/imeis', layout: <AppLayout /> })
    await screen.findByText(A)
    await userEvent.click(screen.getByRole('button', { name: /Hola,/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Descargar CSV' }))
    const [base, cabeceras, filasCsv] = descargar.mock.calls[0]
    expect(base).toBe('agrupado_resumen')
    expect(cabeceras).toEqual(['IMEI', 'Modelo', 'Primera', 'Última', 'Reparaciones', 'Glass', 'Pulidos', 'Inc. abiertas', 'Observación', 'Cliente'])
    // Fila B: la única con Observación y Cliente no vacíos (la de A los tiene vacíos, ver abajo).
    expect(filasCsv[0]).toEqual([`="${B}"`, 'iPhone 14', '16/09/2026', '16/09/2026', '1', '0', '0', '0', 'tapa rayada', 'WEB'])
    expect(filasCsv[1]).toEqual([`="${A}"`, 'iPhone 16', '10/09/2026', '13/09/2026', '1', '1', '1', '1', '', ''])
    descargar.mockRestore()
  })
})

describe('ImeisPage: móviles sin trabajos del taller (0.9.17)', () => {
  it('el supertécnico que filtra por un IMEI ve también los móviles de NSYS sin trabajos y abre su detalle', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/stock-telefonos/buscar', () => HttpResponse.json([
      { imeiSn: '353918700112233', modelo: '11', modeloMaestro: '11', capacidad: '64GB', color: 'Negro', estado: 'VENDIDO', ubicacion: null, fechaVenta: '2023-05-02' },
    ])))
    renderConProviders(<ImeisPage />, { sesion: SESION_SUPER, ruta: '/reparaciones/imeis',
      rutas: <Route path="/reparaciones/imeis/:imei" element={<p>Detalle del IMEI</p>} /> })
    await user.type(await screen.findByPlaceholderText('Filtrar por IMEI'), '353918700112233')
    // Por su texto: la capa de carga también usa role="status".
    const aviso = await screen.findByText(/También hay 1 móvil sin trabajos del taller con ese IMEI/)
    expect(aviso).toHaveAttribute('role', 'status')
    expect(aviso).toHaveTextContent('iPhone 11, vendido el 02/05/2023')
    await user.click(within(aviso).getByRole('button', { name: '353918700112233' }))
    expect(await screen.findByText('Detalle del IMEI')).toBeInTheDocument()
  })

  it('un IMEI con trabajos no sale en el aviso aunque los filtros de fecha lo escondan', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/stock-telefonos/buscar', () => HttpResponse.json([
      { imeiSn: A, modelo: '16', modeloMaestro: '16', capacidad: '128GB', color: 'Negro', estado: 'STOCK', ubicacion: 'Listos', fechaVenta: null },
    ])))
    filtrosImeis.set({ ...filtrosImeis.get(), desde: '2030-01-01' })
    renderConProviders(<ImeisPage />, { sesion: SESION_SUPER, ruta: '/reparaciones/imeis' })
    await user.type(await screen.findByPlaceholderText('Filtrar por IMEI'), A)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText(/También hay/)).not.toBeInTheDocument()
  })

  it('con un IMEI a medias no se pregunta a NSYS', async () => {
    const user = userEvent.setup()
    let pedidas = 0
    server.use(http.get('*/api/stock-telefonos/buscar', () => { pedidas++; return HttpResponse.json([]) }))
    renderConProviders(<ImeisPage />, { sesion: SESION_SUPER, ruta: '/reparaciones/imeis' })
    await user.type(await screen.findByPlaceholderText('Filtrar por IMEI'), '3539187001122')
    await new Promise((r) => setTimeout(r, 100))
    expect(pedidas).toBe(0)
  })

  it('el técnico no busca en NSYS', async () => {
    const user = userEvent.setup()
    let pedidas = 0
    server.use(http.get('*/api/stock-telefonos/buscar', () => { pedidas++; return HttpResponse.json([]) }))
    renderConProviders(<ImeisPage />, { sesion: SESION_TEC, ruta: '/reparaciones/imeis' })
    await user.type(await screen.findByPlaceholderText('Filtrar por IMEI'), '353918700112233')
    // Margen para que una petición, si la hubiera, llegase a MSW.
    await new Promise((r) => setTimeout(r, 50))
    expect(pedidas).toBe(0)
  })
})

describe('ImeisPage: el aviso de móviles sin trabajos espera al historial (0.9.17)', () => {
  it('si el historial falla no se afirma que un móvil no tiene trabajos', async () => {
    server.use(
      http.get('*/api/reparaciones/historial', () => new HttpResponse(null, { status: 500 })),
      http.get('*/api/stock-telefonos/buscar', () => HttpResponse.json([
        { imeiSn: '353918700112233', modelo: '11', modeloMaestro: '11', capacidad: '64GB', color: 'Negro', estado: 'VENDIDO', ubicacion: null, fechaVenta: '2023-05-02' },
      ])),
    )
    filtrosImeis.set({ ...filtrosImeis.get(), imei: '353918700112233' })
    renderConProviders(<ImeisPage />, { sesion: SESION_SUPER, ruta: '/reparaciones/imeis' })
    await new Promise((r) => setTimeout(r, 300))
    expect(screen.queryByText(/También hay/)).not.toBeInTheDocument()
  })
})

describe('ImeisPage: Modelo con la descripción completa (0.9.21)', () => {
  it('el modelo del grupo lleva la capacidad y el color de NSYS, también al copiar la celda', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    onTestFinished(() => { if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor); else Reflect.deleteProperty(navigator, 'clipboard') })
    const escribir = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true })
    server.use(http.get('*/api/reparaciones/historial', () =>
      HttpResponse.json(reps.map((r) => (r.imei === B ? { ...r, capacidad: '128GB', color: 'Azul' } : r)))))
    abrir()
    const celda = await screen.findByText('iPhone 14 128GB Azul')
    expect(screen.getByText('iPhone 16')).toBeInTheDocument()
    await userEvent.pointer({ keys: '[MouseRight]', target: celda })
    await userEvent.click(await screen.findByRole('menuitem', { name: /Copiar celda/ }))
    expect(escribir).toHaveBeenCalledWith('iPhone 14 128GB Azul')
  })
})
