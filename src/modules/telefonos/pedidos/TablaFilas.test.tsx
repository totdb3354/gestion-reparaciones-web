import { screen } from '@testing-library/react'
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
