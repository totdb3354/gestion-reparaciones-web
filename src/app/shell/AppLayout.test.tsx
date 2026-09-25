import { act, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { abrirNuevoPedido } from '@/shared/lib/formularioPedido'
import { renderConProviders, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { AppLayout } from './AppLayout'

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
