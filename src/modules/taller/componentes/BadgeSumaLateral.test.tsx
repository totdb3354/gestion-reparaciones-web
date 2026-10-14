import { act, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { INTERVALO_CONECTADO_MS } from '@/shared/api/refresco'
import { renderConProviders, SESION_SUPER, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { BadgeSumaLateral } from './BadgeSumaLateral'

const filas = (prefijo: string, n: number) => Array.from({ length: n }, (_, i) => ({ idRep: `${prefijo}20260901_${i + 1}` }))

/** Contadores de Pendientes y las tres listas de asignaciones; cuenta las cargas de la de reparaciones. */
function datos(contadores: { reparaciones: number; glass: number; pulidos: number }, rep: number, glass: number, pul: number) {
  const cargas = { n: 0 }
  server.use(
    http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json(contadores)),
    http.get('*/api/reparaciones/asignaciones', () => {
      cargas.n += 1
      return HttpResponse.json(filas('A', rep))
    }),
    http.get('*/api/glass/asignaciones', () => HttpResponse.json(filas('AG', glass))),
    http.get('*/api/pulidos/asignaciones', () => HttpResponse.json(filas('AP', pul))),
  )
  return cargas
}

/** Suma de la cabecera de un grupo plegado (0.9.12, spec «Navegación por grupos» §3). */
describe('suma de números de un grupo plegado', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('suma Pendientes y Asignaciones, navy como sobre un enlace inactivo', async () => {
    datos({ reparaciones: 1, glass: 1, pulidos: 1 }, 2, 1, 1)
    renderConProviders(<BadgeSumaLateral pendientes asignaciones sondeaAsignaciones />, { sesion: SESION_SUPER })
    expect(await screen.findByText('7')).toHaveClass('bg-azul-noche', 'text-superficie')
  })

  it('solo Pendientes: no pide las listas de asignaciones', async () => {
    const cargas = datos({ reparaciones: 4, glass: 1, pulidos: 0 }, 2, 1, 1)
    renderConProviders(<BadgeSumaLateral pendientes asignaciones={false} sondeaAsignaciones />, { sesion: SESION_TEC })
    expect(await screen.findByText('5')).toBeInTheDocument()
    expect(cargas.n).toBe(0)
  })

  it('con tope 99+', async () => {
    datos({ reparaciones: 90, glass: 5, pulidos: 4 }, 1, 0, 0)
    renderConProviders(<BadgeSumaLateral pendientes asignaciones sondeaAsignaciones />, { sesion: SESION_SUPER })
    expect(await screen.findByText('99+')).toBeInTheDocument()
  })

  it('a cero no se pinta', async () => {
    const cargas = datos({ reparaciones: 0, glass: 0, pulidos: 0 }, 0, 0, 0)
    renderConProviders(<BadgeSumaLateral pendientes asignaciones sondeaAsignaciones />, { sesion: SESION_SUPER })
    await waitFor(() => expect(cargas.n).toBe(1))
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(screen.queryByText(/\d/)).not.toBeInTheDocument()
  })

  it('un grupo sin números no pinta nada', () => {
    renderConProviders(<BadgeSumaLateral pendientes={false} asignaciones={false} sondeaAsignaciones />, { sesion: SESION_SUPER })
    expect(screen.queryByText(/\d/)).not.toBeInTheDocument()
  })

  it('fuera de Asignaciones se mantiene fresco con el sondeo general (60 s)', async () => {
    const cargas = datos({ reparaciones: 0, glass: 0, pulidos: 0 }, 2, 1, 1)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderConProviders(<BadgeSumaLateral pendientes asignaciones sondeaAsignaciones />, { sesion: SESION_SUPER })
    await waitFor(() => expect(cargas.n).toBe(1))
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS) })
    await waitFor(() => expect(cargas.n).toBe(2))
  })

  it('con la vista de Asignaciones abierta no sondea su total por su cuenta (lo lleva la vista, D4)', async () => {
    const cargas = datos({ reparaciones: 0, glass: 0, pulidos: 0 }, 2, 1, 1)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderConProviders(<BadgeSumaLateral pendientes asignaciones sondeaAsignaciones={false} />, { sesion: SESION_SUPER })
    expect(await screen.findByText('4')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_CONECTADO_MS * 2) })
    expect(cargas.n).toBe(1)
  })
})
