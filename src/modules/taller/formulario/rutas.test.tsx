import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Outlet, type RouteObject } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderConRouter, SESION_SUPER, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { PendientesPage } from '../pendientes/PendientesPage'
import { detalleEdicion, resumen } from '../test/fabrica'
import { FormularioEditarRuta, FormularioNuevoRuta } from './rutas'
import { handlersFormulario } from './test/handlers'
import { borradorEnReposo } from './useBorrador'

// El formulario vuelca su borrador al desmontar: se desmonta aquí, con los handlers de MSW aún activos, y se espera.
// Este afterEach corre antes que el de src/test/setup.ts (los hooks "after" van en orden inverso al de registro).
afterEach(async () => {
  cleanup()
  await borradorEnReposo()
})

const TITULO = 'Nueva reparación — IMEI 355400000000111'
const LISTA = '/reparaciones/pendientes'
const FORMULARIO = '/reparaciones/pendientes/reparar/A20260916_1'

/** El mismo anidamiento que app/router.tsx: el formulario es ruta hija de la lista, que sigue montada debajo. */
const rutas: RouteObject[] = [
  { path: LISTA, element: <PendientesPage tipo="REPARACION" />, children: [{ path: 'reparar/:idAsignacion', element: <FormularioNuevoRuta glass={false} /> }] },
]

let listasPedidas = 0
let contadoresPedidos = 0

beforeEach(() => {
  listasPedidas = 0
  contadoresPedidos = 0
  server.use(...handlersFormulario())
  // Registrados después: tienen prioridad sobre cualquier handler anterior con el mismo patrón.
  server.use(
    http.get('*/api/reparaciones/asignaciones', () => { listasPedidas++; return HttpResponse.json([resumen()]) }),
    http.get('*/api/glass/asignaciones', () => HttpResponse.json([])),
    http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([])),
    http.get('*/api/reparaciones/pendientes/contadores', () => { contadoresPedidos++; return HttpResponse.json({ reparaciones: 1, glass: 0, pulidos: 0 }) }),
  )
})

const abrirEn = (ruta: string) => renderConRouter(rutas, { sesion: SESION_TEC, ruta })

describe('rutas del formulario (ficha docs/paridad/formulario.md · Apertura, rutas y cierre)', () => {
  it('el botón "Añadir reparación" navega a /reparaciones/pendientes/reparar/<id> y la lista sigue montada', async () => {
    const { router } = abrirEn(LISTA)
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir reparación' }))
    expect(router.state.location.pathname).toBe(FORMULARIO)
    expect(await screen.findByRole('dialog', { name: TITULO })).toBeInTheDocument()
    // La lista queda debajo del modal (fuera del árbol accesible, pero montada).
    expect(screen.getByText('Mis asignaciones pendientes')).toBeInTheDocument()
    expect(screen.getByText('A20260916_1')).toBeInTheDocument()
  })

  it('acceso directo por URL abre el formulario con el IMEI', async () => {
    abrirEn(FORMULARIO)
    expect(await screen.findByRole('dialog', { name: TITULO })).toBeInTheDocument()
    expect(screen.getByText('IMEI: 355400000000111')).toBeInTheDocument()
  })

  it('title de la pestaña y restauración al cerrar', async () => {
    document.title = 'FSGR'
    abrirEn(FORMULARIO)
    await screen.findByRole('dialog', { name: TITULO })
    expect(document.title).toBe(TITULO)
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }))
    await waitFor(() => expect(document.title).toBe('FSGR'))
  })

  it('✕ cierra y vuelve a la lista sin preguntar; Escape también', async () => {
    const { router } = abrirEn(FORMULARIO)
    await screen.findByRole('dialog', { name: TITULO })
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(LISTA))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir reparación' }))
    await screen.findByRole('dialog', { name: TITULO })
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(router.state.location.pathname).toBe(LISTA))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Atrás del navegador cierra (router.navigate(-1))', async () => {
    const { router } = abrirEn(LISTA)
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir reparación' }))
    await screen.findByRole('dialog', { name: TITULO })
    await act(async () => { await router.navigate(-1) })
    expect(router.state.location.pathname).toBe(LISTA)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('al cerrar se vuelven a pedir asignaciones y contadores', async () => {
    abrirEn(FORMULARIO)
    await screen.findByRole('dialog', { name: TITULO })
    await waitFor(() => expect(listasPedidas).toBeGreaterThan(0))
    const listasAntes = listasPedidas
    const contadoresAntes = contadoresPedidos
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }))
    await waitFor(() => expect(listasPedidas).toBeGreaterThan(listasAntes))
    await waitFor(() => expect(contadoresPedidos).toBeGreaterThan(contadoresAntes))
  })

  it('fallo de carga: aviso con el mensaje y vuelta a la lista', async () => {
    server.use(http.get('*/api/componentes/agrupados', () => HttpResponse.json({ message: 'Catálogo de componentes no disponible' }, { status: 422 })))
    const { router } = abrirEn(FORMULARIO)
    expect(await screen.findByText('Catálogo de componentes no disponible')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe(LISTA))
    expect(screen.queryByRole('dialog', { name: TITULO })).not.toBeInTheDocument()
  })

  it('403 del borrador: "No tienes permisos para realizar esta acción." y vuelta a la lista', async () => {
    server.use(http.get('*/api/reparaciones/:idRep/borrador', () => new HttpResponse(null, { status: 403 })))
    const { router } = abrirEn(FORMULARIO)
    expect(await screen.findByText('No tienes permisos para realizar esta acción.')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe(LISTA))
    expect(screen.queryByRole('dialog', { name: TITULO })).not.toBeInTheDocument()
  })

  it('404 de la asignación: aviso y vuelta a la lista', async () => {
    server.use(http.get('*/api/reparaciones/asignaciones/:idRep', () => new HttpResponse(null, { status: 404 })))
    const { router } = abrirEn(FORMULARIO)
    expect(await screen.findByText('Recurso no encontrado.')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe(LISTA))
  })
})

