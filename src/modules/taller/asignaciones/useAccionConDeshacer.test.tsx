import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MS_DESHACER, useAccionConDeshacer, type AccionReversible } from './useAccionConDeshacer'

const TEXTO = 'A00000000_1 marcada como urgente'

/** Banco de pruebas mínimo: un botón que lanza la acción y el aviso que devuelve el hook, como lo monta la página. */
function Banco({ accion }: { accion: AccionReversible }) {
  const { ejecutar, aviso } = useAccionConDeshacer()
  return (
    <>
      <button onClick={() => ejecutar(accion)}>Actuar</button>
      {aviso}
    </>
  )
}

function accion(parcial: Partial<AccionReversible> = {}): AccionReversible {
  return { texto: TEXTO, hacer: vi.fn().mockResolvedValue(undefined), deshacer: vi.fn().mockResolvedValue(undefined), ...parcial }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useAccionConDeshacer', () => {
  it('ejecuta la acción y muestra el aviso con su texto', async () => {
    const a = accion()
    render(<Banco accion={a} />)
    fireEvent.click(screen.getByText('Actuar'))
    expect(await screen.findByText(TEXTO)).toBeInTheDocument()
    expect(a.hacer).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument()
    // Deshacer es lo que el usuario puede pulsar, no lo que ya ha pasado: la inversa no se lanza sola.
    expect(a.deshacer).not.toHaveBeenCalled()
  })

  it('pulsar Deshacer llama a la acción inversa y cierra el aviso', async () => {
    const a = accion()
    render(<Banco accion={a} />)
    fireEvent.click(screen.getByText('Actuar'))
    await screen.findByText(TEXTO)
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(a.deshacer).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(TEXTO)).not.toBeInTheDocument()
  })

  it('el aviso desaparece solo pasados los segundos', async () => {
    vi.useFakeTimers()
    const a = accion()
    render(<Banco accion={a} />)
    // El aviso solo aparece cuando la escritura ha ido bien, así que hay que dejar resolver su promesa.
    await act(async () => {
      fireEvent.click(screen.getByText('Actuar'))
    })
    expect(screen.getByText(TEXTO)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(MS_DESHACER - 1))
    expect(screen.getByText(TEXTO)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByText(TEXTO)).not.toBeInTheDocument()
  })

  it('si la acción falla no se muestra el aviso', async () => {
    // El error lo cuenta el manejador global de mutaciones; sin escritura no hay nada que deshacer.
    const a = accion({ hacer: vi.fn().mockRejectedValue(new Error('fallo')) })
    render(<Banco accion={a} />)
    await act(async () => {
      fireEvent.click(screen.getByText('Actuar'))
    })
    expect(a.hacer).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(TEXTO)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deshacer' })).not.toBeInTheDocument()
  })

  it('una acción nueva sustituye al aviso anterior, que deja de poder deshacerse', async () => {
    const primera = accion()
    const segunda = accion({ texto: 'A00000000_2 marcada como chasis' })
    function DosAcciones() {
      const { ejecutar, aviso } = useAccionConDeshacer()
      return (
        <>
          <button onClick={() => ejecutar(primera)}>Primera</button>
          <button onClick={() => ejecutar(segunda)}>Segunda</button>
          {aviso}
        </>
      )
    }
    render(<DosAcciones />)
    fireEvent.click(screen.getByText('Primera'))
    await screen.findByText(primera.texto)
    fireEvent.click(screen.getByText('Segunda'))
    expect(await screen.findByText(segunda.texto)).toBeInTheDocument()
    expect(screen.queryByText(primera.texto)).not.toBeInTheDocument()
    // El único "Deshacer" en pantalla es el de la segunda.
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(segunda.deshacer).toHaveBeenCalledTimes(1)
    expect(primera.deshacer).not.toHaveBeenCalled()
  })

  it('si la acción inversa falla el aviso se cierra igual', async () => {
    const a = accion({ deshacer: vi.fn().mockRejectedValue(new Error('fallo')) })
    render(<Banco accion={a} />)
    fireEvent.click(screen.getByText('Actuar'))
    await screen.findByText(TEXTO)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    })
    expect(a.deshacer).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(TEXTO)).not.toBeInTheDocument()
  })

  it('limpia el temporizador al desmontar', async () => {
    vi.useFakeTimers()
    const { unmount } = render(<Banco accion={accion()} />)
    await act(async () => {
      fireEvent.click(screen.getByText('Actuar'))
    })
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('no arma el temporizador si la vista se cierra con la escritura en vuelo', async () => {
    vi.useFakeTimers()
    let terminar = () => {}
    const a = accion({ hacer: () => new Promise<void>((res) => { terminar = res }) })
    const { unmount } = render(<Banco accion={a} />)
    fireEvent.click(screen.getByText('Actuar'))
    unmount()
    await act(async () => {
      terminar()
    })
    expect(vi.getTimerCount()).toBe(0)
  })
})
