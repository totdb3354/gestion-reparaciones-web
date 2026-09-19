import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
// eslint-disable-next-line no-restricted-imports -- solo "Descargar CSV" necesita el AppLayout real (TopBar/UserMenu); ver su uso más abajo.
import { AppLayout } from '@/app/shell/AppLayout'
import { server } from '@/test/server'
import { renderConProviders, renderConRouter, SESION_SUPER, SESION_TEC } from '@/test/render'
import * as csv from '@/shared/lib/csv'
import { filtrosImeis, ultimoImeiVisto } from '../estado'
import { resumen, tecnico } from '../test/fabrica'
import { ImeiDetallePage } from './ImeiDetallePage'

const A = '351900000000041'
const reps = [
  resumen({ idRep: 'R20260910_1', imei: A, modelo: '16', idTec: 6, nombreTecnico: 'tecnico_b', nombreTecnicoAsigna: 'Técnico M', fechaAsig: '2026-09-10T10:00:00', fechaFin: '2026-09-11T10:00:00', tipoComponente: 'lcdi16negra', esIncidencia: true, incidencia: 'no enciende' }),
  resumen({ idRep: 'R20260916_6', imei: '358800000000131', modelo: '14', idTec: 5, nombreTecnico: 'tecnico_i' }),
]
const glass = [resumen({ idRep: 'G20260912_1', imei: A, modelo: '16', idTec: 5, nombreTecnico: 'tecnico_i', fechaAsig: '2026-09-12T10:00:00', fechaFin: '2026-09-12T11:00:00', tipoComponente: 'glassi16', esReutilizado: true })]
const pulidos = [resumen({ idRep: 'P20260913_1', imei: A, modelo: '16', idTec: 5, nombreTecnico: 'tecnico_i', fechaAsig: '2026-09-13T10:00:00', fechaFin: '2026-09-13T11:00:00', idRepAnterior: 'AP20260913_1' })]

beforeEach(() => {
  server.use(
    http.get('*/api/reparaciones/historial', () => HttpResponse.json(reps)),
    http.get('*/api/glass/historial', () => HttpResponse.json(glass)),
    http.get('*/api/pulidos/historial', () => HttpResponse.json(pulidos)),
    http.get('*/api/tecnicos', () => HttpResponse.json([tecnico({ idTec: 5, nombre: 'tecnico_i' }), tecnico({ idTec: 6, nombre: 'tecnico_b' })])),
    http.get('*/api/tecnicos/activos', () => HttpResponse.json([tecnico({ idTec: 5, nombre: 'tecnico_i' }), tecnico({ idTec: 6, nombre: 'tecnico_b' })])),
    // El test del CSV monta <AppLayout/>: su SubNav pinta el badge de "Pendientes" del supertécnico (BadgePendientes),
    // que pide esto aparte de los datos del propio Agrupado (como en la Task 14/16).
    http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json({ reparaciones: 0, glass: 0, pulidos: 0 })),
  )
})
const abrir = (sesion = SESION_SUPER) => renderConProviders(<ImeiDetallePage />, { sesion, ruta: `/reparaciones/imeis/${A}`, patron: '/reparaciones/imeis/:imei' })

