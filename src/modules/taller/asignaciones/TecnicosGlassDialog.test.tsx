import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tecnico } from '@/shared/api/client'
import { renderConProviders, SESION_ADMIN, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { tecnico } from '../test/fabrica'
import { AsignacionesPage } from './AsignacionesPage'
import { cambiosGlass } from './tecnicosGlass'
import { TecnicosGlassDialog } from './TecnicosGlassDialog'

/** A ya es de glass, B y C no: así el mismo fixture sirve para marcar, desmarcar y dejar intacto. */
const TECNICOS: Tecnico[] = [
  tecnico({ idTec: 1, nombre: 'Técnico A', esGlass: true }),
  tecnico({ idTec: 2, nombre: 'Técnico B', esGlass: false }),
  tecnico({ idTec: 3, nombre: 'Técnico C', esGlass: false }),
]

/** El servidor de los tests guarda de verdad: el GET devuelve lo que los PATCH han ido dejando. Sin eso no se
 *  puede comprobar qué ven los checks cuando unas peticiones van bien y otras fallan. */
let guardado: Tecnico[] = []
let enviados: { idTec: number; cuerpo: unknown }[] = []
let rechazados = new Set<number>()

function servirTecnicos(iniciales: Tecnico[]) {
  guardado = iniciales
  server.use(
    http.get('*/api/tecnicos/activos', () => HttpResponse.json(guardado)),
    http.patch('*/api/tecnicos/:idTec/glass', async ({ params, request }) => {
      const idTec = Number(params.idTec)
      const cuerpo = await request.json()
      enviados.push({ idTec, cuerpo })
      if (rechazados.has(idTec)) return new HttpResponse(null, { status: 403 })
      const habilitado = (cuerpo as { habilitado?: boolean }).habilitado === true
      guardado = guardado.map((t) => (t.idTec === idTec ? { ...t, esGlass: habilitado } : t))
      return new HttpResponse(null, { status: 204 })
    }),
  )
}

const cerrar = vi.fn()
const interaccion = vi.fn()

function abrir(tecnicos: Tecnico[] = TECNICOS, { soloLectura = false } = {}) {
  servirTecnicos(tecnicos)
  return renderConProviders(
    <TecnicosGlassDialog abierto soloLectura={soloLectura} onCerrar={cerrar} onInteraccion={interaccion} />,
    { sesion: soloLectura ? SESION_ADMIN : SESION_SUPER },
  )
}

const check = (nombre: string) => screen.getByRole('checkbox', { name: nombre })
const enviadoA = (idTec: number) => enviados.find((e) => e.idTec === idTec)

beforeEach(() => {
  enviados = []
  rechazados = new Set()
  cerrar.mockClear()
  interaccion.mockClear()
})

describe('TecnicosGlassDialog', () => {
  it('lista los técnicos activos con su estado actual', async () => {
    abrir()
    expect(await screen.findByRole('checkbox', { name: 'Técnico A' })).toBeChecked()
    expect(check('Técnico B')).not.toBeChecked()
    expect(check('Técnico C')).not.toBeChecked()
    expect(screen.getByText('Técnicos de glass')).toBeInTheDocument()
    expect(screen.getByText('A quién se le asigna la glass automáticamente')).toBeInTheDocument()
    // La nota al pie explica la regla: sin ella el diálogo no dice qué significa marcar a alguien.
    expect(screen.getByText(/la glass va al técnico marcado aquí con menos carga hoy/)).toBeInTheDocument()
  })

  it('al aceptar solo se mandan los que cambiaron', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Técnico B' }))
    await userEvent.click(check('Técnico A'))
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(cerrar).toHaveBeenCalled())
    // C no se ha tocado: no puede salir ninguna petición suya, aunque siga en la lista.
    expect(enviados.map((e) => e.idTec).sort()).toEqual([1, 2])
  })

  it('el cuerpo lleva `habilitado`, no `esGlass`', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Técnico B' }))
    await userEvent.click(check('Técnico A'))
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(cerrar).toHaveBeenCalled())
    // `esGlass` es el campo que se LEE del técnico; el que se escribe se llama `habilitado` (TecnicoGlassRequest).
    // toEqual y no toMatchObject: un `esGlass` de más en el cuerpo también tiene que hacer fallar el test.
    expect(enviadoA(2)?.cuerpo).toEqual({ habilitado: true })
    expect(enviadoA(1)?.cuerpo).toEqual({ habilitado: false })
  })

  it('si nada cambió, no sale ninguna petición', async () => {
    abrir()
    expect(await screen.findByRole('checkbox', { name: 'Técnico A' })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(cerrar).toHaveBeenCalled())
    expect(enviados).toEqual([])
  })

  it('marcar y desmarcar antes de aceptar deja al técnico como estaba: no sale su petición', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Técnico B' }))
    await userEvent.click(check('Técnico B'))
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(cerrar).toHaveBeenCalled())
    expect(enviados).toEqual([])
  })

  it('si una llamada falla, el diálogo no se cierra y los checks quedan en lo que sí se guardó', async () => {
    rechazados = new Set([3])
    abrir()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Técnico B' }))
    await userEvent.click(check('Técnico C'))
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar')
    expect(cerrar).not.toHaveBeenCalled()
    // Las dos salieron (la que falla no cancela a la otra) y los checks acaban enseñando lo que hay en el
    // servidor, no lo que el usuario eligió: B guardado, C sigue sin marcar.
    expect(enviados.map((e) => e.idTec).sort()).toEqual([2, 3])
    await waitFor(() => expect(check('Técnico B')).toBeChecked())
    expect(check('Técnico C')).not.toBeChecked()
  })

  it('en solo lectura los checks están deshabilitados y solo hay botón de cerrar', async () => {
    abrir(TECNICOS, { soloLectura: true })
    expect(await screen.findByRole('checkbox', { name: 'Técnico A' })).toBeDisabled()
    expect(check('Técnico B')).toBeDisabled()
    expect(check('Técnico C')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
  })

  it('avisa de la interacción al abrirse y al desmontarse (D4)', async () => {
    const { unmount } = abrir()
    expect(await screen.findByRole('checkbox', { name: 'Técnico A' })).toBeInTheDocument()
    expect(interaccion).toHaveBeenCalledWith(true)
    unmount()
    expect(interaccion).toHaveBeenCalledWith(false)
  })

  it('Cancelar cierra sin mandar nada', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Técnico B' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(cerrar).toHaveBeenCalled()
    expect(enviados).toEqual([])
  })
})

