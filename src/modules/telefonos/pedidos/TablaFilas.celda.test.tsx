import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { candidato, fila } from '../test/fabrica'
import { imeiConLuhnMalo, imeiValido } from '../test/imeiValido'
import { maquetarJsdom } from '@/test/layoutJsdom'
import { estadoPedidos } from './estado'
import { cargarNoValidos } from './noValidos'
import { TablaFilas } from './TablaFilas'
import { congelarHoy } from '../test/hoy'

congelarHoy()

// Spec 2026-11-25 §1, §2, §3 y §5: el IMEI se pica en la propia celda; una lectura no válida deja la celda en rojo sin frenar.
const pedido = (i: number) => `402-0000000-${String(i).padStart(7, '0')}`
const f = (i: number, extra: Parameters<typeof fila>[0] = {}) => fila({ idFila: i, pedido: pedido(i), ...extra })
const campo = () => screen.queryByRole('textbox', { name: 'IMEI' })
// IMEI sintéticos que pasan la cifra de control.
const A = imeiValido(11)
const B = imeiValido(22)
const C = imeiValido(44)
const pulsar = (id: string, imei: string | null, imeiAnterior = '') => ({ id, imei, imeiAnterior })
let puts: { id: string; imei: string | null; imeiAnterior: string | null | undefined }[] = []
/** Lo que dura sin teclear una persona entre una lectura y la siguiente (más que SUSTITUIR_MS). */
const pausa = (ms = 350) => new Promise((r) => setTimeout(r, ms))

afterEach(() => { vi.restoreAllMocks() })
beforeEach(() => {
  puts = []
  localStorage.clear()
  estadoPedidos.reset()
  maquetarJsdom()
  server.use(
    http.get('*/api/pedidos/filas/:id/recomendados', () => HttpResponse.json([])),
    http.put('*/api/pedidos/filas/:id/imei', async ({ request, params }) => {
      const cuerpo = (await request.json()) as { imei: string | null; imeiAnterior?: string | null }
      puts.push({ id: String(params.id), imei: cuerpo.imei, imeiAnterior: cuerpo.imeiAnterior })
      return HttpResponse.json(fila({ idFila: Number(params.id) }))
    }),
  )
})

const abrirTabla = (filas: ReturnType<typeof f>[]) => renderConProviders(<TablaFilas filas={filas} />, { sesion: SESION_SUPER })
const vacia = async (n = 0) => (await screen.findAllByRole('button', { name: /pulsa para poner el IMEI/ }))[n]
const aqui = () => document.querySelector('tr[data-aqui]')

