import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
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
  it('un mensaje con salto de línea se pinta en dos líneas', async () => {
    function Vista() { const { mostrarError } = useAlerta(); return <button onClick={() => mostrarError('No se pudo guardar: la asignación ya está completada.\nCierra el formulario y comprueba el estado de la asignación.')}>ir</button> }
    render(<AlertaProvider><Vista /></AlertaProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'ir' }))
    const parrafo = within(screen.getByRole('dialog', { name: 'Error' })).getByText(/No se pudo guardar: la asignación ya está completada\./)
    expect(parrafo).toHaveClass('whitespace-pre-line')
    expect(parrafo.textContent).toBe('No se pudo guardar: la asignación ya está completada.\nCierra el formulario y comprueba el estado de la asignación.')
  })
  it('al cerrar el aviso el foco vuelve al elemento que lo tenía', async () => {
    render(<AlertaProvider><Demo /></AlertaProvider>)
    const boton = screen.getByRole('button', { name: 'boom' })
    await userEvent.click(boton)
    expect(boton).not.toHaveFocus() // el diálogo se lleva el foco
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(boton).toHaveFocus())
  })
  it('también al cerrar con Escape y en el popup de texto', async () => {
    function Vista() { const { mostrarTexto } = useAlerta(); return <button onClick={() => mostrarTexto('Observación', 'Pantalla con líneas verticales')}>ver</button> }
    render(<AlertaProvider><Vista /></AlertaProvider>)
    const boton = screen.getByRole('button', { name: 'ver' })
    await userEvent.click(boton)
    expect(screen.getByRole('dialog', { name: 'Observación' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(boton).toHaveFocus())
  })
  it('si el elemento que tenía el foco ya no está en el documento, cerrar no falla', async () => {
    function Vista() {
      const { mostrarError } = useAlerta()
      const [visible, setVisible] = useState(true)
      return visible ? <button onClick={() => { mostrarError('fallo'); setVisible(false) }}>efímero</button> : <p>sin botón</p>
    }
    render(<AlertaProvider><Vista /></AlertaProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'efímero' }))
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('sin botón')).toBeInTheDocument()
  })
})
