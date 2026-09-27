import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCerrojoEnvio } from './useCerrojoEnvio'

/** Un botón que lanza una mutación real a través del cerrojo. El botón NO se deshabilita con `isPending`: así se prueba que
 *  lo que para el segundo envío es el cerrojo y no el `disabled`. */
function Arnes({ mutationFn, abierto = true }: { mutationFn: () => Promise<unknown>; abierto?: boolean }) {
  const mut = useMutation({ mutationFn })
  const enviar = useCerrojoEnvio({ abierto, enviando: mut.isPending })
  return <button type="button" onClick={() => enviar(() => mut.mutate())}>Enviar</button>
}

function montar(mutationFn: () => Promise<unknown>) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const ui = (abierto: boolean) => (
    <QueryClientProvider client={qc}>
      <Arnes mutationFn={mutationFn} abierto={abierto} />
    </QueryClientProvider>
  )
  const { rerender } = render(ui(true))
  return { reabrir: (abierto: boolean) => rerender(ui(abierto)) }
}

const esperarTurno = () => act(() => new Promise((r) => setTimeout(r, 20)))

describe('useCerrojoEnvio', () => {
  it('con una mutación real: el doble clic envía una vez y sigue cerrado mientras la respuesta no llega', async () => {
    let responder: (v: unknown) => void = () => {}
    const mutationFn = vi.fn(() => new Promise((r) => { responder = r }))
    montar(mutationFn)
    const boton = screen.getByRole('button', { name: 'Enviar' })
    fireEvent.click(boton)
    fireEvent.click(boton)
    await esperarTurno()
    fireEvent.click(boton)
    await esperarTurno()
    expect(mutationFn).toHaveBeenCalledTimes(1)
    await act(async () => { responder(null) })
    await esperarTurno()
    fireEvent.click(boton)
    await esperarTurno()
    expect(mutationFn).toHaveBeenCalledTimes(2)
  })

  it('una mutación que falla deja volver a enviar', async () => {
    const mutationFn = vi.fn(() => Promise.reject(new Error('no')))
    montar(mutationFn)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await esperarTurno()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await esperarTurno()
    expect(mutationFn).toHaveBeenCalledTimes(2)
  })

  it('cerrado (p. ej. durante la animación de salida) no envía; al reabrir, sí', async () => {
    const mutationFn = vi.fn(() => new Promise(() => {}))
    const { reabrir } = montar(mutationFn)
    reabrir(false)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await esperarTurno()
    expect(mutationFn).not.toHaveBeenCalled()
    reabrir(true)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await esperarTurno()
    expect(mutationFn).toHaveBeenCalledTimes(1)
  })
})