const LISTAS_PENDIENTES = [
  { path: '/reparaciones/pendientes', element: <><p>LISTA REPARACIONES</p><Outlet /></>, children: [{ path: 'reparar/:idAsignacion', element: <FormularioNuevoRuta glass={false} /> }] },
  { path: '/reparaciones/pendientes/glass', element: <><p>LISTA GLASS</p><Outlet /></>, children: [{ path: 'reparar/:idAsignacion', element: <FormularioNuevoRuta glass /> }] },
]
const idsDeFilas = () => screen.getAllByTestId(/^fila-/).map((f) => f.getAttribute('data-testid'))

describe('FormularioNuevoRuta — variante glass', () => {
  it('la ruta glass abre el formulario de la AG y cerrar vuelve a /reparaciones/pendientes/glass', async () => {
    server.use(...handlersFormulario({ asignacion: { idRep: 'AG20260916_2', imei: '355400000000222' }, modeloTelefono: '13' }))
    const { router } = renderConRouter(LISTAS_PENDIENTES, { sesion: SESION_TEC, ruta: '/reparaciones/pendientes/glass/reparar/AG20260916_2' })
    expect(await screen.findByRole('dialog', { name: 'Nueva reparación — IMEI 355400000000222' })).toBeInTheDocument()
    expect(idsDeFilas()).toEqual(['fila-g', 'fila-mc'])
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/reparaciones/pendientes/glass'))
    expect(screen.getByText('LISTA GLASS')).toBeInTheDocument()
  })

  it('manda el prefijo del id, no la ruta: una AG… bajo la ruta de reparaciones es glass, y una A… bajo la ruta glass es reparación; se vuelve a la lista de la ruta', async () => {
    server.use(...handlersFormulario({ asignacion: { idRep: 'AG20260916_2', imei: '355400000000222' }, modeloTelefono: '13' }))
    const primera = renderConRouter(LISTAS_PENDIENTES, { sesion: SESION_TEC, ruta: '/reparaciones/pendientes/reparar/AG20260916_2' })
    await screen.findByTestId('fila-g')
    expect(idsDeFilas()).toEqual(['fila-g', 'fila-mc'])
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }))
    await waitFor(() => expect(primera.router.state.location.pathname).toBe('/reparaciones/pendientes'))
    primera.unmount()

    server.use(...handlersFormulario({ asignacion: { idRep: 'A20260916_1' }, modeloTelefono: '13' }))
    const segunda = renderConRouter(LISTAS_PENDIENTES, { sesion: SESION_TEC, ruta: '/reparaciones/pendientes/glass/reparar/A20260916_1' })
    await screen.findByTestId('fila-bat')
    expect(idsDeFilas()).toEqual(['fila-bat', 'fila-cha', 'fila-lcd', 'fila-cam'])
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }))
    await waitFor(() => expect(segunda.router.state.location.pathname).toBe('/reparaciones/pendientes/glass'))
  })
})

const LISTAS_EDICION = [
  { path: '/reparaciones/historial', element: <><p>LISTA HISTORIAL</p><Outlet /></>, children: [{ path: 'editar/:idRep', element: <FormularioEditarRuta origen="historial" /> }] },
  { path: '/reparaciones/historial/glass', element: <><p>LISTA HISTORIAL GLASS</p><Outlet /></>, children: [{ path: 'editar/:idRep', element: <FormularioEditarRuta origen="historial-glass" /> }] },
  { path: '/reparaciones/imeis/:imei', element: <><p>DETALLE IMEI</p><Outlet /></>, children: [{ path: 'editar/:idRep', element: <FormularioEditarRuta origen="imei" /> }] },
]
const RUTA_EDITAR = '/reparaciones/historial/editar/R20260916_5'
function abrirRutaEditar(ruta = RUTA_EDITAR) {
  server.use(...handlersFormulario({ detalle: detalleEdicion() }))
  return renderConRouter(LISTAS_EDICION, { sesion: SESION_SUPER, ruta })
}
const cerrar = () => userEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }))

