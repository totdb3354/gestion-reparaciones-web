import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReparacionResumen } from '@/shared/api/client'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/shared/ui/context-menu'
import type { CeldaPulsada } from '@/shared/ui/DataTable'
import { resumen, tecnico } from '../../test/fabrica'
import { AsignacionesPage } from '../AsignacionesPage'
import { MenuAsignacion } from '../MenuAsignacion'
import { useAccionConDeshacer } from '../useAccionConDeshacer'
import { useEditores } from './useEditores'

const CELDA: CeldaPulsada = { columnaId: 'id', resaltar: () => {} }

const reparacion = resumen({ idRep: 'A20260916_1', imei: '000000000000001', comentarioAsignacion: 'revisar la tapa', cliente: null })
const pulido = resumen({ idRep: 'AP20260916_3', imei: '000000000000003', modelo: '14', cliente: 'CLIENTE A' })

const CLIENTES = [
  { idCli: 1, nombre: 'CLIENTE A', activo: true, updatedAt: '2026-09-01T00:00:00' },
  { idCli: 2, nombre: 'CLIENTE B', activo: true, updatedAt: '2026-09-01T00:00:00' },
]

beforeEach(() => {
  server.use(http.get('*/api/clientes/activos', () => HttpResponse.json(CLIENTES)))
})

/** Mini-página: el menú contextual de una fila con los tres editores colgados de él, como los monta AsignacionesPage. */
function Banco({ fila, onInteraccion = () => {} }: { fila: ReparacionResumen; onInteraccion?: (abierto: boolean) => void }) {
  const { ejecutar } = useAccionConDeshacer()
  const { editarComentario, editarModelo, editarCliente, dialogos } = useEditores({ onInteraccion })
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>Fila</ContextMenuTrigger>
        <ContextMenuContent>
          <MenuAsignacion
            fila={fila}
            celda={CELDA}
            soloLectura={false}
            ejecutar={ejecutar}
            onInteraccion={() => {}}
            onEditarComentario={editarComentario}
            onEditarModelo={editarModelo}
            onEditarCliente={editarCliente}
          />
        </ContextMenuContent>
      </ContextMenu>
      {dialogos}
    </>
  )
}

/** Abre el menú de la fila y elige uno de los "Editar…": el camino real, no un `setState` a mano. */
async function abrirEditor(item: string, props: Parameters<typeof Banco>[0]) {
  renderConProviders(<Banco {...props} />, { sesion: SESION_SUPER })
  fireEvent.contextMenu(screen.getByText('Fila'))
  await userEvent.click(await screen.findByRole('menuitem', { name: item }))
}

