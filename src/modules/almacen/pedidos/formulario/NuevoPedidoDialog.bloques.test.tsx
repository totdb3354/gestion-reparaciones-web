import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompraComponente } from '@/shared/api/client'
import type { PrecargaPedido } from '@/shared/lib/formularioPedido'
import { renderConRouter, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { lineaDePrueba as l } from '../bloques/datosPrueba'
import { COMPONENTES, PROVEEDORES } from './datosPrueba'
import { NuevoPedidoDialog } from './NuevoPedidoDialog'

/** Bloque 41 de ACME (proveedor 1), abierto. */
const ABIERTO_ACME: CompraComponente[] = [l({ idCompra: 9, idProv: 1, nombreProveedor: 'ACME', idBloque: 41 })]
let lotes: unknown[]
let compras: CompraComponente[]
let lecturas: number
let respuestaLote: () => Response

beforeEach(() => {
  lotes = []
  compras = ABIERTO_ACME
  lecturas = 0
  respuestaLote = () => HttpResponse.json({ idsCreados: [101] })
  server.use(
    http.get('*/api/componentes/gestionados', () => HttpResponse.json(COMPONENTES)),
    http.get('*/api/proveedores', () => HttpResponse.json(PROVEEDORES)),
    http.get('*/api/tipo-cambio/:divisa', () => HttpResponse.json({ value: 1.1367 })),
    http.get('*/api/compras', () => { lecturas += 1; return HttpResponse.json(compras) }),
    http.post('*/api/compras/lote', async ({ request }) => { lotes.push(await request.json()); return respuestaLote() }),
  )
})

function abrir(precarga: PrecargaPedido = { modo: 'vacio' }) {
  const onCerrar = vi.fn()
  renderConRouter([{ path: '/', element: <NuevoPedidoDialog precarga={precarga} onCerrar={onCerrar} /> }], { sesion: SESION_SUPER })
  return onCerrar
}

async function anadirLinea(n: number, proveedor?: string) {
  await userEvent.click(screen.getByRole('button', { name: '+ Añadir línea' }))
  await userEvent.type(screen.getByRole('combobox', { name: `Componente línea ${n}` }), 'lcd')
  await userEvent.click(await screen.findByRole('option', { name: 'lcd-x-negro' }))
  if (proveedor === undefined) return
  await userEvent.click(screen.getByRole('combobox', { name: `Proveedor línea ${n}` }))
  await userEvent.click(await within(screen.getByRole('listbox', { name: `Proveedor línea ${n}` })).findByRole('button', { name: proveedor }))
}
const resumen = () => screen.getByRole('region', { name: 'Bloques' })
const confirmar = () => userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }))

describe('«Nuevo pedido» con bloques (0.9.9)', () => {
  it('sin líneas, el resumen lo explica', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    expect(resumen()).toHaveTextContent('Añade líneas: aquí verás a qué bloque va cada proveedor.')
  })

  it('un proveedor con bloque abierto se suma a él por defecto y viaja en destinos', async () => {
    const onCerrar = abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await anadirLinea(1, 'ACME')
    expect(await within(resumen()).findByRole('combobox', { name: 'Bloque de ACME' })).toHaveTextContent('Añadir a Bloque 41')
    await confirmar()
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(lotes[0]).toMatchObject({ destinos: [{ idProv: 1, idBloque: 41 }] })
  })

  it('elegir «Bloque nuevo» lo manda con idBloque null', async () => {
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await anadirLinea(1, 'ACME')
    await userEvent.click(await within(resumen()).findByRole('combobox', { name: 'Bloque de ACME' }))
    await userEvent.click(await within(screen.getByRole('listbox', { name: 'Bloque de ACME' })).findByRole('button', { name: 'Bloque nuevo' }))
    await confirmar()
    await waitFor(() => expect(lotes).toHaveLength(1))
    expect(lotes[0]).toMatchObject({ destinos: [{ idProv: 1, idBloque: null }] })
  })

  it('un proveedor sin bloques abiertos va a uno nuevo sin preguntar y no viaja en destinos', async () => {
    compras = []
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await anadirLinea(1, 'Proveedor B')
    expect(resumen()).toHaveTextContent(/Proveedor B.*1 línea.*Bloque nuevo.*no tiene ninguno abierto/)
    await confirmar()
    await waitFor(() => expect(lotes).toHaveLength(1))
    expect(lotes[0]).toMatchObject({ destinos: null })
  })

  it('«Añadir líneas» de un bloque: título, proveedor fijo y destino fijado', async () => {
    const onCerrar = abrir({ modo: 'bloque', idBloque: 41, idProv: 1 })
    await screen.findByRole('dialog', { name: 'Añadir líneas · Bloque 41' })
    await anadirLinea(1)
    expect(screen.queryByRole('combobox', { name: 'Proveedor línea 1' })).not.toBeInTheDocument()
    expect(resumen()).toHaveTextContent(/ACME.*Bloque 41.*\(fijado\)/)
    await confirmar()
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(lotes[0]).toMatchObject({ lineas: [{ idProv: 1 }], destinos: [{ idProv: 1, idBloque: 41 }] })
  })

  it('un 409 de destino deja el formulario abierto con el mensaje y recarga los pedidos', async () => {
    respuestaLote = () => HttpResponse.json({ message: 'El bloque 41 ya no existe; elige otro destino.' }, { status: 409 })
    abrir()
    await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await anadirLinea(1, 'ACME')
    await within(resumen()).findByRole('combobox', { name: 'Bloque de ACME' })
    const antes = lecturas
    await confirmar()
    expect(await screen.findByText('El bloque 41 ya no existe; elige otro destino.')).toBeInTheDocument()
    await waitFor(() => expect(lecturas).toBeGreaterThan(antes))
  })
})
