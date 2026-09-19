import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders } from '@/test/render'
import { api } from './client'
import { estaConectado, reportarExito } from './conexion'

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

/** Vista con una consulta real: la primera carga la provoca navegar hasta ella y "Refrescar" imita el
 *  refresco de fondo (el poller, el `refetchOnWindowFocus` al volver a la pestaña o un `refetchInterval`).
 *  "INTENTOS" expone `errorUpdateCount`, que es el contador en el que se apoya la política del diálogo. */
function VistaConsulta({ silenciar = false }: { silenciar?: boolean }) {
  const q = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => (await api.GET('/api/clientes')).data ?? [],
    meta: silenciar ? { silenciarError: true } : undefined,
  })
  return (
    <>
      <button onClick={() => void q.refetch()}>Refrescar</button>
      {q.isError && <p>FALLO</p>}
      {q.data && <p>DATOS {q.data.length}</p>}
      <p>INTENTOS {q.errorUpdateCount}</p>
    </>
  )
}

describe('crearQueryClient: errores de mutaciones', () => {
  beforeEach(() => reportarExito())

  it('un fallo de conexión abre el diálogo además del banner (es una acción del usuario)', async () => {
    server.use(http.post('*/api/clientes', () => HttpResponse.error()))
    renderConProviders(<BotonMutacion />)
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByRole('dialog', { name: 'Error' })).toBeInTheDocument()
    expect(screen.getByText(/^Sin conexión con el servidor: .+/)).toBeInTheDocument()
    expect(estaConectado()).toBe(false)
  })

  it('el fallo de conexión avisa aunque la vista silencie sus errores', async () => {
    server.use(http.post('*/api/clientes', () => HttpResponse.text('boom', { status: 503 })))
    renderConProviders(<BotonMutacion silenciar />)
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByRole('dialog', { name: 'Error' })).toBeInTheDocument()
    expect(screen.getByText('Sin conexión con el servidor: HTTP 503')).toBeInTheDocument()
  })

  it('un 422 abre el diálogo de error con el mensaje del servidor', async () => {
    server.use(http.post('*/api/clientes', () => HttpResponse.json({ message: 'Nombre duplicado' }, { status: 422 })))
    renderConProviders(<BotonMutacion />)
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByRole('dialog', { name: 'Error' })).toBeInTheDocument()
    expect(screen.getByText('Nombre duplicado')).toBeInTheDocument()
  })

  it('con meta.silenciarError el diálogo global se calla ante un 409 (lo pone la vista)', async () => {
    server.use(http.post('*/api/clientes', () => HttpResponse.json({ message: 'Modificado' }, { status: 409 })))
    renderConProviders(<BotonMutacion silenciar />)
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByText('FALLO')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('crearQueryClient: errores de consultas', () => {
  beforeEach(() => reportarExito())

  it('la carga inicial sin conexión abre el diálogo además del banner', async () => {
    server.use(http.get('*/api/clientes', () => HttpResponse.text('boom', { status: 503 })))
    renderConProviders(<VistaConsulta />)
    expect(await screen.findByRole('dialog', { name: 'Error' })).toBeInTheDocument()
    expect(screen.getByText('Sin conexión con el servidor: HTTP 503')).toBeInTheDocument()
    // Fija empíricamente el contador en el que se apoya la política: en el primer fallo ya vale 1 (TanStack
    // despacha el estado de error antes de llamar a QueryCache.onError), no 0.
    expect(screen.getByText('INTENTOS 1')).toBeInTheDocument()
  })

  it('un refresco automático posterior de una vista sin datos no vuelve a abrir el diálogo', async () => {
    server.use(http.get('*/api/clientes', () => HttpResponse.text('boom', { status: 503 })))
    renderConProviders(<VistaConsulta />)
    expect(await screen.findByRole('dialog', { name: 'Error' })).toBeInTheDocument()
    // El usuario cierra el diálogo y sigue sin conexión: el refetch automático (foco, intervalo) reintenta
    // sobre una vista que nunca tuvo datos y solo debe dejar el banner, sin volver a interrumpir.
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Refrescar' }))
    expect(await screen.findByText('INTENTOS 2')).toBeInTheDocument()
    expect(estaConectado()).toBe(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('un refresco de fondo con datos en pantalla solo enciende el banner', async () => {
    server.use(http.get('*/api/clientes', () => HttpResponse.json([])))
    renderConProviders(<VistaConsulta />)
    expect(await screen.findByText('DATOS 0')).toBeInTheDocument()
    server.use(http.get('*/api/clientes', () => HttpResponse.text('boom', { status: 503 })))
    await userEvent.click(screen.getByRole('button', { name: 'Refrescar' }))
    expect(await screen.findByText('FALLO')).toBeInTheDocument()
    expect(estaConectado()).toBe(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('una consulta con meta.silenciarError no emite aviso por un 4xx (lo pone la vista)', async () => {
    server.use(http.get('*/api/clientes', () => new HttpResponse(null, { status: 403 })))
    renderConProviders(<VistaConsulta silenciar />)
    expect(await screen.findByText('FALLO')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('una consulta con meta.silenciarError tampoco abre el diálogo de conexión: basta el banner', async () => {
    server.use(http.get('*/api/clientes', () => HttpResponse.text('boom', { status: 503 })))
    renderConProviders(<VistaConsulta silenciar />)
    expect(await screen.findByText('FALLO')).toBeInTheDocument()
    expect(estaConectado()).toBe(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