describe('editores de la vista de asignaciones', () => {
  it('el editor de comentario precarga el texto actual y guarda', async () => {
    let body: unknown = null
    server.use(http.patch('*/api/reparaciones/asignaciones/A20260916_1', async ({ request }) => {
      body = await request.json()
      return new HttpResponse(null, { status: 204 })
    }))
    await abrirEditor('Editar comentario', { fila: reparacion })
    const dlg = await screen.findByRole('dialog', { name: 'Comentario de asignación' })
    const area = within(dlg).getByLabelText('Comentario — A20260916_1')
    expect(area).toHaveValue('revisar la tapa')
    await userEvent.clear(area)
    await userEvent.type(area, 'cambiar la pantalla')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
    // Mismo endpoint que reasignar: el técnico actual viaja sin tocarse, y el updatedAt es el bloqueo optimista.
    await waitFor(() => expect(body).toEqual({ idTec: 4, comentarioAsignacion: 'cambiar la pantalla', updatedAt: '2026-09-16T07:02:00' }))
  })

  it('Cancelar no guarda', async () => {
    let llamadas = 0
    server.use(http.patch('*/api/reparaciones/asignaciones/A20260916_1', () => {
      llamadas += 1
      return new HttpResponse(null, { status: 204 })
    }))
    await abrirEditor('Editar comentario', { fila: reparacion })
    const dlg = await screen.findByRole('dialog', { name: 'Comentario de asignación' })
    await userEvent.type(within(dlg).getByLabelText('Comentario — A20260916_1'), ' y la cámara')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Comentario de asignación' })).not.toBeInTheDocument())
    expect(llamadas).toBe(0)
  })

  it('el editor de modelo filtra la lista al escribir', async () => {
    await abrirEditor('Editar modelo', { fila: pulido })
    const dlg = await screen.findByRole('dialog', { name: 'Editar modelo' })
    await userEvent.type(within(dlg).getByRole('textbox', { name: 'Filtrar modelo...' }), 'pro max')
    const visibles = within(dlg).getAllByRole('option').map((o) => o.textContent)
    expect(visibles.length).toBeGreaterThan(0)
    // Filtra por el nombre traducido, no por el código interno (calco de abrirSelectorModelo).
    expect(visibles.every((m) => m?.endsWith('Pro Max'))).toBe(true)
    expect(visibles).not.toContain('iPhone 14')
  })

  it('el editor de modelo llega con el modelo actual preseleccionado', async () => {
    let body: unknown = null
    server.use(http.post('*/api/telefonos', async ({ request }) => {
      body = await request.json()
      return new HttpResponse(null, { status: 204 })
    }))
    await abrirEditor('Editar modelo', { fila: pulido })
    const dlg = await screen.findByRole('dialog', { name: 'Editar modelo' })
    expect(within(dlg).getByRole('option', { name: 'iPhone 14' })).toHaveAttribute('aria-selected', 'true')
    const guardar = within(dlg).getByRole('button', { name: 'Guardar' })
    expect(guardar).toBeEnabled()
    await userEvent.click(guardar)
    // Se manda el código interno, no el nombre traducido (hoja de contrato §4).
    await waitFor(() => expect(body).toEqual({ imei: '000000000000003', modelo: '14', idCli: null, clienteExplicito: null }))
  })

  it('el editor de cliente ofrece la opción de dejarlo sin cliente', async () => {
    let body: unknown = null
    server.use(http.patch('*/api/telefonos/000000000000003/cliente', async ({ request }) => {
      body = await request.json()
      return new HttpResponse(null, { status: 204 })
    }))
    // telefonoUpdatedAt distinto de updatedAt a propósito: si la implementación mandara el de la asignación
    // (el trampolín que señala la hoja de contrato §5), este valor lo delataría.
    const pulido = resumen({ idRep: 'AP20260916_3', imei: '000000000000003', modelo: '14', cliente: 'CLIENTE A', telefonoUpdatedAt: '2026-09-16T09:30:00' })
    await abrirEditor('Editar cliente', { fila: pulido })
    const dlg = await screen.findByRole('dialog', { name: 'Seleccionar cliente' })
    expect(within(dlg).getAllByRole('option').map((o) => o.textContent)).toEqual(['— Sin cliente —', 'CLIENTE A', 'CLIENTE B'])
    // Sin preselección: el actual solo va resaltado y "Seleccionar" empieza deshabilitado (calco de SelectorClienteDialog).
    expect(within(dlg).getByRole('button', { name: 'Seleccionar' })).toBeDisabled()
    await userEvent.click(within(dlg).getByRole('button', { name: '— Sin cliente —' }))
    await userEvent.click(within(dlg).getByRole('button', { name: 'Seleccionar' }))
    // updatedAt es el del TELÉFONO, no el de la asignación (hoja de contrato §5).
    await waitFor(() => expect(body).toEqual({ idCli: null, updatedAt: '2026-09-16T09:30:00' }))
  })

  it('los tres editores avisan de su apertura y de su cierre', async () => {
    // D4: con un diálogo abierto el sondeo se congela, o la tabla se recarga y la fila se mueve bajo el cursor.
    for (const [item, titulo, fila] of [
      ['Editar comentario', 'Comentario de asignación', pulido],
      ['Editar modelo', 'Editar modelo', pulido],
      ['Editar cliente', 'Seleccionar cliente', pulido],
    ] as const) {
      const onInteraccion = vi.fn()
      const { unmount } = renderConProviders(<Banco fila={fila} onInteraccion={onInteraccion} />, { sesion: SESION_SUPER })
      fireEvent.contextMenu(screen.getByText('Fila'))
      await userEvent.click(await screen.findByRole('menuitem', { name: item }))
      await screen.findByRole('dialog', { name: titulo })
      expect(onInteraccion.mock.calls).toEqual([[true]])
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
      await waitFor(() => expect(onInteraccion.mock.calls).toEqual([[true], [false]]))
      unmount()
    }
  })

  it('guardar en los tres editores también avisa del cierre', async () => {
    // Mismo riesgo que Cancelar (D4/spec §17), pero por el otro camino: guardar hace setState(null) junto a una
    // mutación, y si el aviso se perdiera ahí el sondeo se quedaría congelado para siempre tras cada edición real.
    server.use(
      http.patch('*/api/reparaciones/asignaciones/AP20260916_3', () => new HttpResponse(null, { status: 204 })),
      http.post('*/api/telefonos', () => new HttpResponse(null, { status: 204 })),
      http.patch('*/api/telefonos/000000000000003/cliente', () => new HttpResponse(null, { status: 204 })),
    )
    const casos = [
      ['Editar comentario', 'Comentario de asignación', async (dlg: HTMLElement) => {
        await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
      }],
      ['Editar modelo', 'Editar modelo', async (dlg: HTMLElement) => {
        await userEvent.click(within(dlg).getByRole('button', { name: 'iPhone 15' }))
        await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
      }],
      ['Editar cliente', 'Seleccionar cliente', async (dlg: HTMLElement) => {
        await userEvent.click(within(dlg).getByRole('button', { name: '— Sin cliente —' }))
        await userEvent.click(within(dlg).getByRole('button', { name: 'Seleccionar' }))
      }],
    ] as const
    for (const [item, titulo, guardar] of casos) {
      const onInteraccion = vi.fn()
      const { unmount } = renderConProviders(<Banco fila={pulido} onInteraccion={onInteraccion} />, { sesion: SESION_SUPER })
      fireEvent.contextMenu(screen.getByText('Fila'))
      await userEvent.click(await screen.findByRole('menuitem', { name: item }))
      const dlg = await screen.findByRole('dialog', { name: titulo })
      expect(onInteraccion.mock.calls).toEqual([[true]])
      await guardar(dlg)
      await waitFor(() => expect(onInteraccion.mock.calls).toEqual([[true], [false]]))
      unmount()
    }
  })

  it('Escape en los tres editores también avisa del cierre', async () => {
    // Tercer camino de cierre (D4/spec §17): el Dialog de Radix lo traduce a onOpenChange(false), no a un clic.
    for (const [item, titulo] of [
      ['Editar comentario', 'Comentario de asignación'],
      ['Editar modelo', 'Editar modelo'],
      ['Editar cliente', 'Seleccionar cliente'],
    ] as const) {
      const onInteraccion = vi.fn()
      const { unmount } = renderConProviders(<Banco fila={pulido} onInteraccion={onInteraccion} />, { sesion: SESION_SUPER })
      fireEvent.contextMenu(screen.getByText('Fila'))
      await userEvent.click(await screen.findByRole('menuitem', { name: item }))
      await screen.findByRole('dialog', { name: titulo })
      expect(onInteraccion.mock.calls).toEqual([[true]])
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(onInteraccion.mock.calls).toEqual([[true], [false]]))
      unmount()
    }
  })
})

