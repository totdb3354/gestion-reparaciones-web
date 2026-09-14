import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AlertaProvider, useAlerta } from './AlertaProvider'

function Demo() {
  const { mostrarError } = useAlerta()
  return <button onClick={() => mostrarError('El cliente fue modificado por otro usuario. Se recargan los datos.')}>boom</button>
}

describe('AlertaProvider (calco de Alertas.mostrarError)', () => {
  it('abre un diálogo con el mensaje y se cierra con Aceptar', async () => {
    render(<AlertaProvider><Demo /></AlertaProvider>)
    await userEvent.click(screen.getByText('boom'))
    expect(screen.getByRole('dialog', { name: 'Error' })).toBeInTheDocument()
    expect(screen.getByText(/modificado por otro usuario/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
