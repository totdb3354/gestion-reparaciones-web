import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders } from '@/test/render'
import { api } from './client'
import { estaConectado } from './conexion'

/** Botón que dispara una mutación real (POST /api/clientes). El aviso al usuario, si toca, lo pone el
 *  MutationCache del QueryClient; el "FALLO" solo marca que la mutación ya terminó (el onError propio
 *  corre después del de la caché), para poder comprobar si hay diálogo o no sin carreras. */
function BotonMutacion({ silenciar = false }: { silenciar?: boolean }) {
  const [fallo, setFallo] = useState(false)
  const m = useMutation({
    mutationFn: (nombre: string) => api.POST('/api/clientes', { body: { nombre } }),
    meta: silenciar ? { silenciarError: true } : undefined,
    onError: () => setFallo(true),
  })
  return (
    <>
      <button onClick={() => m.mutate('x')}>Enviar</button>
      {fallo && <p>FALLO</p>}
    </>
  )
}

describe('crearQueryClient: errores de mutaciones', () => {
  it('un fallo de conexión no abre diálogo (solo el banner)', async () => {
    server.use(http.post('*/api/clientes', () => HttpResponse.error()))
    renderConProviders(<BotonMutacion />)
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByText('FALLO')).toBeInTheDocument()
    expect(estaConectado()).toBe(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('un 422 abre el diálogo de error con el mensaje del servidor', async () => {
    server.use(http.post('*/api/clientes', () => HttpResponse.json({ message: 'Nombre duplicado' }, { status: 422 })))
    renderConProviders(<BotonMutacion />)
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByRole('dialog', { name: 'Error' })).toBeInTheDocument()
    expect(screen.getByText('Nombre duplicado')).toBeInTheDocument()
  })

  it('con meta.silenciarError el diálogo global se calla (lo pone la vista)', async () => {
    server.use(http.post('*/api/clientes', () => HttpResponse.json({ message: 'Nombre duplicado' }, { status: 422 })))
    renderConProviders(<BotonMutacion silenciar />)
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByText('FALLO')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
