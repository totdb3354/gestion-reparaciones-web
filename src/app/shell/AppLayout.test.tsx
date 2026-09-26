import { useMutation, useQuery } from '@tanstack/react-query'
import { act, fireEvent, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { abrirNuevoPedido } from '@/shared/lib/formularioPedido'
import { renderConProviders, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { RETARDO_CAPA_MS } from '@/shared/ui/CapaCarga'
import { AppLayout } from './AppLayout'

/** Promesa que no se resuelve nunca: la consulta o la escritura se quedan en curso durante todo el test. */
const nunca = () => new Promise<never>(() => {})

function VistaCargando({ sinCapa = false }: { sinCapa?: boolean }) {
  useQuery({ queryKey: ['prueba-capa'], queryFn: nunca, meta: sinCapa ? { sinCapa: true } : undefined })
  return <p>vista</p>
}

function VistaEscribiendo() {
  const { mutate } = useMutation({ mutationFn: nunca })
  return <button type="button" onClick={() => mutate()}>Guardar</button>
}

const pasado = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('AppLayout', () => {
  // SESION_TEC: el layout no pide nada más con ese rol (patrón de ConnectionBanner.test.tsx); el host no mira el rol,
  // quien abre el formulario sí (campana, Stock y Pedidos solo lo ofrecen al SUPERTECNICO).
  it('monta el host de los formularios de pedido: abrirNuevoPedido pinta el modal sobre la vista (P1)', async () => {
    server.use(
      http.get('*/api/componentes/gestionados', () => HttpResponse.json([])),
      http.get('*/api/proveedores', () => HttpResponse.json([])),
    )
    renderConProviders(<AppLayout />, { sesion: SESION_TEC })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => abrirNuevoPedido({ modo: 'vacio' }))
    expect(await screen.findByRole('dialog', { name: 'Nuevo pedido' })).toBeInTheDocument()
  })
})

describe('AppLayout: overlay de carga (web 0.8.3)', () => {
  it('con una consulta en su carga inicial la capa aparece pasados 200 ms y la app queda aria-busy', async () => {
    const { container } = renderConProviders(<VistaCargando />, { sesion: SESION_TEC, layout: <AppLayout /> })
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(await screen.findByText('Cargando…', {}, { timeout: RETARDO_CAPA_MS * 5 })).toBeInTheDocument()
  })

  it('con una escritura en curso la capa aparece pasados 200 ms', async () => {
    renderConProviders(<VistaEscribiendo />, { sesion: SESION_TEC, layout: <AppLayout /> })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
    expect(await screen.findByText('Cargando…', {}, { timeout: RETARDO_CAPA_MS * 5 })).toBeInTheDocument()
  })

  it('una consulta marcada sinCapa (sondeos del shell) no enciende la capa', async () => {
    const { container } = renderConProviders(<VistaCargando sinCapa />, { sesion: SESION_TEC, layout: <AppLayout /> })
    await act(() => pasado(RETARDO_CAPA_MS * 2))
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
    expect(container.querySelector('[aria-busy]')).toBeNull()
  })
})
