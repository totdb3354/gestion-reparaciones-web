import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { resumen, tecnico } from '../test/fabrica'
import { AsignacionesPage } from './AsignacionesPage'

// Una normal y una incidencia (calco de PendientesSuperTecnicoController:596-600): el texto del diálogo cambia
// según `esIncidencia`, así que hace falta una fila de cada para cubrir las dos ramas.
const NORMAL = resumen({ idRep: 'A20260916_1', imei: '000000000000001', cliente: null })
const INCIDENCIA = resumen({ idRep: 'A20260916_2', imei: '000000000000002', cliente: null, esIncidencia: true })

beforeEach(() => {
  server.use(
    http.get('*/api/reparaciones/asignaciones', () => HttpResponse.json([NORMAL, INCIDENCIA])),
    http.get('*/api/glass/asignaciones', () => HttpResponse.json([])),
    http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([])),
    http.get('*/api/tecnicos/activos', () => HttpResponse.json([tecnico({ idTec: 4, nombre: 'Técnico A' })])),
    http.get('*/api/clientes/activos', () => HttpResponse.json([])),
  )
})

/** Las dos filas comparten aria-label en su papelera ("Borrar asignación", el `etiqueta` por defecto de
 *  BotonPapelera): hay que acotar la búsqueda a la fila del `idRep` pedido. */
async function abrirConfirmacion(idRep: string) {
  renderConProviders(<AsignacionesPage />, { sesion: SESION_SUPER, ruta: '/reparaciones/asignaciones' })
  await screen.findByText(idRep)
  const fila = screen.getAllByRole('row').find((f) => within(f).queryByText(idRep))!
  await userEvent.click(within(fila).getByRole('button', { name: 'Borrar asignación' }))
}

/** Los DELETE de las tres ramas (hoja de contrato §3), para comprobar que Cancelar no dispara ninguno y que
 *  "Borrar asignación" sí. La rama en sí ya la cubre api.test.tsx; aquí solo interesa si la petición SALIÓ. */
function espiarBorrados(): string[] {
  const rutas: string[] = []
  server.use(
    http.delete('*/api/reparaciones/asignaciones/:idAsig', ({ params }) => {
      rutas.push(`/api/reparaciones/asignaciones/${params.idAsig}`)
      return new HttpResponse(null, { status: 204 })
    }),
    http.delete('*/api/reparaciones/imei/:imei/incidencia-activa', ({ params }) => {
      rutas.push(`/api/reparaciones/imei/${params.imei}/incidencia-activa`)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return rutas
}

describe('borrado de asignaciones: la papelera y su confirmación', () => {
  it('la papelera abre la confirmación con el identificador en el título', async () => {
    await abrirConfirmacion('A20260916_1')
    expect(await screen.findByRole('dialog', { name: 'Borrar asignación A20260916_1' })).toBeInTheDocument()
  })

  it('el texto dice que el técnico dejará de verla', async () => {
    await abrirConfirmacion('A20260916_1')
    const dlg = await screen.findByRole('dialog', { name: 'Borrar asignación A20260916_1' })
    expect(within(dlg).getByText('El técnico dejará de verla en su lista de pendientes.')).toBeInTheDocument()
  })

  it('si la fila es una incidencia, el texto añade que la incidencia se marcará como no activa', async () => {
    await abrirConfirmacion('A20260916_2')
    const dlg = await screen.findByRole('dialog', { name: 'Borrar asignación A20260916_2' })
    expect(
      within(dlg).getByText('El técnico dejará de verla en su lista de pendientes y la incidencia se marcará como no activa en la tabla principal.'),
    ).toBeInTheDocument()
  })

  it('no hay campo de motivo', async () => {
    await abrirConfirmacion('A20260916_1')
    await screen.findByRole('dialog', { name: 'Borrar asignación A20260916_1' })
    // Sin conMotivo: ni el textarea del ConfirmDialog ni su placeholder existen en el DOM.
    expect(screen.queryByPlaceholderText('Escribe el motivo del borrado...')).not.toBeInTheDocument()
  })

  it('Cancelar no borra; Borrar asignación llama a la mutación', async () => {
    const rutas = espiarBorrados()
    await abrirConfirmacion('A20260916_1')
    const dlg = await screen.findByRole('dialog', { name: 'Borrar asignación A20260916_1' })
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog', { name: 'Borrar asignación A20260916_1' })).not.toBeInTheDocument()
    expect(rutas).toHaveLength(0)

    await abrirConfirmacion('A20260916_1')
    const dlgReabierto = await screen.findByRole('dialog', { name: 'Borrar asignación A20260916_1' })
    // El botón rojo del diálogo, no la papelera de la fila: las dos comparten el mismo texto "Borrar asignación".
    await userEvent.click(within(dlgReabierto).getByRole('button', { name: 'Borrar asignación' }))
    expect(rutas).toEqual(['/api/reparaciones/asignaciones/A20260916_1'])
  })
})