describe('FormularioEditarRuta — cierre y "Salir sin guardar"', () => {
  it('cada origen vuelve a su lista; el de IMEIs usa el :imei de la URL, no el de la reparación', async () => {
    const historial = abrirRutaEditar()
    await screen.findByRole('dialog', { name: 'Editar reparación — R20260916_5' })
    await cerrar()
    await waitFor(() => expect(historial.router.state.location.pathname).toBe('/reparaciones/historial'))
    historial.unmount()
    const glass = abrirRutaEditar('/reparaciones/historial/glass/editar/R20260916_5')
    await screen.findByRole('dialog', { name: 'Editar reparación — R20260916_5' })
    await cerrar()
    await waitFor(() => expect(glass.router.state.location.pathname).toBe('/reparaciones/historial/glass'))
    glass.unmount()
    const imei = abrirRutaEditar('/reparaciones/imeis/355400000000999/editar/R20260916_5')
    await screen.findByRole('dialog', { name: 'Editar reparación — R20260916_5' })
    await cerrar()
    await waitFor(() => expect(imei.router.state.location.pathname).toBe('/reparaciones/imeis/355400000000999'))
  })

  it('cerrar sin cambios cierra sin preguntar y restaura el title', async () => {
    const { router } = abrirRutaEditar()
    await screen.findByTestId('fila-bat')
    await cerrar()
    await waitFor(() => expect(router.state.location.pathname).toBe('/reparaciones/historial'))
    expect(screen.queryByRole('dialog', { name: 'Salir sin guardar' })).not.toBeInTheDocument()
    expect(document.title).not.toBe('Editar reparación — R20260916_5')
  })

  it('con cambios abre "Salir sin guardar"; "Cancelar" vuelve al formulario y "Salir sin guardar" cierra', async () => {
    const { router } = abrirRutaEditar()
    await userEvent.click(await screen.findByRole('button', { name: 'Sumar Batería' }))
    await cerrar()
    const dlg = await screen.findByRole('dialog', { name: 'Salir sin guardar' })
    expect(within(dlg).getByText('Tienes cambios sin guardar que se perderán si cierras el formulario.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(RUTA_EDITAR)
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog', { name: 'Salir sin guardar' })).not.toBeInTheDocument()
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('2')
    await cerrar()
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Salir sin guardar' })).getByRole('button', { name: 'Salir sin guardar' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/reparaciones/historial'))
    expect(screen.queryByTestId('fila-bat')).not.toBeInTheDocument()
  })

  it('Escape con cambios también pregunta', async () => {
    abrirRutaEditar()
    await userEvent.click(await screen.findByRole('button', { name: 'Sumar Batería' }))
    await userEvent.keyboard('{Escape}')
    expect(await screen.findByRole('dialog', { name: 'Salir sin guardar' })).toBeInTheDocument()
  })

  it('Atrás con cambios también abre el diálogo (useBlocker) y la URL no cambia hasta confirmar', async () => {
    server.use(...handlersFormulario({ detalle: detalleEdicion() }))
    const { router } = renderConRouter(LISTAS_EDICION, { sesion: SESION_SUPER, ruta: '/reparaciones/historial' })
    await act(async () => { await router.navigate(RUTA_EDITAR) })
    await userEvent.click(await screen.findByRole('button', { name: 'Sumar Batería' }))
    await act(async () => { await router.navigate(-1) })
    const dlg = await screen.findByRole('dialog', { name: 'Salir sin guardar' })
    expect(router.state.location.pathname).toBe(RUTA_EDITAR)
    await userEvent.click(within(dlg).getByRole('button', { name: 'Salir sin guardar' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/reparaciones/historial'))
  })

  it('cerrar con cambio inválido no pregunta y el cambio se pierde', async () => {
    const { router } = abrirRutaEditar()
    await userEvent.click(await screen.findByRole('button', { name: 'Restar Batería' }))
    expect(screen.queryByTestId('zona-guardar')).not.toBeInTheDocument()
    await cerrar()
    await waitFor(() => expect(router.state.location.pathname).toBe('/reparaciones/historial'))
    expect(screen.queryByRole('dialog', { name: 'Salir sin guardar' })).not.toBeInTheDocument()
  })

  it('tras "Guardar cambios" con éxito se cierra sin preguntar', async () => {
    const { router } = abrirRutaEditar()
    await userEvent.click(await screen.findByRole('button', { name: 'Sumar Batería' }))
    const zona = () => within(screen.getByTestId('zona-guardar')).getByRole('button')
    await userEvent.click(zona())
    await userEvent.click(zona())
    await waitFor(() => expect(router.state.location.pathname).toBe('/reparaciones/historial'))
    expect(screen.queryByRole('dialog', { name: 'Salir sin guardar' })).not.toBeInTheDocument()
  })
})
