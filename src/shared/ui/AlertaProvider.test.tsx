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
  it('mostrarAviso abre el diálogo con un título propio', async () => {
    function Vista() { const { mostrarAviso } = useAlerta(); return <button onClick={() => mostrarAviso('No se puede borrar', 'La reparación R1 apunta a esta. Bórrala primero.')}>ir</button> }
    render(<AlertaProvider><Vista /></AlertaProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'ir' }))
    expect(screen.getByRole('dialog', { name: 'No se puede borrar' })).toHaveTextContent('La reparación R1 apunta a esta. Bórrala primero.')
  })
})