describe('Celda del IMEI en su sitio', () => {
  it('al pulsarla el campo está dentro de la celda: no hay desplegable, ni marca, ni «Validar SKU»', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    expect(campo()).toHaveFocus()
    expect(campo()!.closest('td')).toHaveAttribute('data-imei')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Validar SKU/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver recomendados' })).toBeInTheDocument()
  })

  it('cifra de control mala: no guarda, la celda queda en rojo y el campo salta a la siguiente; el salto siguiente la evita', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2), f(3)])
    await user.click(await vacia())
    await user.keyboard(`${imeiConLuhnMalo(5)}{Enter}`)
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(2)))
    await pausa(200)
    expect(puts).toEqual([])
    const roja = screen.getByRole('button', { name: new RegExp(`IMEI no válido · …${imeiConLuhnMalo(5).slice(-4)}`) })
    expect(roja.closest('td')).toHaveClass('bg-[#FDE2E2]')
    expect(estadoPedidos.get().avisoImei).toMatch(/IMEI no válido/)
    await user.keyboard(`${A}{Enter}`)
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(3)))
    expect(puts).toEqual([pulsar('2', A)])
  })

  it('más de 15 cifras: rojo «16 cifras», sin guardar, y salta', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard(`${A}7{Enter}`)
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(2)))
    expect(screen.getByRole('button', { name: /IMEI no válido · 16 cifras/ })).toBeInTheDocument()
    expect(puts).toEqual([])
  })

  it('reabrir la roja trae la lectura; «Guardar igual» (solo Luhn) la guarda sin saltar y quita el rojo', async () => {
    const user = userEvent.setup()
    const mala = imeiConLuhnMalo(5)
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard(`${mala}{Enter}`)
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(2)))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /IMEI no válido/ }))
    expect(campo()).toHaveValue(mala)
    await user.keyboard('{Enter}')
    expect(puts).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Guardar igual' }))
    await waitFor(() => expect(puts).toEqual([pulsar('1', mala)]))
    await waitFor(() => expect(campo()).not.toBeInTheDocument())
    expect(estadoPedidos.get().noValidos).toEqual({})
  })

  it('reabrir la roja y leer otro IMEI bueno lo sustituye y lo guarda', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard(`${imeiConLuhnMalo(5)}{Enter}`)
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(2)))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /IMEI no válido/ }))
    await pausa()
    await user.keyboard(`${B}{Enter}`)
    await waitFor(() => expect(puts).toEqual([pulsar('1', B)]))
  })

  it('con 16 cifras reabierta no hay «Guardar igual»; Escape y clic fuera la dejan en rojo', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard(`${A}7{Enter}`)
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(2)))
    await user.keyboard('{Escape}') // cierra la celda 2, que se abrió con el salto
    await user.click(screen.getByRole('button', { name: /IMEI no válido/ }))
    expect(screen.queryByRole('button', { name: 'Guardar igual' })).not.toBeInTheDocument()
    expect(campo()).toHaveValue(`${A}7`)
    expect(campo()!.closest('td')).toHaveAttribute('data-editando')
    // Escape sobre la propia celda roja reabierta.
    await user.keyboard('{Escape}')
    expect(campo()).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /IMEI no válido · 16 cifras/ })).toBeInTheDocument()
    expect(puts).toEqual([])
    // Y, aparte, reabrir y pulsar fuera.
    await user.click(screen.getByRole('button', { name: /IMEI no válido/ }))
    expect(campo()).toBeInTheDocument()
    await user.click(document.body)
    expect(campo()).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /IMEI no válido · 16 cifras/ })).toBeInTheDocument()
    expect(puts).toEqual([])
  })

  it('reabierta en rojo, la celda pinta el rojo por dentro y no por fuera cuando se teclea un IMEI bueno', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard(`${imeiConLuhnMalo(5)}{Enter}`)
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(2)))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /IMEI no válido/ }))
    const td = campo()!.closest('td')!
    expect(td).not.toHaveClass('bg-[#FDE2E2]')
    expect(campo()!.parentElement).toHaveClass('bg-[#FDE2E2]') // la lectura mala sigue a la vista en rojo
    await user.clear(campo()!)
    await user.type(campo()!, '35')
    expect(campo()!.parentElement).not.toHaveClass('bg-[#FDE2E2]')
  })

  it('un lector que manda 15 cifras con cifra de control mala SIN Enter: pasado QUIETO_MS queda en rojo, no guarda y salta', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard(imeiConLuhnMalo(5))
    await waitFor(() => expect(aqui()).toHaveTextContent(pedido(2)))
    expect(screen.getByRole('button', { name: new RegExp(`IMEI no válido · …${imeiConLuhnMalo(5).slice(-4)}`) }).closest('td')).toHaveClass('bg-[#FDE2E2]')
    await pausa(200)
    expect(puts).toEqual([])
  })

  it('con la lista de recomendados abierta, el Escape ya tomado por Radix (defaultPrevented) no cierra la celda', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    const entrada = campo()!
    // Radix cierra la lista en `document` (captura) con preventDefault y React ya ha repintado: `ver` llega a false al manejador.
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') ev.preventDefault() }, { capture: true, once: true })
    await user.keyboard('{Escape}')
    expect(entrada).toBeInTheDocument()
  })

  it('quitar: en una celda con IMEI, campo vacío y Enter manda null; sin IMEI, Enter vacío no hace nada', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1, { imei: C }), f(2)])
    await user.click(screen.getByRole('button', { name: new RegExp(C) }))
    await user.keyboard('{Enter}')
    await waitFor(() => expect(puts).toEqual([pulsar('1', null, C)]))
    await user.click(await vacia())
    await user.keyboard('{Enter}')
    await pausa(200)
    expect(puts).toHaveLength(1)
  })

  it('pocas cifras y Enter: rojo en el sitio con «Un IMEI son 15 cifras», sin saltar', async () => {
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard('3500{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('Un IMEI son 15 cifras')
    expect(aqui()).toHaveTextContent(pedido(1))
  })

  it('el ▾ abre los recomendados sin quitar el foco del campo; elegir uno guarda y cierra; Escape cierra solo la lista', async () => {
    server.use(http.get('*/api/pedidos/filas/:id/recomendados', () => HttpResponse.json([candidato({ imei: C, caja: 'Caja · Listos', nivel: 1 })])))
    const user = userEvent.setup()
    abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.click(screen.getByRole('button', { name: 'Ver recomendados' }))
    const lista = await screen.findByRole('dialog', { name: 'Recomendados' })
    expect(campo()).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(lista).not.toBeInTheDocument())
    expect(campo()).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver recomendados' }))
    await user.click(await screen.findByRole('button', { name: new RegExp(C) }))
    await waitFor(() => expect(puts).toEqual([pulsar('1', C)]))
    await waitFor(() => expect(campo()).not.toBeInTheDocument())
  })

  it('la marca no válida sobrevive a recargar (localStorage) y no la ve otro usuario', async () => {
    const user = userEvent.setup()
    const { unmount } = abrirTabla([f(1), f(2)])
    await user.click(await vacia())
    await user.keyboard(`${imeiConLuhnMalo(5)}{Enter}`)
    await waitFor(() => expect(estadoPedidos.get().noValidos[1]).toBeDefined())
    unmount()
    estadoPedidos.reset()
    cargarNoValidos()
    abrirTabla([f(1), f(2)])
    expect(await screen.findByRole('button', { name: /IMEI no válido/ })).toBeInTheDocument()
  })
})
