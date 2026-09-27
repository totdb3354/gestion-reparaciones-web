import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderConProviders } from '@/test/render'
import { ClienteDialog } from './ClienteDialog'

function montar() {
  const onAceptar = vi.fn()
  renderConProviders(<ClienteDialog abierto titulo="Nuevo cliente" etiqueta="Nombre del cliente:" onAceptar={onAceptar} onCancelar={vi.fn()} />)
  return onAceptar
}

describe('ClienteDialog', () => {
  it('dos clics seguidos en Aceptar llaman una sola vez a onAceptar', async () => {
    const onAceptar = montar()
    await userEvent.type(screen.getByLabelText('Nombre del cliente:'), 'Amazon')
    const aceptar = screen.getByRole('button', { name: 'Aceptar' })
    fireEvent.click(aceptar)
    fireEvent.click(aceptar)
    expect(onAceptar).toHaveBeenCalledTimes(1)
    expect(onAceptar).toHaveBeenCalledWith('Amazon')
  })
  it('con el nombre vacío no acepta, y Aceptar sigue respondiendo después', async () => {
    const onAceptar = montar()
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(onAceptar).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText('Nombre del cliente:'), 'Amazon')
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(onAceptar).toHaveBeenCalledTimes(1)
  })
})
