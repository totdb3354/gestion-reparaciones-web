import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { fila } from '../test/fabrica'
import { estadoPedidos } from './estado'
import { TablaFilas } from './TablaFilas'

// jsdom no maqueta: cada fila mide 32 px, la cabecera 0 y el hueco visible 320 px (10 filas). La posición de una fila sale de su
// lugar en el cuerpo; `scrollTo` mueve al instante y avisa del scroll como el navegador.
const ALTO = 32
const VISIBLE = 320
const region = () => screen.getByRole('region', { name: 'Tabla de pedidos' })
const filasPintadas = (el: Element) => Array.from(el.querySelectorAll('tr[data-estado]'))

const f = (i: number) => fila({ idFila: i, pedido: `402-0000000-${String(i).padStart(7, '0')}` })
const desde = (n: number, m = 1) => Array.from({ length: n }, (_, k) => f(m + k))

/** Simula el sondeo: «llegan N» añade N filas nuevas al final. */
function Arnes() {
  const [n, setN] = useState(60)
  return (<>
    <button onClick={() => setN((x) => x + 2)}>llegan 2</button><button onClick={() => setN((x) => x + 1)}>llega 1</button>
    <TablaFilas filas={desde(n)} />
  </>)
}

const scrollToOriginal = Element.prototype.scrollTo
beforeEach(() => {
  estadoPedidos.reset()
  server.use(http.get('*/api/pedidos/filas/:id/recomendados', () => HttpResponse.json([])))
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.getAttribute('role') === 'region' ? filasPintadas(this).length * ALTO : 0
  })
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.getAttribute('role') === 'region' ? VISIBLE : 0
  })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const r = this.closest('[role="region"]')
    const i = this.tagName === 'TR' && r ? filasPintadas(r).indexOf(this) : -1
    const top = i >= 0 ? i * ALTO - r!.scrollTop : 0
    return { x: 0, y: top, top, left: 0, right: 100, bottom: top + ALTO, width: 100, height: i >= 0 ? ALTO : 0, toJSON: () => ({}) } as DOMRect
  })
  // El navegador no deja pasar `scrollTop` del contenido: se limita a [0, scrollHeight - clientHeight].
  const pos = new WeakMap<Element, number>()
  vi.spyOn(Element.prototype, 'scrollTop', 'get').mockImplementation(function (this: Element) { return pos.get(this) ?? 0 })
  vi.spyOn(Element.prototype, 'scrollTop', 'set').mockImplementation(function (this: Element, v: number) {
    const el = this as HTMLElement
    pos.set(this, Math.max(0, Math.min(v, el.scrollHeight - el.clientHeight)))
  })
  Element.prototype.scrollTo = function (this: Element, o?: ScrollToOptions | number) {
    this.scrollTop = typeof o === 'object' ? o.top ?? 0 : 0
    this.dispatchEvent(new Event('scroll'))
  } as Element['scrollTo']
})
afterEach(() => { vi.restoreAllMocks(); Element.prototype.scrollTo = scrollToOriginal })

const desplazar = (top: number) => act(() => { region().scrollTop = top; fireEvent.scroll(region()) })
const alFinal = () => screen.queryByRole('button', { name: /Al final/ })
const seleccionada = () => screen.queryByRole('button', { name: /Fila seleccionada/ })

describe('TablaFilas: volver al final y a la fila seleccionada', () => {
  it('al abrir está al final y no hay botones; al subir sale «↓ Al final», que baja y desaparece', async () => {
    const user = userEvent.setup()
    renderConProviders(<TablaFilas filas={desde(60)} />, { sesion: SESION_SUPER })
    expect(region().scrollTop).toBe(60 * ALTO - VISIBLE)
    expect(alFinal()).not.toBeInTheDocument()
    desplazar(500)
    await user.click(await screen.findByRole('button', { name: '↓ Al final' }))
    expect(region().scrollTop).toBe(60 * ALTO - VISIBLE)
    expect(alFinal()).not.toBeInTheDocument()
  })

  it('con la fila seleccionada fuera de la vista sale «Fila seleccionada» con su flecha, y la deja en el centro', async () => {
    const user = userEvent.setup()
    renderConProviders(<TablaFilas filas={desde(60)} />, { sesion: SESION_SUPER })
    act(() => estadoPedidos.set((s) => ({ ...s, filaAqui: 20 })))
    // Fila 20: índice 19, de 608 a 640. Desde el final queda arriba.
    expect(await screen.findByRole('button', { name: '↑ Fila seleccionada' })).toBeInTheDocument()
    desplazar(0)
    expect(await screen.findByRole('button', { name: '↓ Fila seleccionada' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '↓ Fila seleccionada' }))
    expect(region().scrollTop).toBe(624 - VISIBLE / 2)
    expect(seleccionada()).not.toBeInTheDocument()
  })

  it('a la vista no sale; si un filtro la esconde, tampoco', async () => {
    const { rerender } = renderConProviders(<TablaFilas filas={desde(60)} />, { sesion: SESION_SUPER })
    act(() => estadoPedidos.set((s) => ({ ...s, filaAqui: 58 })))
    expect(seleccionada()).not.toBeInTheDocument()
    act(() => estadoPedidos.set((s) => ({ ...s, filaAqui: 20 })))
    expect(await screen.findByRole('button', { name: /Fila seleccionada/ })).toBeInTheDocument()
    rerender(<TablaFilas filas={desde(60).filter((x) => x.idFila !== 20)} recibidas={60} />)
    expect(seleccionada()).not.toBeInTheDocument()
  })

  it('llegan pedidos estando arriba: no mueve y «↓ Al final» dice cuántos hay; al bajar se pone a cero', async () => {
    renderConProviders(<Arnes />, { sesion: SESION_SUPER })
    desplazar(300)
    fireEvent.click(screen.getByRole('button', { name: 'llegan 2' }))
    expect(region().scrollTop).toBe(300)
    expect(await screen.findByRole('button', { name: '↓ Al final (2 nuevos)' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'llega 1' }))
    expect(await screen.findByRole('button', { name: '↓ Al final (3 nuevos)' })).toBeInTheDocument()
    desplazar(63 * ALTO - VISIBLE)
    expect(alFinal()).not.toBeInTheDocument()
    desplazar(300)
    expect(await screen.findByRole('button', { name: '↓ Al final' })).toBeInTheDocument()
  })

  it('llegan pedidos estando abajo: la tabla sigue al final y no sale ningún botón', async () => {
    renderConProviders(<Arnes />, { sesion: SESION_SUPER })
    fireEvent.click(screen.getByRole('button', { name: 'llegan 2' }))
    expect(region().scrollTop).toBe(62 * ALTO - VISIBLE)
    expect(alFinal()).not.toBeInTheDocument()
  })
})
