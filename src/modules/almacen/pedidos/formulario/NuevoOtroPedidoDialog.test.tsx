import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { PROVEEDORES } from './datosPrueba'
import { NuevoOtroPedidoDialog } from './NuevoOtroPedidoDialog'

let lotes: { cuerpo: unknown; clave: string | null }[]
let respuestaLote: () => Response
let pedidasComponentes: number

beforeEach(() => {
  lotes = []
  pedidasComponentes = 0
  respuestaLote = () => HttpResponse.json({ idsCreados: [201] })
  server.use(
    http.get('*/api/componentes/gestionados', () => { pedidasComponentes += 1; return HttpResponse.json([]) }),
    http.get('*/api/proveedores', () => HttpResponse.json(PROVEEDORES)),
    http.get('*/api/tipo-cambio/:divisa', () => HttpResponse.json({ value: 1.1367 })),
    http.post('*/api/compras-otros/lote', async ({ request }) => {
      lotes.push({ cuerpo: await request.json(), clave: request.headers.get('Idempotency-Key') })
      return respuestaLote()
    }),
  )
})

function abrir() {
  const onCerrar = vi.fn()
  renderConProviders(<NuevoOtroPedidoDialog onCerrar={onCerrar} />, { sesion: SESION_SUPER })
  return onCerrar
}

const filaDe = (n: number) => screen.getByLabelText(`Cantidad línea ${n}`).closest('tr') as HTMLElement
const confirmar = () => userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }))

async function elegirProveedor(n: number, nombre: string) {
  await userEvent.click(screen.getByRole('combobox', { name: `Proveedor línea ${n}` }))
  await userEvent.click(await within(screen.getByRole('listbox', { name: `Proveedor línea ${n}` })).findByRole('button', { name: nombre }))
}

async function escribir(etiqueta: string, valor: string) {
  const campo = screen.getByRole('textbox', { name: etiqueta })
  await userEvent.clear(campo)
  await userEvent.type(campo, valor)
}

describe('NuevoOtroPedidoDialog', () => {
  it('título "Nuevo otro pedido", columna Concepto en vez de Componente, placeholder y sin pedir componentes', async () => {
    abrir()
    const dlg = within(await screen.findByRole('dialog', { name: 'Nuevo otro pedido' }))
    expect(dlg.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Concepto', 'Proveedor', 'Cant.', 'P.Unit.', 'Urg.', 'Total EUR', ''])
    expect(dlg.getByText('Añade al menos una línea')).toBeInTheDocument()
    expect(pedidasComponentes).toBe(0)
  })

  it('"+ Añadir línea": concepto navy vacío con su placeholder, cantidad 1, precio 0,00', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: '+ Añadir línea' }))
    const concepto = screen.getByRole('textbox', { name: 'Concepto línea 1' })
    expect(concepto).toHaveValue('')
    expect(concepto).toHaveAttribute('placeholder', 'Escribe concepto...')
    expect(concepto).toHaveClass('rounded-full', 'bg-azul-noche', 'text-crema')
    expect(screen.getByRole('textbox', { name: 'Cantidad línea 1' })).toHaveValue('1')
    expect(screen.getByRole('textbox', { name: 'Precio línea 1' })).toHaveValue('0,00')
    expect(filaDe(1)).toHaveAttribute('data-state', 'selected')
  })

  it('validación en orden: concepto en blanco → proveedor → cantidad → precio', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: '+ Añadir línea' }))
    await escribir('Concepto línea 1', '   ')
    await confirmar()
    expect(screen.getByRole('alert')).toHaveTextContent('Línea 1: el concepto no puede estar vacío.')
    await escribir('Concepto línea 1', 'Cinta de embalar')
    await confirmar()
    expect(screen.getByRole('alert')).toHaveTextContent('Línea 1: selecciona un proveedor.')
    await elegirProveedor(1, 'ACME')
    await escribir('Cantidad línea 1', 'abc')
    await confirmar()
    expect(screen.getByRole('alert')).toHaveTextContent('Línea 1: la cantidad debe ser mayor que 0.')
    await escribir('Cantidad línea 1', '1')
    await escribir('Precio línea 1', '-2')
    await confirmar()
    expect(screen.getByRole('alert')).toHaveTextContent('Línea 1: el precio no puede ser negativo.')
    expect(lotes).toHaveLength(0)
  })

  it('lote con clave y cuerpo exacto (concepto recortado); USD con $ y total convertido; cierra', async () => {
    const onCerrar = abrir()
    await userEvent.click(await screen.findByRole('button', { name: '+ Añadir línea' }))
    await escribir('Concepto línea 1', '  Cinta de embalar  ')
    await elegirProveedor(1, 'Proveedor B')
    await escribir('Cantidad línea 1', '3')
    await escribir('Precio línea 1', '1,5')
    expect(within(filaDe(1)).getByText('$')).toBeInTheDocument()
    expect(await within(filaDe(1)).findByText('3,96 €')).toBeInTheDocument()
    await confirmar()
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    expect(lotes).toHaveLength(1)
    expect(lotes[0].clave).toMatch(/^[0-9a-f-]{36}$/)
    expect(lotes[0].cuerpo).toEqual({ lineas: [{ idProv: 2, concepto: 'Cinta de embalar', cantidad: 3, esUrgente: false, precioUnidad: 1.5 }] })
  })

  it('422 inline con el formulario abierto; el reintento usa la MISMA clave', async () => {
    respuestaLote = () => HttpResponse.json({ message: 'Línea 1: el proveedor está desactivado.' }, { status: 422 })
    const onCerrar = abrir()
    await userEvent.click(await screen.findByRole('button', { name: '+ Añadir línea' }))
    await escribir('Concepto línea 1', 'Cinta de embalar')
    await elegirProveedor(1, 'ACME')
    await confirmar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Línea 1: el proveedor está desactivado.')
    expect(onCerrar).not.toHaveBeenCalled()
    respuestaLote = () => HttpResponse.json({ idsCreados: [201] })
    await confirmar()
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    expect(lotes).toHaveLength(2)
    expect(lotes[1].clave).toBe(lotes[0].clave)
  })

  it('"Cancelar" cierra sin preguntar', async () => {
    const onCerrar = abrir()
    await userEvent.click(await screen.findByRole('button', { name: '+ Añadir línea' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCerrar).toHaveBeenCalledTimes(1)
    expect(lotes).toHaveLength(0)
  })
})
