import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Proveedor, TipoPiezasProveedor } from '@/shared/api/client'
import { crearQueryClient } from '@/shared/api/queryClient'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { PiezasProveedorDialog } from './PiezasProveedorDialog'

const ACME: Proveedor = { idProv: 1, nombre: 'ACME', activo: true, divisa: 'EUR', comentario: '', tipo: 'COMPONENTES' }

const TIPOS: TipoPiezasProveedor[] = [
  { prefijo: 'bat', vende: true, modelos: ['12', '13', '14'], excluidos: [] },
  { prefijo: 'g', vende: true, modelos: ['12', '12mini', '13', '13mini'], excluidos: ['12mini', '13mini'] },
  { prefijo: 'lcd', vende: false, modelos: ['13', '14'], excluidos: [] },
]

let cuerpos: unknown[]
beforeEach(() => {
  cuerpos = []
  server.use(
    http.get('*/api/proveedores/:id/piezas', () => HttpResponse.json(TIPOS)),
    http.put('*/api/proveedores/:id/piezas', async ({ request }) => {
      cuerpos.push(await request.json())
      return new HttpResponse(null, { status: 204 })
    }),
  )
})

const abrir = (onCerrar = vi.fn()) => {
  renderConProviders(<PiezasProveedorDialog proveedor={ACME} onCerrar={onCerrar} />, { sesion: SESION_SUPER })
  return onCerrar
}

async function dialogo() {
  const dlg = await screen.findByRole('dialog', { name: 'Piezas que vende · ACME' })
  await within(dlg).findByRole('checkbox', { name: 'Vende Batería' })
  return dlg
}

describe('PiezasProveedorDialog por tipos (spec 2026-10-12 §5.1)', () => {
  it('un renglón por tipo con su casilla, el desplegable y lo que falta', async () => {
    abrir()
    const dlg = await dialogo()
    expect(dlg).toHaveTextContent('Marca los tipos de pieza que vende.')
    expect(dlg).toHaveTextContent('Vende 2 de 3 tipos')
    expect(within(dlg).getByRole('checkbox', { name: 'Vende Batería' })).toBeChecked()
    expect(within(dlg).getByRole('checkbox', { name: 'Vende Pantalla' })).not.toBeChecked()
    expect(within(dlg).getByRole('button', { name: 'Modelos de Batería' })).toHaveTextContent('Todos los modelos')
    expect(within(dlg).getByRole('button', { name: 'Modelos de Glass' })).toHaveTextContent('Seleccionados 2 de 4')
    const pantalla = within(dlg).getByRole('button', { name: 'Modelos de Pantalla' })
    expect(pantalla).toHaveTextContent('No lo vende')
    expect(pantalla).toBeDisabled()
    expect(dlg).toHaveTextContent('Sin iPhone 12 Mini · iPhone 13 Mini')
  })

  it('marcar un tipo, quitar un modelo, volver a «Todos los modelos» y guardar', async () => {
    const onCerrar = abrir()
    const dlg = await dialogo()
    await userEvent.click(within(dlg).getByRole('checkbox', { name: 'Vende Pantalla' }))
    const pantalla = within(dlg).getByRole('button', { name: 'Modelos de Pantalla' })
    expect(pantalla).toHaveTextContent('Todos los modelos')
    await userEvent.click(pantalla)
    expect(screen.getByRole('checkbox', { name: 'iPhone 13' })).toBeChecked()
    await userEvent.click(screen.getByRole('checkbox', { name: 'iPhone 13' }))
    expect(pantalla).toHaveTextContent('Seleccionados 1 de 2')
    expect(dlg).toHaveTextContent('Sin iPhone 13')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Todos los modelos' }))
    expect(pantalla).toHaveTextContent('Todos los modelos')
    await userEvent.keyboard('{Escape}')
    await userEvent.click(within(dlg).getByRole('checkbox', { name: 'Vende Batería' }))
    await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(cuerpos[0]).toEqual({ tipos: [{ prefijo: 'g', excluidos: ['12mini', '13mini'] }, { prefijo: 'lcd', excluidos: [] }] })
  })

  it('desmarcar todos los modelos desmarca el tipo', async () => {
    abrir()
    const dlg = await dialogo()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Modelos de Glass' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'iPhone 12' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'iPhone 13' }))
    await waitFor(() => expect(within(dlg).getByRole('checkbox', { name: 'Vende Glass' })).not.toBeChecked())
    expect(dlg).toHaveTextContent('Vende 1 de 3 tipos')
  })

  it('un 422 sale dentro y el diálogo sigue abierto', async () => {
    server.use(http.put('*/api/proveedores/:id/piezas', () => HttpResponse.json({ message: 'Algún modelo no existe.' }, { status: 422 })))
    const onCerrar = abrir()
    const dlg = await dialogo()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }))
    expect(await within(dlg).findByRole('alert')).toHaveTextContent('Algún modelo no existe.')
    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('con la caché vieja espera a los datos frescos', async () => {
    const qc = crearQueryClient({ retry: false })
    qc.setQueryData(['proveedores', 1, 'piezas'], TIPOS.map((t) => ({ ...t, vende: false, excluidos: [] })))
    renderConProviders(<PiezasProveedorDialog proveedor={ACME} onCerrar={vi.fn()} />, { sesion: SESION_SUPER, queryClient: qc })
    const dlg = await screen.findByRole('dialog', { name: 'Piezas que vende · ACME' })
    await waitFor(() => expect(within(dlg).getByRole('checkbox', { name: 'Vende Batería' })).toBeChecked())
    expect(dlg).toHaveTextContent('Vende 2 de 3 tipos')
  })

  it('mientras carga avisa, y si no carga lo dice y Guardar queda deshabilitado', async () => {
    server.use(http.get('*/api/proveedores/:id/piezas', () => HttpResponse.json({ message: 'boom' }, { status: 500 })))
    abrir()
    const dlg = await screen.findByRole('dialog', { name: 'Piezas que vende · ACME' })
    expect(await within(dlg).findByText('No se ha podido cargar la lista de piezas.')).toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: 'Guardar', hidden: true })).toBeDisabled()
  })
})
