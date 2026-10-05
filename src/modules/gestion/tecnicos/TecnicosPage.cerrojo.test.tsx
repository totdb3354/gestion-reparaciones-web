import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderConProviders, SESION_ADMIN } from '@/test/render'
import { server } from '@/test/server'
import { TecnicosPage } from './TecnicosPage'

/** Mutación de alta sustituida: `mutate` no cambia `isPending`, como pasa entre el clic y la notificación de TanStack Query.
 *  Así el único freno del segundo clic es el cerrojo síncrono de la página. */
const registrar = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }))
vi.mock('./api', async (importOriginal) => ({ ...(await importOriginal<typeof import('./api')>()), useRegistrar: () => registrar }))

beforeEach(() => {
  registrar.mutate.mockReset()
  server.use(http.get('*/api/usuarios/tecnicos', () => HttpResponse.json([])))
})

describe('TecnicosPage: cerrojo del alta', () => {
  it('dos clics seguidos en "Registrar técnico" registran una sola vez', async () => {
    renderConProviders(<TecnicosPage />, { sesion: SESION_ADMIN, ruta: '/gestion/tecnicos' })
    await userEvent.type(screen.getByLabelText('Nombre del técnico'), 'tecnico-c')
    await userEvent.type(screen.getByLabelText('Nombre de usuario'), 'usuario-c')
    const boton = screen.getByRole('button', { name: 'Registrar técnico' })
    fireEvent.click(boton)
    fireEvent.click(boton)
    expect(registrar.mutate).toHaveBeenCalledTimes(1)
  })
})
