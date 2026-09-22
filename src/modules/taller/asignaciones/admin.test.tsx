import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Sesion } from '@/shared/session/storage'
import { TEXTO_COPIAR_CELDA } from '@/shared/ui/MenuCopiarCelda'
import { renderConProviders, SESION_ADMIN, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { filaCarga, resumen, tecnico } from '../test/fabrica'
import { AsignacionesPage } from './AsignacionesPage'

// Dos filas bastan para lo que se mira aquí (qué controles hay y cuáles no); el orden y el contenido de la tabla
// ya los cubre AsignacionesPage.test.tsx.
const reparacion = resumen({ idRep: 'A20260916_1', imei: '000000000000001', idTec: 4, nombreTecnico: 'Técnico A' })
const glass = resumen({ idRep: 'AG20260916_2', imei: '000000000000002', idTec: 5, nombreTecnico: 'Técnico B' })

const TECNICOS = [
  tecnico({ idTec: 4, nombre: 'Técnico A', esGlass: true }),
  tecnico({ idTec: 5, nombre: 'Técnico B', esGlass: false }),
]

beforeEach(() => {
  server.use(
    http.get('*/api/reparaciones/asignaciones', () => HttpResponse.json([reparacion])),
    http.get('*/api/glass/asignaciones', () => HttpResponse.json([glass])),
    http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([])),
    http.get('*/api/tecnicos/activos', () => HttpResponse.json(TECNICOS)),
    http.get('*/api/clientes/activos', () => HttpResponse.json([])),
    http.get('*/api/reparaciones/carga-tecnicos', () => HttpResponse.json({
      pedidos: [filaCarga({ idTec: 4, nombre: 'Técnico A', pctHecho: 20, pctPendiente: 30 })],
      total: [filaCarga({ idTec: 4, nombre: 'Técnico A', pctHecho: 10, pctPendiente: 5 })],
    })),
  )
})

const abrir = (sesion: Sesion) => renderConProviders(<AsignacionesPage />, { sesion, ruta: '/reparaciones/asignaciones' })

const filaDe = (idRep: string) => screen.getAllByRole('row').find((f) => within(f).queryByText(idRep))!

/** Clic derecho sobre la primera fila: monta MenuAsignacion con sus ítems. */
async function abrirMenuContextual() {
  fireEvent.contextMenu(within(filaDe('A20260916_1')).getByText('A20260916_1'))
  return (await screen.findAllByRole('menuitem')).map((i) => i.textContent)
}

/**
 * Solo lectura del ADMIN (spec 3a §12, D6): la ruta la abren SUPERTECNICO y ADMIN, pero el ADMIN no escribe.
 * Es la capa visible —las escrituras ya exigen el rol en el servidor—, así que lo que se comprueba aquí es
 * exactamente lo que el usuario ve: qué controles desaparecen y cuáles siguen funcionando.
 */
describe('AsignacionesPage · el ADMIN entra en solo lectura', () => {
  it('no se ve el botón "Asignar"', async () => {
    abrir(SESION_ADMIN)
    await screen.findByText('A20260916_1')
    expect(screen.queryByRole('button', { name: 'Asignar' })).not.toBeInTheDocument()
  })

  it('no se ve la columna de la papelera', async () => {
    abrir(SESION_ADMIN)
    await screen.findByText('A20260916_1')
    // La columna entera desaparece (no queda una celda vacía): diez cabeceras en vez de once.
    expect(screen.getAllByRole('columnheader')).toHaveLength(10)
    expect(screen.queryByRole('button', { name: 'Borrar asignación' })).not.toBeInTheDocument()
  })

  it('el menú contextual solo tiene "Copiar celda"', async () => {
    abrir(SESION_ADMIN)
    await screen.findByText('A20260916_1')
    expect(await abrirMenuContextual()).toEqual([TEXTO_COPIAR_CELDA])
  })

  it('la celda de técnico es texto plano, sin desplegable', async () => {
    abrir(SESION_ADMIN)
    await screen.findByText('A20260916_1')
    const fila = filaDe('A20260916_1')
    expect(within(fila).getByText('Técnico A')).toBeInTheDocument()
    expect(within(fila).queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('los checks de "Técnicos de glass" están deshabilitados y solo hay botón de cerrar', async () => {
    abrir(SESION_ADMIN)
    await screen.findByText('A20260916_1')
    await userEvent.click(screen.getByRole('button', { name: 'Técnicos de glass' }))
    expect(await screen.findByRole('checkbox', { name: 'Técnico A' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Técnico B' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument()
  })

  it('los filtros y la ventana de carga siguen funcionando', async () => {
    abrir(SESION_ADMIN)
    await screen.findByText('A20260916_1')
    expect(screen.getByText('2 asignaciones')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox', { name: 'Filtrar por IMEI' }), '000000000000001')
    expect(await screen.findByText('1 asignación')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(await screen.findByText('2 asignaciones')).toBeInTheDocument()

    // La ventana de carga no escribe nada, así que el ADMIN la abre igual que el supertécnico. El ADMIN no tiene
    // técnico en sesión (idTec null) y la lista no lo usa para nada: sale la de todos los técnicos activos.
    await userEvent.click(screen.getByRole('button', { name: 'Carga técnicos' }))
    const ventana = await screen.findByRole('dialog')
    expect(await within(ventana).findByRole('list', { name: 'Carga por técnico' })).toBeInTheDocument()
    expect(within(ventana).getByText('Técnico A')).toBeInTheDocument()
  })
})

/**
 * El control del cableado: sin esto un `soloLectura` fijo a `true` dejaría los seis de arriba en verde y le
 * quitaría al supertécnico media vista.
 */
describe('AsignacionesPage · el SUPERTECNICO conserva todos los controles', () => {
  it('ve el botón "Asignar", la papelera, el menú completo, el desplegable de técnico y los checks de glass activos', async () => {
    abrir(SESION_SUPER)
    await screen.findByText('A20260916_1')
    expect(screen.getByRole('button', { name: 'Asignar' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(11)
    expect(within(filaDe('A20260916_1')).getByRole('button', { name: 'Borrar asignación' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Técnico de A20260916_1' })).toBeInTheDocument()
    expect(await abrirMenuContextual()).toEqual(
      [TEXTO_COPIAR_CELDA, 'Editar comentario', 'Editar cliente', 'Marcar urgente', 'Marcar chasis'],
    )
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menuitem')).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Técnicos de glass' }))
    expect(await screen.findByRole('checkbox', { name: 'Técnico A' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeInTheDocument()
  })
})
