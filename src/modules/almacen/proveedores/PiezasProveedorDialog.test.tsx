import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Componente, Proveedor } from '@/shared/api/client'
import { crearQueryClient } from '@/shared/api/queryClient'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { COMPONENTES } from '../pedidos/formulario/datosPrueba'
import { CLAVE_COMPONENTES_GESTIONADOS } from '../stock/api'
import { PiezasProveedorDialog } from './PiezasProveedorDialog'

const ACME: Proveedor = { idProv: 1, nombre: 'ACME', activo: true, divisa: 'EUR', comentario: '', tipo: 'COMPONENTES' }

// lcd-x-negro (1) y bat-x / bat-y (2, 5) los vende ACME; mc-x (4) está desactivada y también la vende ACME.
const LISTADO: Componente[] = COMPONENTES.map((c) => ({ ...c, proveedores: c.idCom === 1 || c.idCom === 2 || c.idCom === 4 || c.idCom === 5 ? [1] : [] }))
  .concat([{ ...COMPONENTES[0], idCom: 6, tipo: 'flex-x', proveedores: [] }])

let cuerpos: unknown[]
beforeEach(() => {
  cuerpos = []
  server.use(
    http.get('*/api/componentes/gestionados', () => HttpResponse.json(LISTADO)),
    http.put('*/api/proveedores/:id/componentes', async ({ request }) => {
      cuerpos.push(await request.json())
      return new HttpResponse(null, { status: 204 })
    }),
  )
})

const abrir = (onCerrar = vi.fn()) => {
  renderConProviders(<PiezasProveedorDialog proveedor={ACME} onCerrar={onCerrar} />, { sesion: SESION_SUPER })
  return onCerrar
}

describe('PiezasProveedorDialog (spec 2026-10-11 §5.1)', () => {
  it('lista las activas, una fila por grupo, con las de ACME marcadas', async () => {
    abrir()
    const dlg = await screen.findByRole('dialog', { name: 'Piezas que vende · ACME' })
    expect(await within(dlg).findByRole('checkbox', { name: 'Vende lcd-x-negro' })).toBeChecked()
    expect(within(dlg).getByRole('checkbox', { name: 'Vende bat-x / bat-y' })).toBeChecked()
    expect(within(dlg).getByRole('checkbox', { name: 'Vende flex-x' })).not.toBeChecked()
    expect(within(dlg).queryByRole('checkbox', { name: 'Vende mc-x' })).not.toBeInTheDocument()
    expect(dlg).toHaveTextContent('3 piezas marcadas')
  })

  it('«Marcar las que se ven» y «Quitar las que se ven» actúan sobre lo filtrado; guardar conserva la desactivada', async () => {
    const onCerrar = abrir()
    const dlg = await screen.findByRole('dialog', { name: 'Piezas que vende · ACME' })
    await within(dlg).findByRole('checkbox', { name: 'Vende flex-x' })
    await userEvent.type(within(dlg).getByRole('textbox', { name: 'Buscar pieza' }), 'flex')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Marcar las que se ven' }))
    await userEvent.clear(within(dlg).getByRole('textbox', { name: 'Buscar pieza' }))
    await userEvent.type(within(dlg).getByRole('textbox', { name: 'Buscar pieza' }), 'lcd')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Quitar las que se ven' }))
    await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    const cuerpo = cuerpos[0] as { idsCom: number[] }
    expect([...cuerpo.idsCom].sort((a, b) => a - b)).toEqual([2, 4, 6])
  })

  it('«Solo las marcadas» esconde las demás', async () => {
    abrir()
    const dlg = await screen.findByRole('dialog', { name: 'Piezas que vende · ACME' })
    await within(dlg).findByRole('checkbox', { name: 'Vende flex-x' })
    await userEvent.click(within(dlg).getByRole('checkbox', { name: 'Solo las marcadas' }))
    expect(within(dlg).queryByRole('checkbox', { name: 'Vende flex-x' })).not.toBeInTheDocument()
    expect(within(dlg).getByRole('checkbox', { name: 'Vende lcd-x-negro' })).toBeInTheDocument()
  })

  it('un 422 sale dentro y el diálogo sigue abierto', async () => {
    server.use(http.put('*/api/proveedores/:id/componentes', () => HttpResponse.json({ message: 'Alguna pieza ya no existe.' }, { status: 422 })))
    const onCerrar = abrir()
    const dlg = await screen.findByRole('dialog', { name: 'Piezas que vende · ACME' })
    await within(dlg).findByRole('checkbox', { name: 'Vende flex-x' })
    await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
    expect(await within(dlg).findByRole('alert')).toHaveTextContent('Alguna pieza ya no existe.')
    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('con la caché de Stock ya cargada y vieja, espera a la lista fresca para marcar', async () => {
    const qc = crearQueryClient({ retry: false })
    qc.setQueryData(CLAVE_COMPONENTES_GESTIONADOS, COMPONENTES.map((c) => ({ ...c, proveedores: c.idCom === 1 ? [1] : [] })))
    server.use(http.get('*/api/componentes/gestionados', () => HttpResponse.json(COMPONENTES.map((c) => ({ ...c, proveedores: c.idCom === 2 ? [1] : [] })))))
    renderConProviders(<PiezasProveedorDialog proveedor={ACME} onCerrar={vi.fn()} />, { sesion: SESION_SUPER, queryClient: qc })
    const dlg = await screen.findByRole('dialog', { name: 'Piezas que vende · ACME' })
    const bat = await within(dlg).findByRole('checkbox', { name: 'Vende bat-x / bat-y' })
    await waitFor(() => expect(bat).toBeChecked())
    expect(within(dlg).getByRole('checkbox', { name: 'Vende lcd-x-negro' })).not.toBeChecked()
    expect(dlg).toHaveTextContent('1 pieza marcada')
  })

  it('mientras carga avisa, y si la lista no carga lo dice y Guardar queda deshabilitado', async () => {
    server.use(http.get('*/api/componentes/gestionados', () => HttpResponse.json({ message: 'boom' }, { status: 500 })))
    abrir()
    const dlg = await screen.findByRole('dialog', { name: 'Piezas que vende · ACME' })
    expect(await within(dlg).findByText('No se ha podido cargar la lista de piezas.')).toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: 'Guardar', hidden: true })).toBeDisabled()
  })
})
