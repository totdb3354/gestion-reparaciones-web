import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Outlet } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import type { LogActividad, Usuario } from '@/shared/api/client'
import { estaConectado } from '@/shared/api/conexion'
import { ExportableProvider, useExportable } from '@/shared/ui/exportable'
import { renderConProviders, renderConRouter, SESION_ADMIN } from '@/test/render'
import { server } from '@/test/server'
import { LogsPage } from './LogsPage'

const log = (o: Partial<LogActividad>): LogActividad => ({
  idLog: 1, fecha: '2026-09-25T08:00:00', nombreUsuario: 'usuario-a', accion: 'LOGIN', detalle: '', motivo: null, ...o,
})
// Orden del servidor: fecha desc, id desc. 08:15:30 UTC en septiembre = 10:15:30 en Madrid; 22:30 del 24 = 00:30 del 25.
const L1 = log({ idLog: 3, fecha: '2026-09-25T08:15:30', nombreUsuario: 'usuario-a', accion: 'CREAR_ASIGNACION', detalle: 'ID_REP: R1, IMEI: 000000000000000, TECNICO: tecnico-a' })
const L2 = log({ idLog: 2, fecha: '2026-09-25T08:10:00', nombreUsuario: 'usuario-b', accion: 'ELIMINAR_ASIGNACION', detalle: 'ID_REP: R2, IMEI: 000000000000001', motivo: 'Duplicada' })
const L3 = log({ idLog: 1, fecha: '2026-09-24T22:30:00', nombreUsuario: 'admin-prueba', accion: 'LOGIN', detalle: '' })
const LOGS = [L1, L2, L3]

const usuario = (idUsu: number, nombreUsuario: string): Usuario => ({
  idUsu, nombreUsuario, rol: 'TECNICO', idTec: idUsu + 10, nombreTecnico: `tecnico-${idUsu}`, activo: idUsu !== 3,
})
// Desordenados a propósito: la página los ordena con el orden natural de String (mayúsculas antes que minúsculas).
const USUARIOS = [usuario(1, 'usuario-b'), usuario(2, 'Usuario-C'), usuario(3, 'usuario-a')]

type Peticion = Record<string, string>
/** Registra los parámetros de cada GET /api/logs; `respuesta` recibe el número de petición (1, 2, …). */
function registrarLogs(respuesta: (n: number) => Response = () => HttpResponse.json(LOGS)) {
  const peticiones: Peticion[] = []
  server.use(
    http.get('*/api/logs', ({ request }) => {
      // `forEach` y no `Object.fromEntries(searchParams)`: sin DOM.Iterable en el `lib`, tsc -b da TS2769.
      const params: Peticion = {}
      new URL(request.url).searchParams.forEach((valor, clave) => { params[clave] = valor })
      peticiones.push(params)
      return respuesta(peticiones.length)
    }),
  )
  return peticiones
}
const ultima = (p: Peticion[]) => p[p.length - 1]

beforeEach(() => {
  server.use(
    http.get('*/api/logs/acciones', () => HttpResponse.json(['CREAR_ASIGNACION', 'ELIMINAR_ASIGNACION', 'LOGIN'])),
    http.get('*/api/usuarios/tecnicos', () => HttpResponse.json(USUARIOS)),
  )
})

function abrir() {
  return renderConProviders(<LogsPage />, { sesion: SESION_ADMIN, ruta: '/gestion/logs' })
}

