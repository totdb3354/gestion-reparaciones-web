import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompraOtro } from '@/shared/api/client'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { lineaDePrueba as l } from '../bloques/datosPrueba'
import { OTRO, PROVEEDORES } from './datosPrueba'
import { EditarOtroPedidoDialog } from './EditarOtroPedidoDialog'

let puts: { id: string; cuerpo: unknown }[]
let respuestaPut: () => Response

beforeEach(() => {
  puts = []
  respuestaPut = () => new HttpResponse(null, { status: 200 })
  server.use(
    http.get('*/api/proveedores', () => HttpResponse.json(PROVEEDORES)),
    http.get('*/api/tipo-cambio/:divisa', () => HttpResponse.json({ value: 1.1367 })),
    // Bloque 60 de «Proveedor B» (proveedor 2), abierto; OTRO (O-9, ACME) está en el bloque 1.
    http.get('*/api/compras', () => HttpResponse.json([l({ idCompra: 20, idProv: 2, nombreProveedor: 'Proveedor B', idBloque: 60 })])),
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

async function elegirProveedor(nombre: string) {
  await userEvent.click(await screen.findByRole('combobox', { name: 'Proveedor' }))
  await userEvent.click(await within(screen.getByRole('listbox', { name: 'Proveedor' })).findByRole('button', { name: nombre }))
}

async function guardarYEsperar(onCerrar: ReturnType<typeof vi.fn>) {
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
}

describe('EditarOtroPedidoDialog', () => {
  it('precarga: título «Editar pedido #O-{id}» (0.9.15), "Concepto:" editable con su placeholder y sin "Urgente:"', async () => {
    abrir()
    const dlg = within(await screen.findByRole('dialog', { name: 'Editar pedido #O-9' }))
    expect(dlg.getAllByText(/:$/).map((e) => e.textContent)).toEqual(['Concepto:', 'Proveedor:', 'Cantidad:', 'Precio unidad:', 'Total EUR:'])
    expect(dlg.getByLabelText('Concepto:')).toHaveValue('Cinta de embalar')
    expect(dlg.getByLabelText('Concepto:')).toHaveAttribute('placeholder', 'Descripción del pedido')
    expect(dlg.getByLabelText('Cantidad:')).toHaveValue('4')
    expect(dlg.getByLabelText('Precio unidad:')).toHaveValue('2,00')
    expect(dlg.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(dlg.queryByRole('combobox', { name: 'Bloque' })).not.toBeInTheDocument()
    expect(screen.getByTestId('total-eur').textContent).toBe('8,00 €')
  })

  it('el concepto vacío va antes que el proveedor', async () => {
    abrir({ ...OTRO, idProv: 3 })
    await screen.findByRole('dialog', { name: 'Editar pedido #O-9' })
    await escribir('Concepto:', '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('El concepto no puede estar vacío.')
    await escribir('Concepto:', 'Cinta ancha')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Selecciona un proveedor.')
    expect(puts).toHaveLength(0)
  })

  it('Guardar: PUT /api/compras-otros/{id} con el concepto recortado, el urgente del pedido y sin destino; cierra', async () => {
    const onCerrar = abrir()
    await screen.findByText('ACME')
    await escribir('Concepto:', '  Cinta ancha  ')
    await guardarYEsperar(onCerrar)
    expect(puts).toEqual([{
      id: '9',
      cuerpo: expect.objectContaining({ idProv: 1, concepto: 'Cinta ancha', cantidad: 4, esUrgente: true, precioUnidad: 2, divisa: 'EUR', updatedAt: '2026-09-20T10:00:00', destino: null }),
    }])
  })

  it('409: el aviso de modificado inline, formulario abierto', async () => {
    respuestaPut = () => HttpResponse.json({ message: 'El pedido no se puede editar en su estado actual' }, { status: 409 })
    const onCerrar = abrir()
    await screen.findByText('ACME')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El pedido fue modificado por otro usuario. Cierra y recarga los datos.')
    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('cambiar el proveedor de un otro pendiente: «Bloque» con el abierto del proveedor nuevo, el aviso y el destino en el PUT (0.9.15)', async () => {
    const onCerrar = abrir()
    await screen.findByRole('dialog', { name: 'Editar pedido #O-9' })
    await elegirProveedor('Proveedor B')
    expect(await screen.findByRole('combobox', { name: 'Bloque' })).toHaveTextContent('Bloque 60')
    expect(screen.getByText(/la línea sale del Bloque 1 y pasa a un bloque de Proveedor B/)).toHaveTextContent('Ojo: Proveedor B trabaja en USD; revisa el precio.')
    await guardarYEsperar(onCerrar)
    expect(puts[0].cuerpo).toMatchObject({ idProv: 2, concepto: 'Cinta de embalar', destino: { idBloque: 60 } })
  })

  it('un otro ya pedido sugiere «Bloque nuevo» y pide «Mover línea ya pedida» antes de guardar (0.9.15)', async () => {
    const onCerrar = abrir({ ...OTRO, estado: 'en_camino' })
    await screen.findByRole('dialog', { name: 'Editar pedido #O-9' })
    await elegirProveedor('Proveedor B')
    expect(await screen.findByRole('combobox', { name: 'Bloque' })).toHaveTextContent('Bloque nuevo')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const confirmacion = await screen.findByRole('dialog', { name: 'Mover línea ya pedida' })
    expect(confirmacion).toHaveTextContent('La línea Cinta de embalar (ID O-9) está en camino. ¿Moverla a un bloque nuevo igualmente?')
    expect(puts).toHaveLength(0)
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Guardar y mover' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    expect(puts[0].cuerpo).toMatchObject({ idProv: 2, destino: { idBloque: null } })
  })
})
