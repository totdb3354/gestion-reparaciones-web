import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CambioImei, FilaVista } from '@/shared/api/client'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { maquetarJsdom } from '@/test/layoutJsdom'
import { estadoNsys, fila, fuente } from '../test/fabrica'
import { imeiValido } from '../test/imeiValido'
import { estadoPedidos } from './estado'
import { PedidosPage } from './PedidosPage'
import { construirHistorial } from './historial'
import { estaValidada, puedeValidar } from './filas'
import { congelarHoy } from '../test/hoy'

congelarHoy()

// «Validar SKU»: el botón único en el desplegable del IMEI y en el panel, la celda «validado», el contador y el historial.
const naranja = (p: Partial<FilaVista>) => fila({ imei: imeiValido(1), nivel: 'MAL', skuMovil: 'i14128NegroA', ...p })
const FILAS = [
  naranja({ idFila: 1, pedido: 'V-0001', motivo: 'COLOR_O_GRADO' }),
  naranja({ idFila: 2, pedido: 'V-0002', motivo: 'NO_EN_NSYS', skuMovil: null }),
  naranja({ idFila: 3, pedido: 'V-0003', motivo: 'EN_OTRA_FILA' }),
  fila({ idFila: 4, pedido: 'V-0004', imei: imeiValido(4), nivel: 'AVISO', motivo: 'EN_TALLER' }),
  fila({ idFila: 5, pedido: 'V-0005', imei: imeiValido(5), nivel: 'OK', motivo: null, motivoValidado: 'COLOR_O_GRADO', validadaPor: 'Supertécnico 1', validadaEn: '2026-11-16T09:30:00' }),
  fila({ idFila: 6, pedido: 'V-0006' }),
]

let respuesta: FilaVista[] = FILAS
let puts: { id: string; cuerpo: { validar: boolean; imeiAnterior: string | null }; clave: string | null }[] = []
let cambios: Record<string, CambioImei[]> = {}

afterEach(() => { vi.restoreAllMocks() })
beforeEach(() => {
  respuesta = FILAS
  puts = []
  cambios = {}
  estadoPedidos.reset()
  maquetarJsdom()
  server.use(
    http.get('*/api/pedidos/filas', () => HttpResponse.json({ filas: respuesta, hayMas: false })),
    http.get('*/api/pedidos/fuentes', () => HttpResponse.json([fuente({ fuente: 'SHIPPYPRO' })])),
    http.get('*/api/stock-telefonos/estado', () => HttpResponse.json(estadoNsys())),
    http.get('*/api/pedidos/filas/:id/cambios', ({ params }) => HttpResponse.json(cambios[String(params.id)] ?? [])),
    http.put('*/api/pedidos/filas/:id/validacion', async ({ request, params }) => {
      const cuerpo = (await request.json()) as (typeof puts)[number]['cuerpo']
      puts.push({ id: String(params.id), cuerpo, clave: request.headers.get('Idempotency-Key') })
      const base = FILAS.find((f) => f.idFila === Number(params.id))!
      return HttpResponse.json(cuerpo.validar
        ? { ...base, nivel: 'OK', motivo: null, motivoValidado: base.motivo, validadaPor: 'Supertécnico 1', validadaEn: '2026-11-16T10:00:00' }
        : { ...base, nivel: 'MAL', motivo: base.motivoValidado, motivoValidado: null, validadaPor: null, validadaEn: null })
    }),
  )
})

const abrir = () => renderConProviders(<PedidosPage />, { sesion: SESION_SUPER, ruta: '/telefonos/pedidos' })
const tr = (pedido: string) => screen.getAllByText(pedido)[0].closest('tr')!
const esperar = (n = FILAS.length) => screen.findByRole('button', { name: `${n} filas` })
const celda = (pedido: string) => within(tr(pedido)).getAllByRole('button')[0]
const desplegable = () => screen.findByRole('dialog', { name: 'Poner el IMEI' })
const abrirPanel = async (user: ReturnType<typeof userEvent.setup>, pedido: string) => {
  await user.click(within(tr(pedido)).getByRole('button', { name: pedido }))
  return waitFor(() => {
    const paneles = screen.getAllByRole('region', { name: 'Detalle del pedido' }).filter((p) => within(p).queryAllByText(pedido).length > 0)
    expect(paneles).toHaveLength(1)
    return paneles[0]
  })
}

