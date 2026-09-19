import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import type { RouteObject } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderConRouter, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { PendientesPage } from '../pendientes/PendientesPage'
import { resumen } from '../test/fabrica'
import { FormularioNuevoRuta } from './rutas'
import { handlersFormulario } from './test/handlers'

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