describe('ImeiDetallePage (ficha docs/paridad/imeis.md, detalle)', () => {
  it('barra, filtros, columnas, orden cronológico, Tipo, enlace anterior oculto en pulidos', async () => {
    abrir()
    expect(await screen.findByText(`IMEI: ${A}`)).toBeInTheDocument()
    // findByText (no getByText): "IMEI: <A>" viene del parámetro de la ruta y se pinta ya en el primer render;
    // "• iPhone 16" depende de los datos (mismo patrón que HistorialPage.test.tsx, "3 reparaciones").
    expect(await screen.findByText('• iPhone 16')).toBeInTheDocument()
    expect(screen.getByText('• 3 trabajos')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Filtrar por IMEI')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cliente' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Tipo', 'Id', 'IMEI teléfono', 'Modelo', 'Reparador', 'Asignado por', 'Fechas', 'Componente', 'Observaciones', 'Estado', 'Incidencia', 'Id Rep. Anterior'])
    const filas = screen.getAllByRole('row').slice(1)
    expect(filas.map((f) => within(f).getAllByRole('cell')[1].textContent)).toEqual(['R20260910_1', 'G20260912_1', 'P20260913_1'])
    expect(filas.map((f) => within(f).getAllByRole('cell')[0].textContent)).toEqual(['Reparación', 'Glass', 'Pulido'])
    expect(within(filas[0]).getByText('2026/09/10 12:00')).toBeInTheDocument()
    expect(within(filas[1]).getByText('Reutilizado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'AP20260913_1' })).not.toBeInTheDocument()
    expect(filas[0]).toHaveClass('border-l-fila-incidencia-brd')
    // tabla.setFixedCellSize(44), la misma tabla en maestro y detalle
    expect(filas[0]).toHaveStyle({ height: '44px' })
    expect(ultimoImeiVisto.get()).toBe(A)
    await userEvent.click(screen.getByRole('button', { name: 'Incidencias' }))
    expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual(['Abiertas', 'Cerradas', 'Sin incidencia'])
  })
  it('conserva el título "Agrupado por IMEI" del maestro, sin la píldora contador (lblContador se oculta en DETALLE)', async () => {
    abrir()
    await screen.findByText('• 3 trabajos')
    expect(screen.getByRole('heading', { level: 1, name: 'Agrupado por IMEI' })).toHaveClass('text-2xl', 'font-bold', 'text-azul-medio')
    expect(screen.queryByText(/^\d+ IMEIs?$/)).not.toBeInTheDocument()
  })
  it('orden de AgrupadoView en el detalle: título, filtros, la barra "← Volver" justo encima de la tabla y la tabla (crearBarraNavegacion la inserta antes de la tabla)', async () => {
    abrir()
    await screen.findByText('• 3 trabajos')
    const antes = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    const titulo = screen.getByRole('heading', { name: 'Agrupado por IMEI' })
    const primerFiltro = screen.getByRole('button', { name: 'Técnico' })
    const ultimoFiltro = screen.getByRole('button', { name: 'Limpiar filtros' })
    const volver = screen.getByRole('button', { name: '← Volver' })
    const tabla = screen.getByRole('table')
    expect(antes(titulo, primerFiltro)).toBe(true)
    expect(antes(ultimoFiltro, volver)).toBe(true)
    expect(antes(volver, tabla)).toBe(true)
  })
  it('etiqueta de Incidencias con las tres casillas del detalle: "Incidencias", la única marcada, "2 filtros" y "Todas"', async () => {
    abrir()
    await screen.findByText(`IMEI: ${A}`)
    const marcar = async (etiqueta: string, boton: string) => {
      await userEvent.click(screen.getByRole('button', { name: boton }))
      await userEvent.click(screen.getByRole('checkbox', { name: etiqueta }))
      await userEvent.keyboard('{Escape}')
    }
    await marcar('Cerradas', 'Incidencias')
    expect(screen.getByRole('button', { name: 'Cerradas' })).toBeInTheDocument()
    await marcar('Sin incidencia', 'Cerradas')
    expect(screen.getByRole('button', { name: '2 filtros' })).toBeInTheDocument()
    await marcar('Abiertas', '2 filtros')
    expect(screen.getByRole('button', { name: 'Todas' })).toBeInTheDocument()
    expect(filtrosImeis.get().incidencias).toEqual(new Set(['cerradas', 'sin', 'abiertas']))
  })
  it('el enlace Id Rep. Anterior desplaza la tabla hasta esa fila y la enfoca en cada clic, también si ya estaba seleccionada (select(i); scrollTo(i); requestFocus())', async () => {
    const otraGlass = resumen({ idRep: 'G20260914_2', imei: A, modelo: '16', idTec: 5, nombreTecnico: 'tecnico_i', fechaAsig: '2026-09-14T10:00:00', fechaFin: '2026-09-14T11:00:00', idRepAnterior: 'G20260912_1' })
    server.use(http.get('*/api/glass/historial', () => HttpResponse.json([...glass, otraGlass])))
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
    // Orden cronológico: R20260910_1, G20260912_1 (fila 1), P20260913_1, G20260914_2 (la del enlace).
    const enlace = await screen.findByRole('button', { name: 'G20260912_1' })
    const contenedor = screen.getByRole('table').parentElement!
    await userEvent.click(enlace)
    expect(screen.getByRole('row', { name: /^Glass G20260912_1 / })).toHaveAttribute('aria-selected', 'true')
    expect(contenedor.scrollTop).toBe(44)
    expect(contenedor).toHaveFocus()
    // El usuario vuelve arriba con la rueda y el foco pasa a otro control; G20260912_1 sigue seleccionada.
    contenedor.scrollTop = 0
    screen.getByRole('button', { name: '← Volver' }).focus()
    await userEvent.click(enlace)
    expect(screen.getByRole('row', { name: /^Glass G20260912_1 / })).toHaveAttribute('aria-selected', 'true')
    expect(contenedor.scrollTop).toBe(44)
    expect(contenedor).toHaveFocus()
  })
  it('filtro de técnico: los suyos primero, los ajenos atenuados y el texto "X de filtrados + Y de otros"', async () => {
    filtrosImeis.set({ ...filtrosImeis.get(), tecnicos: new Set([6]) })
    abrir()
    await screen.findByText(`IMEI: ${A}`)
    expect(await screen.findByText('• 1 de filtrados + 2 de otros')).toBeInTheDocument()
    const filas = screen.getAllByRole('row').slice(1)
    expect(within(filas[0]).getAllByRole('cell')[1]).toHaveTextContent('R20260910_1')
    expect(filas[0]).not.toHaveClass('opacity-45')
    expect(filas[1]).toHaveClass('opacity-45')
  })
  it('"Editar" navega a /reparaciones/imeis/<imei>/editar/<idRep>; solo lo tienen las filas R y G', async () => {
    const { router } = renderConRouter(
      [{ path: '/reparaciones/imeis/:imei', element: <ImeiDetallePage />, children: [{ path: 'editar/:idRep', element: <p>FORMULARIO EDITAR</p> }] }],
      { sesion: SESION_SUPER, ruta: `/reparaciones/imeis/${A}` },
    )
    await screen.findByText('P20260913_1')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('P20260913_1') })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).not.toContain('Editar')
    await userEvent.keyboard('{Escape}')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('G20260912_1') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }))
    expect(router.state.location.pathname).toBe(`/reparaciones/imeis/${A}/editar/G20260912_1`)
    expect(await screen.findByText('FORMULARIO EDITAR')).toBeInTheDocument()
    expect(screen.getByText(`IMEI: ${A}`)).toBeInTheDocument()
  })

  it('"Borrar" del supertécnico usa el título "Borrar trabajo" y el aviso "Este trabajo está siendo referenciado"', async () => {
    let body: unknown = null
    server.use(
      http.get('*/api/reparaciones/G20260912_1/referenciadora', () => HttpResponse.json({ value: null })),
      http.get('*/api/reparaciones/R20260910_1/referenciadora', () => HttpResponse.json({ value: 'R20260916_6' })),
      http.delete('*/api/reparaciones/G20260912_1', async ({ request }) => { body = await request.json(); return new HttpResponse(null, { status: 204 }) }),
    )
    abrir()
    await screen.findByText(`IMEI: ${A}`)
    await screen.findByText('G20260912_1')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('G20260912_1') })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['Editar', 'Borrar', '📋  Copiar celda', 'Añadir incidencia'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Borrar' }))
    const dlg = await screen.findByRole('dialog', { name: 'Borrar trabajo' })
    await userEvent.type(within(dlg).getByPlaceholderText('Escribe el motivo del borrado...'), 'error')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Borrar trabajo' }))
    await waitFor(() => expect(body).toEqual({ motivo: 'error' }))
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('R20260910_1') })
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Borrar' }))
    expect(await screen.findByRole('dialog', { name: 'No se puede borrar' })).toHaveTextContent('Este trabajo está siendo referenciado. La reparación R20260916_6 apunta a esta. Bórrala primero.')
  })
  it('el técnico solo tiene Copiar celda y "← Volver" navega al maestro', async () => {
    abrir(SESION_TEC)
    await screen.findByText(`IMEI: ${A}`)
    await screen.findByText('G20260912_1')
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('G20260912_1') })
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['📋  Copiar celda'])
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: '← Volver' })).toBeInTheDocument()
  })
  it('CSV agrupado_<imei> con Tipo y sin ID anterior en pulidos', async () => {
    const descargar = vi.spyOn(csv, 'descargarCsv').mockImplementation(() => {})
    // "Descargar CSV" vive en el menú de usuario de AppLayout (TopBar): aquí hace falta el layout real, con
    // `patron` porque la ruta a testear (`/reparaciones/imeis/${A}`) lleva un parámetro.
    renderConProviders(<ImeiDetallePage />, { sesion: SESION_SUPER, ruta: `/reparaciones/imeis/${A}`, patron: '/reparaciones/imeis/:imei', layout: <AppLayout /> })
    await screen.findByText(`IMEI: ${A}`)
    await userEvent.click(screen.getByRole('button', { name: /Hola,/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Descargar CSV' }))
    const [base, cabeceras, filasCsv] = descargar.mock.calls[0]
    expect(base).toBe(`agrupado_${A}`)
    expect(cabeceras).toEqual(['Tipo', 'ID', 'IMEI', 'Técnico', 'Fecha asig.', 'Fecha fin', 'Componente', 'Reutilizado', 'Observaciones', 'Incidencia', 'Resuelto', 'ID Rep. anterior'])
    expect(filasCsv[0]).toEqual(['Reparación', 'R20260910_1', `="${A}"`, 'tecnico_b', '10/09/2026 12:00', '11/09/2026 12:00', 'lcdi16negra', 'No', '', 'no enciende', 'No', ''])
    // Fila glass: la única con esReutilizado true, ejercita la rama 'Sí' de la columna Reutilizado.
    expect(filasCsv[1]).toEqual(['Glass', 'G20260912_1', `="${A}"`, 'tecnico_i', '12/09/2026 12:00', '12/09/2026 13:00', 'glassi16', 'Sí', '', 'No', 'No', ''])
    expect(filasCsv[2]).toEqual(['Pulido', 'P20260913_1', `="${A}"`, 'tecnico_i', '13/09/2026 12:00', '13/09/2026 13:00', '', 'No', '', 'No', 'No', ''])
    descargar.mockRestore()
  })
})