describe('Pedidos: Validar SKU (el botón según estado y motivo)', () => {
  it('puedeValidar solo con los cuatro motivos de SKU, en naranja y con IMEI; estaValidada con motivoValidado', () => {
    for (const m of ['MODELO', 'COLOR_O_GRADO', 'GRADO_NO_VENDIBLE', 'SKU_DESCONOCIDO']) expect(puedeValidar(naranja({ motivo: m }))).toBe(true)
    for (const m of ['NO_EN_NSYS', 'EN_OTRA_FILA']) expect(puedeValidar(naranja({ motivo: m }))).toBe(false)
    expect(puedeValidar(naranja({ motivo: 'MODELO', nivel: 'AVISO' }))).toBe(false)
    expect(puedeValidar(naranja({ motivo: 'MODELO', imei: null }))).toBe(false)
    expect(puedeValidar(naranja({ motivo: 'MODELO', editable: false }))).toBe(false)
    expect(puedeValidar(naranja({ motivo: 'MODELO', motivoValidado: 'MODELO', nivel: 'OK' }))).toBe(false)
    expect(estaValidada(fila({ motivoValidado: 'MODELO' }))).toBe(true)
    expect(estaValidada(fila())).toBe(false)
  })

  it('el desplegable de una celda naranja de SKU enseña «Validar SKU» (con imeiAnterior y clave) y no roba el foco al campo', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    await user.click(celda('V-0001'))
    const d = within(await desplegable())
    expect(d.getByRole('textbox', { name: 'IMEI' })).toHaveFocus()
    expect(d.queryByRole('button', { name: 'Quitar validación' })).not.toBeInTheDocument()
    await user.click(d.getByRole('button', { name: 'Validar SKU' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0].id).toBe('1')
    expect(puts[0].cuerpo).toEqual({ validar: true, imeiAnterior: imeiValido(1) })
    expect(puts[0].clave).toBeTruthy()
  })

  it('no sale con NO_EN_NSYS, EN_OTRA_FILA, ámbar ni sin aviso, ni en el desplegable ni en el panel', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    for (const p of ['V-0002', 'V-0003', 'V-0004', 'V-0006']) {
      await user.click(celda(p))
      const d = within(await desplegable())
      expect(d.queryByRole('button', { name: /Validar SKU|Quitar validación/ })).not.toBeInTheDocument()
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Poner el IMEI' })).not.toBeInTheDocument())
      const panel = await abrirPanel(user, p)
      expect(within(panel).queryByRole('button', { name: /Validar SKU|Quitar validación/ })).not.toBeInTheDocument()
    }
  })

  it('el panel de una fila naranja de SKU valida; una validada enseña «Quitar validación» y quita', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    const panel1 = await abrirPanel(user, 'V-0001')
    await user.click(within(panel1).getByRole('button', { name: 'Validar SKU' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0].cuerpo.validar).toBe(true)
    const panel5 = await abrirPanel(user, 'V-0005')
    expect(within(panel5).getByText('SKU validado')).toBeInTheDocument()
    await user.click(within(panel5).getByRole('button', { name: 'Quitar validación' }))
    await waitFor(() => expect(puts).toHaveLength(2))
    expect(puts[1].id).toBe('5')
    expect(puts[1].cuerpo).toEqual({ validar: false, imeiAnterior: imeiValido(5) })
  })

  it('el desplegable de una fila validada enseña «Quitar validación»', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    await user.click(celda('V-0005'))
    const d = within(await desplegable())
    expect(d.queryByRole('button', { name: 'Validar SKU' })).not.toBeInTheDocument()
    await user.click(d.getByRole('button', { name: 'Quitar validación' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0].cuerpo.validar).toBe(false)
  })
})