describe('los editores del teléfono en la página', () => {
  beforeEach(() => {
    server.use(
      http.get('*/api/reparaciones/asignaciones', () => HttpResponse.json([resumen({ idRep: 'A20260916_1', imei: '000000000000003', modelo: '14', cliente: 'CLIENTE A' })])),
      http.get('*/api/glass/asignaciones', () => HttpResponse.json([])),
      http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([pulido])),
      http.get('*/api/tecnicos/activos', () => HttpResponse.json([tecnico({ idTec: 4, nombre: 'Técnico A' })])),
    )
  })

  /** Abre el menú de una fila de la tabla y elige uno de los "Editar…". */
  async function abrirEnLaPagina(idRep: string, item: string) {
    renderConProviders(<AsignacionesPage />, { sesion: SESION_SUPER, ruta: '/reparaciones/asignaciones' })
    await userEvent.pointer({ keys: '[MouseRight]', target: await screen.findByText(idRep) })
    await userEvent.click(await screen.findByRole('menuitem', { name: item }))
  }

  it('editar el modelo recarga la lista, que es lo que pone al día las demás filas del mismo IMEI', async () => {
    // El modelo y el cliente se escriben en el TELÉFONO: las dos filas del IMEI 000000000000003 cambian de golpe,
    // y solo una recarga completa de la lista las deja coherentes (las mutaciones del teléfono no invalidan esta clave).
    let recargas = 0
    server.use(
      http.get('*/api/pulidos/asignaciones', () => {
        recargas += 1
        return HttpResponse.json([pulido])
      }),
      http.post('*/api/telefonos', () => new HttpResponse(null, { status: 204 })),
    )
    await abrirEnLaPagina('AP20260916_3', 'Editar modelo')
    const dlg = await screen.findByRole('dialog', { name: 'Editar modelo' })
    await userEvent.click(within(dlg).getByRole('button', { name: 'iPhone 15' }))
    await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(recargas).toBeGreaterThan(1))
  })

  it('si el teléfono cambió mientras tanto, avisa y recarga', async () => {
    let recargas = 0
    server.use(
      http.get('*/api/pulidos/asignaciones', () => {
        recargas += 1
        return HttpResponse.json([pulido])
      }),
      http.patch('*/api/telefonos/000000000000003/cliente', () => HttpResponse.json({ message: 'stale' }, { status: 409 })),
    )
    await abrirEnLaPagina('AP20260916_3', 'Editar cliente')
    const dlg = await screen.findByRole('dialog', { name: 'Seleccionar cliente' })
    await userEvent.click(within(dlg).getByRole('button', { name: 'CLIENTE B' }))
    await userEvent.click(within(dlg).getByRole('button', { name: 'Seleccionar' }))
    expect(await screen.findByRole('dialog', { name: 'Error' })).toHaveTextContent('El teléfono fue modificado por otro usuario. Se recargan los datos.')
    await waitFor(() => expect(recargas).toBeGreaterThan(1))
  })
})
