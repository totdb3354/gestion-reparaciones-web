import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { fila } from '../test/fabrica'
import { estadoPedidos } from './estado'
import { TablaFilas } from './TablaFilas'

// Cuenta cuántas veces se pinta la celda de cada fila: solo se pinta si se pinta su fila.
const pintadas = vi.hoisted(() => new Map<number, number>())
vi.mock('./CeldaImei', async (original) => {
  const { CeldaImei } = await original<typeof import('./CeldaImei')>()
  return { CeldaImei: (p: Parameters<typeof CeldaImei>[0]) => { pintadas.set(p.fila.idFila, (pintadas.get(p.fila.idFila) ?? 0) + 1); return <CeldaImei {...p} /> } }
})

const FILAS = [1, 2, 3, 4].map((i) => fila({ idFila: i, pedido: `402-0000000-000000${i}` }))

function Arnes() {
  const [filas, setFilas] = useState(FILAS)
  // Un sondeo: objetos nuevos solo para lo que cambia (como el reparto estructural de TanStack).
  return (<><button onClick={() => setFilas((f) => f.map((x) => (x.idFila === 3 ? { ...x, plataforma: 'Otra' } : x)))}>sondear</button><TablaFilas filas={filas} /></>)
}

beforeEach(() => {
  pintadas.clear()
  estadoPedidos.reset()
  server.use(http.get('*/api/pedidos/filas/:id/recomendados', () => HttpResponse.json([])))
})

describe('TablaFilas: no se repinta entera', () => {
  it('abrir una celda pinta solo esa fila; abrir otra, solo esas dos; un sondeo (que cierra la abierta), solo esa y la cambiada', async () => {
    const user = userEvent.setup()
    renderConProviders(<Arnes />, { sesion: SESION_SUPER })
    expect([...pintadas.values()]).toEqual([1, 1, 1, 1])
    const celdas = screen.getAllByRole('button', { name: /pulsa para poner el IMEI/ })
    await user.click(celdas[0])
    expect(pintadas.get(1)).toBe(2)
    expect([2, 3, 4].map((i) => pintadas.get(i))).toEqual([1, 1, 1])
    await user.click(celdas[1])
    expect([1, 2, 3, 4].map((i) => pintadas.get(i))).toEqual([3, 2, 1, 1])
    await user.click(screen.getByRole('button', { name: 'sondear' }))
    expect([1, 2, 3, 4].map((i) => pintadas.get(i))).toEqual([3, 3, 2, 1])
  })

  it('elegir una fila (para el panel) repinta solo la que deja de estar elegida y la nueva', async () => {
    const user = userEvent.setup()
    renderConProviders(<Arnes />, { sesion: SESION_SUPER })
    await user.click(screen.getByRole('button', { name: '402-0000000-0000001' }))
    expect([1, 2, 3, 4].map((i) => pintadas.get(i))).toEqual([2, 1, 1, 1])
    await user.click(screen.getByRole('button', { name: '402-0000000-0000003' }))
    expect([1, 2, 3, 4].map((i) => pintadas.get(i))).toEqual([3, 1, 2, 1])
  })
})

describe('TablaFilas: «falta por enviar» con fecha de salida', () => {
  const HOY = '2026-11-18'
  const parcial = (fechaSalida: string) => fila({ idFila: 1, pedido: '0099-0000001', estado: 'ENVIADA', faltaEnviarEn: '2026-11-17T10:00:00', fechaSalida })
  const etiqueta = (f: ReturnType<typeof fila>) => {
    renderConProviders(<TablaFilas filas={[f]} hoy={HOY} />, { sesion: SESION_SUPER })
    return screen.getByText(/^Envío parcial · falta por enviar/)
  }

  it('que sale hoy lo dice con el color de «Sale hoy»', () => {
    const e = etiqueta(parcial(HOY))
    expect(e).toHaveTextContent(/^Envío parcial · falta por enviar · sale hoy$/)
    expect(e).toHaveClass('bg-[#fde2e1]', 'text-[#b42318]')
  })

  it('con retraso lo dice con el color de «Con retraso»', () => {
    const e = etiqueta(parcial('2026-11-17'))
    expect(e).toHaveTextContent(/^Envío parcial · falta por enviar · con retraso$/)
    expect(e).toHaveClass('bg-[#b42318]', 'text-white')
  })

  it('que sale mañana se queda con la etiqueta sin más', () => {
    const e = etiqueta(parcial('2026-11-19'))
    expect(e).toHaveTextContent(/^Envío parcial · falta por enviar$/)
    expect(e).not.toHaveClass('bg-[#fde2e1]')
    expect(e).not.toHaveClass('bg-[#b42318]')
  })
})

describe('TablaFilas: la celda del IMEI enseña las piezas del aviso', () => {
  it('las piezas salen juntas y el fondo sigue al peor: naranja si no cuadra, amarillo claro si solo es N/A', () => {
    const filas = [
      fila({ idFila: 1, imei: '350000000000001', nivel: 'MAL', motivo: 'COLOR', skuMovil: 'i13128RosaA',
        detalle: { sim: 'ESIM', na: false, ms: false, dato: 'Rosa', trabajos: [] } }),
      fila({ idFila: 2, imei: '350000000000002', nivel: 'AVISO', motivo: null,
        detalle: { sim: null, na: true, ms: false, dato: null, trabajos: [] } }),
    ]
    const { container } = renderConProviders(<TablaFilas filas={filas} />, { sesion: SESION_SUPER })
    const [c1, c2] = Array.from(container.querySelectorAll('td[data-imei]'))
    expect(c1).toHaveTextContent('350000000000001eSIM · color: Rosa')
    expect(c1.className).toContain('bg-[#FFE0B2]')
    expect(c2).toHaveTextContent('350000000000002N/A')
    expect(c2.className).toContain('bg-form-agotado-bg')
  })

  it('una fila validada: «validado» y la SIM, sin el motivo de SKU ni la caja; una pieza por línea del title', () => {
    const filas = [
      fila({ idFila: 1, imei: '350000000000001', nivel: 'OK', motivo: null, motivoValidado: 'COLOR', validadaPor: 'Supertécnico 1', caja: 'CAJA LISTOS', skuMovil: 'i13128RosaA',
        detalle: { sim: 'ESIM', na: false, ms: false, dato: null, trabajos: [] } }),
      fila({ idFila: 2, imei: '350000000000002', nivel: 'AVISO', motivo: 'B_POR_A', skuMovil: 'i13128RosaB',
        detalle: { sim: null, na: true, ms: false, dato: null, trabajos: [] } }),
    ]
    const { container } = renderConProviders(<TablaFilas filas={filas} />, { sesion: SESION_SUPER })
    const [c1, c2] = Array.from(container.querySelectorAll('td[data-imei]'))
    expect(c1.querySelector('[data-validado]')).toHaveTextContent('validado')
    expect(c1).toHaveTextContent('eSIM')
    expect(c1).not.toHaveTextContent('color')
    expect(c1).not.toHaveTextContent('CAJA LISTOS')
    expect(within(c1 as HTMLElement).getByText('eSIM')).toHaveClass('text-[#B45309]')
    expect(within(c2 as HTMLElement).getByText('N/A')).toHaveClass('text-form-agotado-text')
    expect(within(c2 as HTMLElement).getByText('B por A')).toHaveClass('text-form-agotado-text')
    const titulo = c2.querySelector('button')!.getAttribute('title')!
    const lineas = titulo.split('\n')
    expect(lineas.length).toBeGreaterThanOrEqual(3)
    expect(lineas).toContain('grado n/a: NSYS no le da grado')
  })
})