describe('LogsPage: estructura (LogView.fxml)', () => {
  it('cabecera, barra de filtros en su orden, pie y carga inicial con limite=1000 y sin filtros', async () => {
    const peticiones = registrarLogs()
    const { container } = abrir()
    expect(screen.getByRole('heading', { name: 'Log de actividad' })).toHaveClass('text-[18px]', 'font-bold', 'text-azul-medio')
    expect(screen.getByText('Registro de acciones realizadas en el sistema')).toHaveClass('text-[12px]', 'text-azul-gris')
    expect(container.querySelector('img[src="/logo_inicio_sesion.png"]')).toHaveClass('h-[46px]', 'w-[46px]')
    const buscar = screen.getByPlaceholderText('Buscar...')
    const accion = screen.getByRole('combobox', { name: 'Acción' })
    const tecnico = screen.getByRole('combobox', { name: 'Técnico' })
    expect(buscar).toHaveClass('w-[220px]')
    expect(accion).toHaveAttribute('placeholder', 'Acción...')
    expect(tecnico).toHaveAttribute('placeholder', 'Técnico...')
    expect(accion.parentElement?.parentElement).toHaveClass('w-[150px]')
    expect(tecnico.parentElement?.parentElement).toHaveClass('w-[150px]')
    expect(buscar.parentElement).toHaveClass('flex-wrap')
    const orden = [buscar, accion, tecnico, screen.getByLabelText('Desde:'), screen.getByLabelText('Hasta:'), screen.getByRole('button', { name: 'Limpiar filtros' })]
    for (let i = 1; i < orden.length; i++) {
      expect(orden[i - 1].compareDocumentPosition(orden[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    const actualizar = screen.getByRole('button', { name: 'Actualizar' })
    const cerrar = screen.getByRole('button', { name: 'Cerrar' })
    expect(actualizar.compareDocumentPosition(cerrar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(cerrar).toHaveClass('text-[12px]', 'text-azul-gris')
    await screen.findByText('CREAR_ASIGNACION')
    expect(peticiones).toEqual([{ limite: '1000' }])
  })
  it('tabla: Fecha con segundos en Madrid, en el orden del servidor, sin ordenación por cabecera', async () => {
    registrarLogs()
    abrir()
    await screen.findByText('CREAR_ASIGNACION')
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Fecha', 'Usuario', 'Acción', 'Detalle'])
    expect(within(screen.getAllByRole('columnheader')[0]).queryByRole('button')).not.toBeInTheDocument()
    const filas = screen.getAllByRole('row').slice(1)
    expect(filas.map((f) => within(f).getAllByRole('cell')[0].textContent)).toEqual(['25/09/2026 10:15:30', '25/09/2026 10:10:00', '25/09/2026 00:30:00'])
    expect(within(filas[0]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['25/09/2026 10:15:30', 'usuario-a', 'CREAR_ASIGNACION', 'ID_REP: R1, IMEI: 000000000000000, TECNICO: tecnico-a'])
  })
  it('sin filas: "Tabla sin contenido" y sin aviso de tope', async () => {
    registrarLogs(() => HttpResponse.json([]))
    abrir()
    expect(await screen.findByText('Tabla sin contenido')).toBeInTheDocument()
    expect(screen.queryByText(/Mostrando los 1\.000/)).not.toBeInTheDocument()
  })
  it('no registra exportable: "Descargar CSV" queda deshabilitado (calco, sin CSV de logs)', async () => {
    registrarLogs()
    function SondaCsv() {
      const exportar = useExportable()
      return <p>{exportar ? 'CSV ACTIVO' : 'CSV DESHABILITADO'}</p>
    }
    renderConProviders(<LogsPage />, {
      sesion: SESION_ADMIN, ruta: '/gestion/logs',
      layout: <ExportableProvider><Outlet /><SondaCsv /></ExportableProvider>,
    })
    await screen.findByText('CREAR_ASIGNACION')
    expect(screen.getByText('CSV DESHABILITADO')).toBeInTheDocument()
  })
})

describe('LogsPage: buscador en memoria', () => {
  it('filtra por usuario, acción o detalle sin pedir otra vez; no mira el motivo', async () => {
    const peticiones = registrarLogs()
    abrir()
    await screen.findByText('CREAR_ASIGNACION')
    const buscar = screen.getByPlaceholderText('Buscar...')
    await userEvent.type(buscar, '000000000000001')
    expect(screen.queryByText('CREAR_ASIGNACION')).not.toBeInTheDocument()
    expect(screen.getByText('ELIMINAR_ASIGNACION')).toBeInTheDocument()
    await userEvent.clear(buscar)
    await userEvent.type(buscar, 'duplicada')
    expect(screen.getByText('Tabla sin contenido')).toBeInTheDocument()
    expect(peticiones).toHaveLength(1)
  })
  it('"Actualizar" recarga con los filtros actuales y el buscador se conserva', async () => {
    const peticiones = registrarLogs()
    abrir()
    await screen.findByText('CREAR_ASIGNACION')
    await userEvent.type(screen.getByPlaceholderText('Buscar...'), 'usuario-b')
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(peticiones).toHaveLength(2))
    expect(peticiones[1]).toEqual({ limite: '1000' })
    expect(screen.getByPlaceholderText('Buscar...')).toHaveValue('usuario-b')
    expect(screen.queryByText('CREAR_ASIGNACION')).not.toBeInTheDocument()
    expect(screen.getByText('ELIMINAR_ASIGNACION')).toBeInTheDocument()
  })
})

describe('LogsPage: filtros de servidor', () => {
  it('"Acción...": opciones de /api/logs/acciones; elegir filtra; teclear otra cosa no lo quita; vaciarlo sí', async () => {
    const peticiones = registrarLogs()
    abrir()
    await screen.findByText('CREAR_ASIGNACION')
    const campo = screen.getByRole('combobox', { name: 'Acción' })
    await userEvent.type(campo, 'asig')
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['CREAR_ASIGNACION', 'ELIMINAR_ASIGNACION'])
    await userEvent.click(screen.getByRole('option', { name: 'ELIMINAR_ASIGNACION' }))
    await waitFor(() => expect(ultima(peticiones)).toEqual({ limite: '1000', accion: 'ELIMINAR_ASIGNACION' }))
    // Calco de LogController :137-144: editar el texto a otra cosa no vacía no quita la acción elegida.
    await userEvent.type(campo, 'X')
    expect(peticiones).toHaveLength(2)
    await userEvent.clear(campo)
    await waitFor(() => expect(peticiones).toHaveLength(3))
    expect(ultima(peticiones)).toEqual({ limite: '1000' })
  })
  it('"Técnico...": nombres de usuario en orden natural de cadena; elegir manda `tecnico`', async () => {
    const peticiones = registrarLogs()
    abrir()
    await screen.findByText('CREAR_ASIGNACION')
    await userEvent.type(screen.getByRole('combobox', { name: 'Técnico' }), 'suario')
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['Usuario-C', 'usuario-a', 'usuario-b'])
    await userEvent.click(screen.getByRole('option', { name: 'usuario-a' }))
    await waitFor(() => expect(ultima(peticiones)).toEqual({ limite: '1000', tecnico: 'usuario-a' }))
  })
  it('"Desde:" y "Hasta:" mandan las fechas yyyy-MM-dd', async () => {
    const peticiones = registrarLogs()
    abrir()
    await screen.findByText('CREAR_ASIGNACION')
    fireEvent.change(screen.getByLabelText('Desde:'), { target: { value: '2026-09-01' } })
    await waitFor(() => expect(ultima(peticiones)).toEqual({ limite: '1000', desde: '2026-09-01' }))
    fireEvent.change(screen.getByLabelText('Hasta:'), { target: { value: '2026-09-26' } })
    await waitFor(() => expect(ultima(peticiones)).toEqual({ limite: '1000', desde: '2026-09-01', hasta: '2026-09-26' }))
  })
  it('"Limpiar filtros" vacía los cinco y recarga una sola vez', async () => {
    const peticiones = registrarLogs()
    abrir()
    await screen.findByText('CREAR_ASIGNACION')
    await userEvent.type(screen.getByPlaceholderText('Buscar...'), 'usuario-a')
    fireEvent.change(screen.getByLabelText('Desde:'), { target: { value: '2026-09-01' } })
    await waitFor(() => expect(peticiones).toHaveLength(2))
    await userEvent.type(screen.getByRole('combobox', { name: 'Acción' }), 'LOG')
    await userEvent.click(await screen.findByRole('option', { name: 'LOGIN' }))
    await waitFor(() => expect(peticiones).toHaveLength(3))
    await userEvent.type(screen.getByRole('combobox', { name: 'Técnico' }), 'usuario-b')
    await userEvent.click(await screen.findByRole('option', { name: 'usuario-b' }))
    await waitFor(() => expect(peticiones).toHaveLength(4))
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() => expect(peticiones).toHaveLength(5))
    expect(peticiones[4]).toEqual({ limite: '1000' })
    expect(screen.getByPlaceholderText('Buscar...')).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Acción' })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Técnico' })).toHaveValue('')
    expect(screen.getByLabelText('Desde:')).toHaveValue('')
    expect(screen.getByLabelText('Hasta:')).toHaveValue('')
    await new Promise((r) => setTimeout(r, 50))
    expect(peticiones).toHaveLength(5)
  })
})