describe('Pedidos: la celda validada, el contador y el filtro', () => {
  it('la celda validada enseña el IMEI con «validado», sin el motivo escrito, con el aviso original en el title y sin naranja', async () => {
    abrir()
    await esperar()
    const c = celda('V-0005')
    expect(c).toHaveTextContent(imeiValido(5))
    expect(within(c).getByText('validado')).toBeInTheDocument()
    expect(c.getAttribute('title')).toContain('otro color o grado')
    expect(c).not.toHaveTextContent('otro color o grado')
    expect(c.closest('td')!.className).not.toContain('FFE0B2')
    // La naranja sigue con su motivo y sin «validado».
    expect(celda('V-0001')).toHaveTextContent('otro color o grado')
    expect(within(celda('V-0001')).queryByText('validado')).not.toBeInTheDocument()
  })

  it('«N no cuadran» no cuenta la validada y el filtro «No cuadran» no la saca', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    // Naranjas: V-0001, V-0002 y V-0003; la validada llega con nivel OK.
    await user.click(screen.getByRole('button', { name: '3 no cuadran' }))
    const vistos = screen.getAllByRole('button', { name: /^V-000\d$/ }).map((e) => e.textContent)
    expect(vistos).toEqual(['V-0001', 'V-0002', 'V-0003'])
  })
})

describe('Pedidos: el historial de la validación', () => {
  it('enseña «SKU validado (motivo)» y «Validación quitada» con quién y cuándo', async () => {
    const user = userEvent.setup()
    cambios = {
      '5': [
        { usuario: 'Supertécnico 1', fecha: '2026-11-16T10:30:00', imeiAnterior: null, imeiNuevo: null, tipo: 'VALIDACION_QUITADA', detalle: 'COLOR_O_GRADO' },
        { usuario: 'Supertécnico 1', fecha: '2026-11-16T09:30:00', imeiAnterior: null, imeiNuevo: null, tipo: 'VALIDADA', detalle: 'COLOR_O_GRADO' },
      ],
    }
    abrir()
    await esperar()
    const panel = await abrirPanel(user, 'V-0005')
    const lista = within(await within(panel).findByRole('list', { name: 'Historial de la fila' }))
    expect(await lista.findByText('SKU validado (otro color o grado)')).toBeInTheDocument()
    expect(lista.getByText('Validación quitada')).toBeInTheDocument()
    expect(lista.getAllByText(/Supertécnico 1/).length).toBeGreaterThanOrEqual(2)
  })

  it('validar adelanta el apunte en el historial al momento', async () => {
    const user = userEvent.setup()
    abrir()
    await esperar()
    const panel = await abrirPanel(user, 'V-0001')
    await within(panel).findByRole('list', { name: 'Historial de la fila' })
    await user.click(within(panel).getByRole('button', { name: 'Validar SKU' }))
    expect(await within(panel).findByText('SKU validado (otro color o grado)')).toBeInTheDocument()
  })

  it('construirHistorial pone los dos tipos como apuntes de la fila', () => {
    const e = construirHistorial(fila(), [
      { usuario: 'A', fecha: '2026-11-16T09:30:00', imeiAnterior: null, imeiNuevo: null, tipo: 'VALIDADA', detalle: 'SKU_DESCONOCIDO' },
      { usuario: 'A', fecha: '2026-11-16T09:40:00', imeiAnterior: null, imeiNuevo: null, tipo: 'VALIDACION_QUITADA', detalle: null },
    ])
    expect(e.flatMap((x) => (x.tipo === 'marca' ? [x.texto] : []))).toEqual(['Validación quitada', 'SKU validado (el maestro no conoce este SKU)'])
  })
})