/** El cálculo de "qué cambió" vive aparte del componente y se prueba sin render: es la regla que decide qué sale
 *  por la red, y no depende de cómo esté pintado el diálogo. */
describe('cambiosGlass', () => {
  it('sin nada tocado no hay cambios', () => {
    expect(cambiosGlass(TECNICOS, {})).toEqual([])
  })

  it('solo devuelve los que difieren del estado del servidor', () => {
    expect(cambiosGlass(TECNICOS, { 1: false, 2: true, 3: false })).toEqual([
      { idTec: 1, habilitado: false },
      { idTec: 2, habilitado: true },
    ])
  })

  it('marcar lo que ya estaba marcado no es un cambio', () => {
    expect(cambiosGlass(TECNICOS, { 1: true, 2: false })).toEqual([])
  })

  it('ignora a los técnicos que ya no están en la lista', () => {
    expect(cambiosGlass(TECNICOS, { 99: true })).toEqual([])
  })
})

describe('TecnicosGlassDialog dentro de la vista', () => {
  beforeEach(() => {
    server.use(
      http.get('*/api/reparaciones/asignaciones', () => HttpResponse.json([])),
      http.get('*/api/glass/asignaciones', () => HttpResponse.json([])),
      http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([])),
      http.get('*/api/clientes/activos', () => HttpResponse.json([])),
    )
    servirTecnicos(TECNICOS)
  })

  it('el botón de la cabecera abre el diálogo y aceptar lo cierra', async () => {
    renderConProviders(<AsignacionesPage />, { sesion: SESION_SUPER, ruta: '/reparaciones/asignaciones' })
    await userEvent.click(await screen.findByRole('button', { name: 'Técnicos de glass' }))
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Técnico B' }))
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(enviadoA(2)?.cuerpo).toEqual({ habilitado: true })
  })
})