describe('LogsPage: aviso de tope (G3)', () => {
  it('con exactamente 1.000 filas avisa bajo la barra; con 999, no', async () => {
    const lote = (n: number) => Array.from({ length: n }, (_, i) => log({ idLog: n - i, detalle: `ID_REP: R${i}` }))
    registrarLogs(() => HttpResponse.json(lote(1000)))
    const { unmount } = abrir()
    expect(await screen.findByText('Mostrando los 1.000 registros más recientes; acota con los filtros.')).toBeInTheDocument()
    unmount()
    sessionStorage.clear()
    registrarLogs(() => HttpResponse.json(lote(999)))
    abrir()
    await screen.findByText('ID_REP: R0')
    expect(screen.queryByText('Mostrando los 1.000 registros más recientes; acota con los filtros.')).not.toBeInTheDocument()
  })
})

describe('LogsPage: doble clic (LogController :93-103)', () => {
  it('abre "Detalle del log" con el motivo tras una línea en blanco, o solo el detalle', async () => {
    registrarLogs()
    abrir()
    await userEvent.dblClick(await screen.findByText('ELIMINAR_ASIGNACION'))
    const dlg = await screen.findByRole('dialog', { name: 'Detalle del log' })
    expect(within(dlg).getByRole('textbox')).toHaveValue('ID_REP: R2, IMEI: 000000000000001\n\nMOTIVO: Duplicada')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Detalle del log' })).not.toBeInTheDocument())
    await userEvent.dblClick(screen.getByText('CREAR_ASIGNACION'))
    const otro = await screen.findByRole('dialog', { name: 'Detalle del log' })
    expect(within(otro).getByRole('textbox')).toHaveValue('ID_REP: R1, IMEI: 000000000000000, TECNICO: tecnico-a')
  })
})

