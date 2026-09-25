import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { COMPRA, OTRO, PROVEEDORES } from './formulario/datosPrueba'
import { PedidosPage } from './PedidosPage'

let puts: string[]

beforeEach(() => {
  puts = []
  server.use(
    http.get('*/api/compras', () => HttpResponse.json([COMPRA])),
    http.get('*/api/compras-otros', () => HttpResponse.json([OTRO])),
    http.get('*/api/proveedores', () => HttpResponse.json(PROVEEDORES)),
    http.get('*/api/tipo-cambio/:divisa', () => HttpResponse.json({ value: 1.1367 })),
    http.put('*/api/compras/:id', ({ params }) => { puts.push(`compras/${String(params.id)}`); return new HttpResponse(null, { status: 200 }) }),
    http.put('*/api/compras-otros/:id', ({ params }) => { puts.push(`compras-otros/${String(params.id)}`); return new HttpResponse(null, { status: 200 }) }),
  )
})

describe('PedidosPage: "Editar" abre el editor de su tabla', () => {
  it('componentes: "Editar" → "Editar pedido #7"; Guardar escribe y lo cierra', async () => {
    renderConProviders(<PedidosPage tipo="componentes" />, { sesion: SESION_SUPER, ruta: '/stock/pedidos' })
    await userEvent.pointer({ keys: '[MouseRight]', target: await screen.findByRole('row', { name: /bat-x/ }) })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar' }))
    expect(await screen.findByRole('dialog', { name: 'Editar pedido #7' })).toBeInTheDocument()
    expect(screen.getByText('Componente:')).toBeInTheDocument()
    // Dentro del diálogo: la celda "Proveedor" de la tabla también dice ACME.
    await within(screen.getByRole('dialog', { name: 'Editar pedido #7' })).findByText('ACME')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Editar pedido #7' })).not.toBeInTheDocument())
    expect(puts).toEqual(['compras/7'])
  })

  it('otros: "Editar" → el editor de otros (con "Concepto:"); Cancelar lo cierra sin escribir', async () => {
    renderConProviders(<PedidosPage tipo="otros" />, { sesion: SESION_SUPER, ruta: '/stock/pedidos/otros' })
    await userEvent.pointer({ keys: '[MouseRight]', target: await screen.findByRole('row', { name: /Cinta de embalar/ }) })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar' }))
    expect(await screen.findByRole('dialog', { name: 'Editar pedido #9' })).toBeInTheDocument()
    expect(screen.getByLabelText('Concepto:')).toHaveValue('Cinta de embalar')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(puts).toEqual([])
  })
})
