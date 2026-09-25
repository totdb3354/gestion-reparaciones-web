import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompraOtro } from '@/shared/api/client'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { OTRO, PROVEEDORES } from './datosPrueba'
import { EditarOtroPedidoDialog } from './EditarOtroPedidoDialog'

let puts: { id: string; cuerpo: unknown }[]
let respuestaPut: () => Response

beforeEach(() => {
  puts = []
  respuestaPut = () => new HttpResponse(null, { status: 200 })
  server.use(
    http.get('*/api/proveedores', () => HttpResponse.json(PROVEEDORES)),
    http.put('*/api/compras-otros/:id', async ({ request, params }) => {
      puts.push({ id: String(params.id), cuerpo: await request.json() })
      return respuestaPut()
    }),
  )
})

function abrir(pedido: CompraOtro | null = OTRO) {
  const onCerrar = vi.fn()
  renderConProviders(<EditarOtroPedidoDialog pedido={pedido} onCerrar={onCerrar} />, { sesion: SESION_SUPER })
  return onCerrar
}

async function escribir(etiqueta: string, valor: string) {
  const campo = screen.getByLabelText(etiqueta)
  await userEvent.clear(campo)
  if (valor !== '') await userEvent.type(campo, valor)
}

describe('EditarOtroPedidoDialog', () => {
  it('precarga: mismo título "Editar pedido #{id}", "Concepto:" editable con su placeholder y sin "Urgente:"', async () => {
    abrir()
    const dlg = within(await screen.findByRole('dialog', { name: 'Editar pedido #9' }))
    expect(dlg.getAllByText(/:$/).map((e) => e.textContent)).toEqual(['Concepto:', 'Proveedor:', 'Cantidad:', 'Precio unidad:', 'Total EUR:'])
    expect(dlg.getByLabelText('Concepto:')).toHaveValue('Cinta de embalar')
    expect(dlg.getByLabelText('Concepto:')).toHaveAttribute('placeholder', 'Descripción del pedido')
    expect(dlg.getByLabelText('Cantidad:')).toHaveValue('4')
    expect(dlg.getByLabelText('Precio unidad:')).toHaveValue('2,00')
    expect(dlg.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByTestId('total-eur').textContent).toBe('8,00 €')
  })

  it('el concepto vacío va antes que el proveedor', async () => {
    abrir({ ...OTRO, idProv: 3 })
    await screen.findByRole('dialog', { name: 'Editar pedido #9' })
    await escribir('Concepto:', '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('El concepto no puede estar vacío.')
    await escribir('Concepto:', 'Cinta ancha')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Selecciona un proveedor.')
    expect(puts).toHaveLength(0)
  })

  it('Guardar: PUT /api/compras-otros/{id} con el concepto recortado y el urgente del pedido conservado; cierra', async () => {
    const onCerrar = abrir()
    await screen.findByText('ACME')
    await escribir('Concepto:', '  Cinta ancha  ')
    await guardarYEsperar(onCerrar)
    expect(puts).toEqual([{ id: '9', cuerpo: expect.objectContaining({ idProv: 1, concepto: 'Cinta ancha', cantidad: 4, esUrgente: true, precioUnidad: 2, divisa: 'EUR', updatedAt: '2026-09-20T10:00:00' }) }])
  })

  it('409: el aviso de modificado inline, formulario abierto', async () => {
    respuestaPut = () => HttpResponse.json({ message: 'El pedido no se puede editar en su estado actual' }, { status: 409 })
    const onCerrar = abrir()
    await screen.findByText('ACME')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El pedido fue modificado por otro usuario. Cierra y recarga los datos.')
    expect(onCerrar).not.toHaveBeenCalled()
  })
})

async function guardarYEsperar(onCerrar: ReturnType<typeof vi.fn>) {
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
}