describe('LogsPage: errores', () => {
  it('un fallo al cambiar un filtro avisa "Error al cargar los logs: …" y la tabla conserva lo que tenía', async () => {
    registrarLogs((n) => (n === 1 ? HttpResponse.json(LOGS) : new HttpResponse(null, { status: 403 })))
    abrir()
    await screen.findByText('CREAR_ASIGNACION')
    fireEvent.change(screen.getByLabelText('Desde:'), { target: { value: '2026-09-01' } })
    const dlg = await screen.findByRole('dialog', { name: 'Error' })
    expect(dlg).toHaveTextContent('Error al cargar los logs: No tienes permisos para realizar esta acción.')
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByText('CREAR_ASIGNACION')).toBeInTheDocument()
    expect(screen.getByText('ELIMINAR_ASIGNACION')).toBeInTheDocument()
  })
  it('un fallo de "Actualizar" avisa con el mensaje del servidor y conserva las filas', async () => {
    registrarLogs((n) => (n === 1 ? HttpResponse.json(LOGS) : HttpResponse.json({ message: 'Fallo de prueba' }, { status: 400 })))
    abrir()
    await screen.findByText('CREAR_ASIGNACION')
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(await screen.findByRole('dialog', { name: 'Error' })).toHaveTextContent('Error al cargar los logs: Fallo de prueba')
    expect(screen.getByText('CREAR_ASIGNACION')).toBeInTheDocument()
  })
  it('sin conexión: solo el banner de la política global, sin "Error al cargar los logs"', async () => {
    // Las dos listas también fallan (sin conexión real caerían todas): si respondieran 200, `client.ts` llamaría a
    // `reportarExito()` y el banner se apagaría solo. Mismo recurso que `ClientesPage.test.tsx:148`.
    server.use(
      http.get('*/api/logs/acciones', () => new HttpResponse(null, { status: 500 })),
      http.get('*/api/usuarios/tecnicos', () => new HttpResponse(null, { status: 500 })),
    )
    registrarLogs(() => new HttpResponse(null, { status: 500 }))
    abrir()
    await waitFor(() => expect(estaConectado()).toBe(false))
    expect(screen.queryByText(/Error al cargar los logs/)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('un fallo de las listas de acciones o de usuarios es silencioso: los autocompletar quedan vacíos', async () => {
    server.use(
      http.get('*/api/logs/acciones', () => new HttpResponse(null, { status: 403 })),
      http.get('*/api/usuarios/tecnicos', () => new HttpResponse(null, { status: 403 })),
    )
    registrarLogs()
    abrir()
    await screen.findByText('CREAR_ASIGNACION')
    await userEvent.type(screen.getByRole('combobox', { name: 'Acción' }), 'a')
    await userEvent.type(screen.getByRole('combobox', { name: 'Técnico' }), 'a')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('LogsPage: "Cerrar"', () => {
  it('vuelve a la vista desde la que se abrió (state.volverA); al reabrir, los filtros están vacíos', async () => {
    registrarLogs()
    const { router } = renderConRouter(
      [
        { path: '/stock', element: <p>STOCK</p> },
        { path: '/reparaciones', element: <p>REPARACIONES</p> },
        { path: '/gestion/logs', element: <LogsPage /> },
      ],
      { sesion: SESION_ADMIN, ruta: '/stock' },
    )
    await act(() => router.navigate('/gestion/logs', { state: { volverA: '/stock' } }))
    await userEvent.type(await screen.findByPlaceholderText('Buscar...'), 'usuario-a')
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(await screen.findByText('STOCK')).toBeInTheDocument()
    await act(() => router.navigate('/gestion/logs'))
    expect(await screen.findByPlaceholderText('Buscar...')).toHaveValue('')
  })
  it('sin volverA vuelve a /reparaciones', async () => {
    registrarLogs()
    renderConRouter(
      [
        { path: '/reparaciones', element: <p>REPARACIONES</p> },
        { path: '/gestion/logs', element: <LogsPage /> },
      ],
      { sesion: SESION_ADMIN, ruta: '/gestion/logs' },
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))
    expect(await screen.findByText('REPARACIONES')).toBeInTheDocument()
  })
})
