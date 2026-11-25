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
import { congelarHoy } from '../test/hoy'

congelarHoy()

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
    for (const t of ['Pendiente', 'Etiqueta generada', 'Enviado', 'Ya no está en ShippyPro', 'De la hoja']) expect(within(ayuda).getByText(t)).toBeInTheDocument()
    expect(within(ayuda).getByText(/Las filas las crea el ERP/)).toBeInTheDocument()
    expect(within(ayuda).getByText(/IMEI en amarillo claro: grado N\/A/)).toBeInTheDocument()
    expect(within(ayuda).getByText(/Sin fondo pero con una palabra al lado/)).toBeInTheDocument()
    expect(within(ayuda).getByText(/IMEI en naranja/)).toBeInTheDocument()
    expect(within(ayuda).getByText('La fila seleccionada (en azul) es la última que has tocado. Si te alejas de ella, el botón «Fila seleccionada» te devuelve; «↓ Al final» baja a lo más reciente.')).toBeInTheDocument()
    expect(within(ayuda).getByText(/El IMEI se lee o se escribe en la propia celda/)).toBeInTheDocument()
    expect(within(ayuda).getByText(/IMEI no válido \(cifra de control mala/)).toBeInTheDocument()
    expect(within(ayuda).getByText(/Con un filtro puesto, las filas que vas picando no se van/)).toBeInTheDocument()
    expect(within(ayuda).getByText('Falta por enviar')).toBeInTheDocument()
    expect(within(ayuda).getByText(/Envío parcial de una web: este móvil sale después que el resto del pedido/)).toBeInTheDocument()
    expect(within(ayuda).getByText(/«Ya ha salido»/)).toBeInTheDocument()
    // Las cuatro marcas de la fila, con su etiqueta de muestra y su frase.
    for (const t of ['En espera de stock', 'En revisión', 'Pendiente de color', 'Cancelado']) expect(within(ayuda).getByText(t)).toBeInTheDocument()
    expect(within(ayuda).getByText(/hay algo que aclarar antes de enviarlo/)).toBeInTheDocument()
    expect(within(ayuda).getByText(/El cliente anula ese móvil/)).toBeInTheDocument()
    expect(within(ayuda).getByText('1/3')).toBeInTheDocument()
    expect(within(ayuda).getByText('El móvil es uno de los de un pedido de varios.')).toBeInTheDocument()
    // La fecha de salida: tres muestras y el aviso de cómo se calcula; el cuadro hace scroll si no cabe en la ventana.
    for (const t of ['Sale hoy', 'Sale mañana', 'Con retraso']) expect(within(ayuda).getByText(t)).toBeInTheDocument()
    expect(within(ayuda).getByText(/Sale vie 20\/11/)).toBeInTheDocument()
    expect(within(ayuda).getByText(/hasta el laborable siguiente/)).toBeInTheDocument()
    expect(ayuda.className).toContain('max-h-[calc(100vh-80px)]')
    expect(ayuda.className).toContain('overflow-y-auto')
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

describe('Pedidos: la ayuda de la reserva', () => {
  it('explica qué es una reserva y cómo confirmarla', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Ayuda de Pedidos' }))
    const ayuda = await screen.findByRole('dialog', { name: 'Cómo se lee esta tabla' })
    expect(within(ayuda).getByText(/IMEI tenue: reservado/)).toBeInTheDocument()
    expect(within(ayuda).getByText(/pica ese IMEI/)).toBeInTheDocument()
    expect(within(ayuda).getByText(/«N reservadas» cuenta/)).toBeInTheDocument()
  })
})
