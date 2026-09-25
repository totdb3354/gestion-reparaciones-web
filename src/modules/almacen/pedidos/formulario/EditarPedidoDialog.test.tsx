import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompraComponente } from '@/shared/api/client'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { COMPRA, PROVEEDORES } from './datosPrueba'
import { EditarPedidoDialog } from './EditarPedidoDialog'

let puts: { id: string; cuerpo: unknown }[]
let respuestaPut: () => Response

beforeEach(() => {
  puts = []
  respuestaPut = () => new HttpResponse(null, { status: 200 })
  server.use(
    http.get('*/api/proveedores', () => HttpResponse.json(PROVEEDORES)),
    http.get('*/api/tipo-cambio/:divisa', () => HttpResponse.json({ value: 1.1367 })),
    http.put('*/api/compras/:id', async ({ request, params }) => {
      puts.push({ id: String(params.id), cuerpo: await request.json() })
      return respuestaPut()
    }),
  )
})

function abrir(pedido: CompraComponente | null = COMPRA) {
  const onCerrar = vi.fn()
  renderConProviders(<EditarPedidoDialog pedido={pedido} onCerrar={onCerrar} />, { sesion: SESION_SUPER })
  return onCerrar
}

const total = () => screen.getByTestId('total-eur').textContent
const guardar = () => userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

async function escribir(etiqueta: string, valor: string) {
  const campo = screen.getByLabelText(etiqueta)
  await userEvent.clear(campo)
  if (valor !== '') await userEvent.type(campo, valor)
}

async function elegirDivisa(divisa: string) {
  await userEvent.click(screen.getByRole('combobox', { name: 'Divisa' }))
  await userEvent.click(within(screen.getByRole('listbox', { name: 'Divisa' })).getByRole('button', { name: divisa }))
}

