import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompraComponente } from '@/shared/api/client'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { lineaDePrueba as l } from '../bloques/datosPrueba'
import { COMPRA, PROVEEDORES } from './datosPrueba'
import { EditarPedidoDialog } from './EditarPedidoDialog'

let puts: unknown[]

beforeEach(() => {
  puts = []
  server.use(
    http.get('*/api/proveedores', () => HttpResponse.json(PROVEEDORES)),
    http.get('*/api/tipo-cambio/:divisa', () => HttpResponse.json({ value: 1.1367 })),
    // Bloque 60 de «Proveedor B» (proveedor 2), abierto; COMPRA (#7, ACME) está en el bloque 1.
    http.get('*/api/compras', () => HttpResponse.json([COMPRA, l({ idCompra: 20, idProv: 2, nombreProveedor: 'Proveedor B', idBloque: 60 })])),
    http.put('*/api/compras/:id', async ({ request }) => { puts.push(await request.json()); return new HttpResponse(null, { status: 200 }) }),
  )
})

function abrir(pedido: CompraComponente) {
  const onCerrar = vi.fn()
  renderConProviders(<EditarPedidoDialog pedido={pedido} onCerrar={onCerrar} />, { sesion: SESION_SUPER })
  return onCerrar
}

async function elegirProveedor(nombre: string) {
  await userEvent.click(await screen.findByRole('combobox', { name: 'Proveedor' }))
  await userEvent.click(await within(screen.getByRole('listbox', { name: 'Proveedor' })).findByRole('button', { name: nombre }))
}

describe('«Editar pedido» cambiando el proveedor (0.9.9, spec §6.6)', () => {
  it('sin cambiar el proveedor no hay campo Bloque', async () => {
    abrir(COMPRA)
    await screen.findByRole('dialog', { name: 'Editar pedido #7' })
    expect(screen.queryByRole('combobox', { name: 'Bloque' })).not.toBeInTheDocument()
  })

  it('una pendiente sugiere el bloque abierto del proveedor nuevo y lo manda', async () => {
    const onCerrar = abrir(COMPRA)
    await screen.findByRole('dialog', { name: 'Editar pedido #7' })
    await elegirProveedor('Proveedor B')
    expect(await screen.findByRole('combobox', { name: 'Bloque' })).toHaveTextContent('Bloque 60')
    expect(screen.getByText(/la línea sale del Bloque 1 y pasa a un bloque de Proveedor B/)).toHaveTextContent('Ojo: Proveedor B trabaja en USD; revisa el precio.')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(puts[0]).toMatchObject({ idProv: 2, destino: { idBloque: 60 } })
  })

  it('una ya pedida sugiere «Bloque nuevo» y pide confirmación; «Cancelar» vuelve al editor', async () => {
    const onCerrar = abrir({ ...COMPRA, estado: 'en_camino' })
    await screen.findByRole('dialog', { name: 'Editar pedido #7' })
    await elegirProveedor('Proveedor B')
    expect(await screen.findByRole('combobox', { name: 'Bloque' })).toHaveTextContent('Bloque nuevo')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const confirmacion = await screen.findByRole('dialog', { name: 'Mover línea ya pedida' })
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Cancelar' }))
    expect(puts).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Mover línea ya pedida' })).getByRole('button', { name: 'Guardar y mover' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(puts[0]).toMatchObject({ idProv: 2, destino: { idBloque: null } })
  })

  it('409 de un bloque destino que ya no existe: enseña el texto del servidor y vuelve a sugerir con los datos recargados', async () => {
    let borrado = false
    server.use(
      http.get('*/api/compras', () => HttpResponse.json(borrado ? [COMPRA] : [COMPRA, l({ idCompra: 20, idProv: 2, nombreProveedor: 'Proveedor B', idBloque: 60 })])),
      http.put('*/api/compras/:id', () => {
        borrado = true
        return HttpResponse.json({ message: 'El bloque 60 ya no existe; elige otro destino.' }, { status: 409 })
      }),
    )
    const onCerrar = abrir(COMPRA)
    await screen.findByRole('dialog', { name: 'Editar pedido #7' })
    await elegirProveedor('Proveedor B')
    expect(await screen.findByRole('combobox', { name: 'Bloque' })).toHaveTextContent('Bloque 60')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El bloque 60 ya no existe; elige otro destino.')
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Bloque' })).toHaveTextContent('Bloque nuevo'))
    expect(onCerrar).not.toHaveBeenCalled()
  })


  it('el campo Bloque solo ofrece los bloques vivos del proveedor nuevo y «Bloque nuevo»', async () => {
    // Bloque 60 de «Proveedor B» abierto y bloque 59 terminado (todo recibido): el 59 no se ofrece.
    server.use(http.get('*/api/compras', () => HttpResponse.json([
      COMPRA,
      l({ idCompra: 20, idProv: 2, nombreProveedor: 'Proveedor B', idBloque: 60 }),
      l({ idCompra: 21, idProv: 2, nombreProveedor: 'Proveedor B', idBloque: 59, estado: 'recibido' }),
    ])))
    abrir(COMPRA)
    await screen.findByRole('dialog', { name: 'Editar pedido #7' })
    await elegirProveedor('Proveedor B')
    await userEvent.click(await screen.findByRole('combobox', { name: 'Bloque' }))
    const opciones = within(screen.getByRole('listbox', { name: 'Bloque' })).getAllByRole('button').map((b) => b.textContent ?? '')
    expect(opciones).toHaveLength(2)
    expect(opciones[0]).toMatch(/^Bloque 60 /)
    expect(opciones[1]).toBe('Bloque nuevo')
  })
})
