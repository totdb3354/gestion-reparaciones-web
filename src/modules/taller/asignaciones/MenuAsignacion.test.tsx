import { fireEvent, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import type { ReparacionResumen } from '@/shared/api/client'
import { server } from '@/test/server'
import { renderConProviders, SESION_ADMIN, SESION_SUPER } from '@/test/render'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/shared/ui/context-menu'
import type { CeldaPulsada } from '@/shared/ui/DataTable'
import { TEXTO_COPIAR_CELDA } from '@/shared/ui/MenuCopiarCelda'
import { resumen } from '../test/fabrica'
import { MenuAsignacion } from './MenuAsignacion'
import { useAccionConDeshacer } from './useAccionConDeshacer'

const CELDA: CeldaPulsada = { columnaId: 'id', resaltar: () => {} }

const reparacion = resumen({ idRep: 'A20260916_1', imei: '000000000000001' })
const glass = resumen({ idRep: 'AG20260916_2', imei: '000000000000002' })
const pulido = resumen({ idRep: 'AP20260916_3', imei: '000000000000003' })

/** Mini-página: la fila con su menú contextual y el aviso del hook, como los monta AsignacionesPage. */
function Banco({ fila, soloLectura = false, onInteraccion = () => {} }: { fila: ReparacionResumen; soloLectura?: boolean; onInteraccion?: (abierto: boolean) => void }) {
  const { ejecutar, aviso } = useAccionConDeshacer()
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>Fila</ContextMenuTrigger>
        <ContextMenuContent>
          <MenuAsignacion
            fila={fila}
            celda={CELDA}
            soloLectura={soloLectura}
            ejecutar={ejecutar}
            onInteraccion={onInteraccion}
            onEditarComentario={() => {}}
            onEditarModelo={() => {}}
            onEditarCliente={() => {}}
          />
        </ContextMenuContent>
      </ContextMenu>
      {aviso}
    </>
  )
}

function abrirMenu(props: Parameters<typeof Banco>[0]) {
  renderConProviders(<Banco {...props} />, { sesion: props.soloLectura ? SESION_ADMIN : SESION_SUPER })
  fireEvent.contextMenu(screen.getByText('Fila'))
  return screen.findAllByRole('menuitem')
}

const textos = async (props: Parameters<typeof Banco>[0]) => (await abrirMenu(props)).map((i) => i.textContent)

describe('MenuAsignacion', () => {
  it('en una reparación salen copiar, los dos editores que le tocan, urgente y chasis', async () => {
    // La spec §10 no da "Editar modelo" a la reparación: es de pulido.
    expect(await textos({ fila: reparacion })).toEqual([TEXTO_COPIAR_CELDA, 'Editar comentario', 'Editar cliente', 'Marcar urgente', 'Marcar chasis'])
  })

  it('en glass no sale chasis', async () => {
    const items = await textos({ fila: glass })
    expect(items).toContain('Marcar urgente')
    expect(items).not.toContain('Marcar chasis')
    expect(items).not.toContain('Quitar chasis')
  })

  it('en pulido sale editar modelo y no salen urgente ni chasis', async () => {
    // El pulido no tiene ni urgente ni chasis en el servidor (hoja de contrato §1).
    expect(await textos({ fila: pulido })).toEqual([TEXTO_COPIAR_CELDA, 'Editar comentario', 'Editar modelo', 'Editar cliente'])
  })

  it('el ADMIN solo ve copiar celda', async () => {
    expect(await textos({ fila: reparacion, soloLectura: true })).toEqual([TEXTO_COPIAR_CELDA])
  })

  it('el texto alterna entre Marcar y Quitar según el estado de la fila', async () => {
    expect(await textos({ fila: resumen({ idRep: 'A20260916_1', urgente: true, esChasis: true }) })).toEqual([
      TEXTO_COPIAR_CELDA, 'Editar comentario', 'Editar cliente', 'Quitar urgente', 'Quitar chasis',
    ])
  })

  it('marcar urgente llama a la mutación y deja el aviso con Deshacer', async () => {
    const cuerpos: unknown[] = []
    server.use(
      http.patch('*/api/reparaciones/asignaciones/:idRep/urgente', async ({ request }) => {
        cuerpos.push(await request.json())
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await abrirMenu({ fila: reparacion })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Marcar urgente' }))
    expect(await screen.findByText('A20260916_1 marcada como urgente')).toBeInTheDocument()
    expect(cuerpos).toEqual([{ urgente: true }])
    // "Deshacer" repite la misma escritura con el valor contrario.
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    await vi.waitFor(() => expect(cuerpos).toEqual([{ urgente: true }, { urgente: false }]))
  })

  it('quitar chasis manda el valor contrario al de la fila', async () => {
    const cuerpos: unknown[] = []
    server.use(
      http.patch('*/api/reparaciones/asignaciones/:idRep/chasis', async ({ request }) => {
        cuerpos.push(await request.json())
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await abrirMenu({ fila: resumen({ idRep: 'A20260916_1', esChasis: true }) })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Quitar chasis' }))
    expect(await screen.findByText('A20260916_1 ya no es chasis')).toBeInTheDocument()
    expect(cuerpos).toEqual([{ esChasis: false }])
  })

  it('avisa de la apertura y del cierre del menú', async () => {
    // D4: con el menú abierto el sondeo se congela, o la tabla se recarga y la fila se mueve bajo el cursor.
    const onInteraccion = vi.fn()
    await abrirMenu({ fila: reparacion, onInteraccion })
    expect(onInteraccion.mock.calls).toEqual([[true]])
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await vi.waitFor(() => expect(onInteraccion.mock.calls).toEqual([[true], [false]]))
  })
})