describe('EditarPedidoDialog', () => {
  it('pedido null: no pinta nada', () => {
    abrir(null)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('precarga: título, etiquetas en orden, componente de solo lectura, proveedor, cantidad, urgente, precio, divisa y total', async () => {
    abrir()
    const dlg = within(await screen.findByRole('dialog', { name: 'Editar pedido #7' }))
    expect(screen.getByRole('dialog')).toHaveClass('w-[520px]')
    expect(dlg.getByRole('heading', { name: 'Editar pedido #7' })).toHaveClass('text-2xl')
    expect(dlg.getAllByText(/:$/).map((e) => e.textContent)).toEqual(['Componente:', 'Proveedor:', 'Cantidad:', 'Urgente:', 'Precio unidad:', 'Total EUR:'])
    expect(dlg.getByText('bat-x')).toHaveClass('text-[12px]', 'font-bold', 'text-azul-medio')
    expect(await dlg.findByRole('combobox', { name: 'Proveedor' })).toHaveTextContent('ACME')
    expect(dlg.getByLabelText('Cantidad:')).toHaveValue('3')
    expect(dlg.getByLabelText('Cantidad:')).toHaveAttribute('placeholder', 'Ej. 10')
    expect(dlg.getByRole('checkbox', { name: 'Urgente:' })).toBeChecked()
    expect(dlg.getByLabelText('Precio unidad:')).toHaveValue('12,50')
    expect(dlg.getByLabelText('Precio unidad:')).toHaveAttribute('placeholder', '0.00')
    expect(dlg.getByRole('combobox', { name: 'Divisa' })).toHaveTextContent('EUR')
    expect(total()).toBe('37,50 €')
    expect(dlg.getAllByRole('button').map((b) => b.textContent)).toContain('Cancelar')
    expect(dlg.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  })

  it('recibido con recepción parcial: precarga la cantidad PEDIDA, no la recibida (P2)', async () => {
    abrir({ ...COMPRA, estado: 'recibido', cantidadRecibida: 2 })
    expect(await screen.findByLabelText('Cantidad:')).toHaveValue('3')
  })

  it('proveedor inactivo: el combo queda vacío (calco) y Guardar pide "Selecciona un proveedor."', async () => {
    abrir({ ...COMPRA, idProv: 3, nombreProveedor: 'Proveedor A' })
    const combo = await screen.findByRole('combobox', { name: 'Proveedor' })
    await waitFor(() => expect(combo.textContent).toBe(''))
    await guardar()
    expect(screen.getByRole('alert')).toHaveTextContent('Selecciona un proveedor.')
    expect(puts).toHaveLength(0)
  })

  it('validación en orden: cantidad y luego precio', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Editar pedido #7' })
    await escribir('Cantidad:', '0')
    await escribir('Precio unidad:', '-1')
    await guardar()
    expect(screen.getByRole('alert')).toHaveTextContent('Cantidad no válida (debe ser > 0).')
    await escribir('Cantidad:', '3')
    await guardar()
    expect(screen.getByRole('alert')).toHaveTextContent('Precio no válido.')
    expect(puts).toHaveLength(0)
  })

  it('precio que no parsea: Total EUR "—"', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Editar pedido #7' })
    await escribir('Precio unidad:', 'abc')
    expect(total()).toBe('—')
  })

  it('divisa USD: total con la tasa dividida y la etiqueta "(1 USD = 0,8797 €)" (P7)', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Editar pedido #7' })
    await elegirDivisa('USD')
    await waitFor(() => expect(total()).toBe('32,99 €  (1 USD = 0,8797 €)'))
  })

  it('mientras llega la tasa: "Obteniendo tasa…"', async () => {
    server.use(http.get('*/api/tipo-cambio/:divisa', async () => { await delay('infinite'); return HttpResponse.json({ value: 1.1367 }) }))
    abrir()
    await screen.findByRole('dialog', { name: 'Editar pedido #7' })
    await elegirDivisa('USD')
    expect(total()).toBe('Obteniendo tasa…')
  })

  it('si la tasa falla: "Error al obtener tasa"', async () => {
    server.use(http.get('*/api/tipo-cambio/:divisa', () => HttpResponse.json({ message: 'No se pudo obtener el tipo de cambio de USD. Inténtalo de nuevo.' }, { status: 503 })))
    abrir()
    await screen.findByRole('dialog', { name: 'Editar pedido #7' })
    await elegirDivisa('USD')
    await waitFor(() => expect(total()).toBe('Error al obtener tasa'))
  })

  it('Guardar: PUT con proveedor, cantidad, urgente, precio, divisa y updatedAt; cierra', async () => {
    const onCerrar = abrir()
    await screen.findByRole('dialog', { name: 'Editar pedido #7' })
    await screen.findByText('ACME')
    await escribir('Cantidad:', '5')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Urgente:' }))
    await escribir('Precio unidad:', '10,5')
    await guardar()
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    expect(puts).toHaveLength(1)
    expect(puts[0].id).toBe('7')
    expect(puts[0].cuerpo).toMatchObject({ idProv: 1, cantidad: 5, esUrgente: false, precioUnidad: 10.5, divisa: 'EUR', updatedAt: '2026-09-20T10:00:00' })
  })

  it('409: "El pedido fue modificado por otro usuario. Cierra y recarga los datos." inline, formulario abierto', async () => {
    respuestaPut = () => HttpResponse.json({ message: 'Dato modificado por otro usuario' }, { status: 409 })
    const onCerrar = abrir()
    await screen.findByText('ACME')
    await guardar()
    expect(await screen.findByRole('alert')).toHaveTextContent('El pedido fue modificado por otro usuario. Cierra y recarga los datos.')
    expect(screen.getByRole('dialog', { name: 'Editar pedido #7' })).toBeInTheDocument()
    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('422: el mensaje del servidor inline', async () => {
    respuestaPut = () => HttpResponse.json({ message: 'No se puede cambiar la cantidad de un pedido recibido.' }, { status: 422 })
    const onCerrar = abrir({ ...COMPRA, estado: 'recibido', cantidadRecibida: 3 })
    await screen.findByText('ACME')
    await escribir('Cantidad:', '4')
    await guardar()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede cambiar la cantidad de un pedido recibido.')
    expect(onCerrar).not.toHaveBeenCalled()
  })
})
