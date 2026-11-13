import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { maquetarJsdom } from '@/test/layoutJsdom'
import { candidato, estadoNsys, fila, fuente } from '../test/fabrica'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'

let fuentes = [fuente({ fuente: 'SHIPPYPRO' })]

afterEach(() => { vi.restoreAllMocks() })

beforeEach(() => {
  estadoPedidos.reset()
  maquetarJsdom()
  fuentes = [fuente({ fuente: 'SHIPPYPRO' })]
  server.use(
    http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: [fila({ idFila: 1, pedido: '402-0000000-0000011' })], hayMas: false })),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json(fuentes)),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    http.get('*/api/pedidos/filas/:id/recomendados', () => HttpResponse.json([
      candidato({ imei: '350000000000103', caja: 'Taller', nivel: 3, sku: 'i14eSIM256BlancoAMuyLargo' }),
    ])),
  )
})

const abrir = () => renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })

describe('Pedidos: botón de ayuda', () => {
  it('la leyenda ya no está bajo la tabla; el «?» abre «Cómo se lee esta tabla» con los estados y se cierra con Escape devolviendo el foco', async () => {
    abrir()
    await screen.findByRole('button', { name: '1 filas' })
    expect(screen.queryByText(/Las filas las crea el ERP/)).not.toBeInTheDocument()
    const boton = screen.getByRole('button', { name: 'Ayuda de Pedidos' })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    const ayuda = await screen.findByRole('dialog', { name: 'Cómo se lee esta tabla' })
    expect(within(ayuda).getByRole('heading', { name: 'Cómo se lee esta tabla' })).toBeInTheDocument()
    for (const t of ['Pendiente', 'Etiqueta generada', 'Enviado', 'Ya no está pendiente', 'De la hoja']) expect(within(ayuda).getByText(t)).toBeInTheDocument()
    expect(within(ayuda).getByText(/Las filas las crea el ERP/)).toBeInTheDocument()
    expect(within(ayuda).getByText(/IMEI en ámbar/)).toBeInTheDocument()
    expect(within(ayuda).getByText(/IMEI en naranja/)).toBeInTheDocument()
    expect(within(ayuda).getByText('La fila en azul es la última que has tocado: te ayuda a encontrarla al volver.')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Cómo se lee esta tabla' })).not.toBeInTheDocument()
    expect(boton).toHaveFocus()
    expect(boton).toHaveAttribute('aria-expanded', 'false')
  })

  it('el clic fuera la cierra', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Ayuda de Pedidos' }))
    await screen.findByRole('dialog', { name: 'Cómo se lee esta tabla' })
    await userEvent.click(screen.getByRole('heading', { name: 'Pedidos' }))
    expect(screen.queryByRole('dialog', { name: 'Cómo se lee esta tabla' })).not.toBeInTheDocument()
  })
})

describe('Pedidos: recomendados', () => {
  it('el SKU completo de un candidato de nivel 3 está en el DOM, sin recortar', async () => {
    abrir()
    await userEvent.click((await screen.findAllByRole('button', { name: /pulsa para poner el IMEI/ }))[0])
    await userEvent.click(await screen.findByRole('button', { name: 'Ver recomendados' }))
    const sku = await screen.findByText('es i14eSIM256BlancoAMuyLargo')
    expect(sku).toBeInTheDocument()
    expect(sku.className).not.toMatch(/truncate/)
  })
})

describe('Pedidos: píldora de fuentes con aviso', () => {
  it('sin aviso, como siempre: verde y «al día»', async () => {
    abrir()
    const pildora = await screen.findByRole('button', { name: /Fuentes: ShippyPro · NSYS: al día/ })
    expect(pildora.querySelector('.bg-verde-ok')).not.toBeNull()
    expect(screen.queryByText(/con avisos/)).not.toBeInTheDocument()
  })

  it('con aviso: punto ámbar, «ShippyPro: con avisos» y el aviso en el detalle', async () => {
    fuentes = [fuente({ fuente: 'SHIPPYPRO', aviso: 'Falta el transportista en 3 envíos' })]
    abrir()
    const pildora = await screen.findByRole('button', { name: 'Fuentes: ShippyPro: con avisos' })
    expect(pildora.querySelector('.bg-ambar')).not.toBeNull()
    expect(pildora.querySelector('.bg-verde-ok')).toBeNull()
    await userEvent.click(pildora)
    expect(await screen.findByText(/Falta el transportista en 3 envíos/)).toBeInTheDocument()
  })
})
